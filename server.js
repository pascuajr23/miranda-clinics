// Miranda Clinics — static site + queue API. No dependencies; needs Node 18+.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'rooms.json');
const SITE_FILE = path.join(path.dirname(DATA_FILE), 'site.json'); // doctors, users, announcement, closures
const LOG_FILE = path.join(path.dirname(DATA_FILE), 'activity.json'); // staff actions only, never patients
const LOG_LIMIT = 1000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const PAGES = { '/': 'index.html', '/queue': 'queue.html', '/control': 'control.html', '/admin': 'admin.html', '/privacy': 'privacy.html' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const EDITABLE = ['name', 'department', 'doctorId', 'number', 'doctorIn', 'color', 'message'];
const QUEUE_FIELDS = ['number', 'doctorIn', 'message']; // all doctors and staff may change on their own rooms
const ROLES = ['admin', 'staff', 'doctor']; // the env login is the super admin and is never stored
const COLORS = ['blue', 'green', 'purple', 'orange']; // must match the colour lists in public/queue.html and public/control.js

// Same two rooms the old site had, so the TV shows the same thing on first boot.
const SEED = [
  { id: 'room1', name: 'Room 1', department: 'Internal Medicine', doctorId: 'ken', number: 0, doctorIn: false, color: 'blue' },
  { id: 'room2', name: 'Room 2', department: 'Pediatrics', doctorId: 'kath', number: 0, doctorIn: false, color: 'green' },
];

// Dr. Ken and Dr. Kath are fixed: they can't be removed, and only their schedule can change.
const SITE_SEED = {
  doctors: [
    { id: 'ken', fixed: true, name: 'Dr. Kenneth Miranda', label: 'Adult care', badge: 'Adults', color: 'blue', photo: '/assets/doctors/dr-ken.webp',
      bio: 'Internal medicine specialist offering comprehensive adult care, preventive visits, and chronic condition management.',
      services: ['General Consultation', 'CardioPulmonary Clearance', 'Medical Certificates', 'Fit to Work', 'Adult Vaccines'], schedule: '' },
    { id: 'kath', fixed: true, name: 'Dr. Kath Miranda', label: 'Pediatric care', badge: 'Children', color: 'green', photo: '/assets/doctors/dr-kath.webp',
      bio: 'Pediatrician providing gentle, child-focused care for routine checkups, growth tracking, and everyday health concerns.',
      services: ['Well-baby/child checkup', 'Sick-baby/child checkup', 'Immunizations', 'Ear-piercing', 'Follow-ups'], schedule: '' },
  ],
  users: [],
  announcement: { title: 'Open on sunday!', details: 'Laboratory - Urinalysis - Blood Chemistry - ECG', hours: '7:00 AM – 10:00 AM' },
};

function loadJson(file, seed) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error; // never silently replace a corrupt file with the seed
    return structuredClone(seed);
  }
}

function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file); // atomic swap so a crash mid-write can't corrupt the data
}

let rooms = loadJson(DATA_FILE, SEED);
const site = loadJson(SITE_FILE, SITE_SEED);
// Rooms saved before doctors existed only have a doctor name: link them to the matching doctor.
for (const room of rooms) {
  if (room.doctorId === undefined) room.doctorId = site.doctors.find((d) => d.name === room.doctor)?.id || '';
  delete room.doctor;
}

const saveRooms = () => saveJson(DATA_FILE, rooms);
site.closures ??= []; // added after the first release
// The Mirandas' photos aren't editable, so always use the current files (they moved from PNG to WebP).
for (const d of site.doctors) if (d.fixed) d.photo = SITE_SEED.doctors.find((s) => s.id === d.id)?.photo ?? d.photo;
const saveSite = () => saveJson(SITE_FILE, site);
let activity = loadJson(LOG_FILE, []);

// Who changed what, newest first. Names of staff and rooms only.
function logAction(user, action) {
  activity.unshift({ at: new Date().toISOString(), user: user.name || user.username, action });
  activity = activity.slice(0, LOG_LIMIT);
  saveJson(LOG_FILE, activity);
}
const doctorName = (id) => site.doctors.find((d) => d.id === id)?.name || '';
const publicRoom = (r) => ({ ...r, doctor: doctorName(r.doctorId) });

// shortcut: sessions live in memory, so a server restart logs everyone out; move to the data file if that becomes annoying.
const sessions = new Map();
const failedLogins = new Map();

function sha(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}

function passwordMatches(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 32), Buffer.from(hash, 'hex'));
}

const SUPER_ADMIN = { id: 'superadmin', username: ADMIN_USER, name: 'Super admin', role: 'admin', doctorIds: [], superAdmin: true };

// Returns the user id for good credentials, or null.
function checkCredentials(username, password) {
  if (ADMIN_PASSWORD && crypto.timingSafeEqual(sha(username), sha(ADMIN_USER)) && crypto.timingSafeEqual(sha(password), sha(ADMIN_PASSWORD))) return SUPER_ADMIN.id;
  const user = site.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  return user && passwordMatches(password, user.password) ? user.id : null;
}

const findUser = (id) => (id === SUPER_ADMIN.id ? SUPER_ADMIN : site.users.find((u) => u.id === id));
const publicUser = ({ password, ...u }) => u;
// Doctors see their own rooms, staff the rooms of the doctors they manage, admins everything.
const canRunRoom = (user, room) => user.role === 'admin' || (room.doctorId && user.doctorIds.includes(room.doctorId));

function tooManyAttempts(ip) {
  const entry = failedLogins.get(ip);
  if (!entry || Date.now() - entry.since > 15 * 60 * 1000) return false;
  return entry.count >= 5;
}

function recordFailure(ip) {
  const entry = failedLogins.get(ip);
  if (!entry || Date.now() - entry.since > 15 * 60 * 1000) failedLogins.set(ip, { count: 1, since: Date.now() });
  else entry.count += 1;
}

function getSession(req) {
  const match = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!match) return null;
  const session = sessions.get(match[1]);
  const user = session && findUser(session.userId); // a removed user is logged out at once
  if (!session || session.expiresAt < Date.now() || !user) {
    sessions.delete(match[1]);
    return null;
  }
  return { id: match[1], ...session, user };
}

// Fingerprint of the files in public/: changes whenever a new version is deployed, so open TVs reload themselves.
function hashDir(dir, hash = crypto.createHash('sha1')) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) hashDir(full, hash);
    else hash.update(entry.name).update(fs.readFileSync(full));
  }
  return hash;
}
const APP_VERSION = hashDir(PUBLIC_DIR).digest('hex').slice(0, 12);

const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/;

// Sends a body with an ETag (304 when the browser already has it) and gzip when the browser accepts it.
// Keeps phones on slow data from downloading the same bytes again.
function sendCached(req, res, content, type, cacheControl) {
  const etag = `"${crypto.createHash('sha1').update(content).digest('base64url').slice(0, 16)}"`;
  const headers = { 'Content-Type': type, 'Cache-Control': cacheControl, ETag: etag, 'X-App-Version': APP_VERSION, Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  if (content.length > 1024 && COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    content = zlib.gzipSync(content);
    headers['Content-Encoding'] = 'gzip';
  }
  res.writeHead(200, headers);
  res.end(content);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return reject(new Error('Expected JSON'));
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 20_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Returns a clean patch or throws with a message the control panel can show.
function validatePatch(input) {
  const patch = {};
  for (const key of EDITABLE) {
    if (!(key in input)) continue;
    const value = input[key];
    if (key === 'number') {
      if (!Number.isInteger(value) || value < 0 || value > 9999) throw new Error('Number must be a whole number from 0 to 9999.');
    } else if (key === 'doctorIn') {
      if (typeof value !== 'boolean') throw new Error('doctorIn must be true or false.');
    } else if (key === 'color') {
      if (!COLORS.includes(value)) throw new Error(`Color must be one of: ${COLORS.join(', ')}.`);
    } else if (key === 'doctorId') {
      if (value !== '' && !site.doctors.some((d) => d.id === value)) throw new Error('Unknown doctor.');
    } else if (typeof value !== 'string' || value.trim().length > (key === 'message' ? 60 : 80)) {
      throw new Error(`${key} must be text up to 80 characters.`);
    }
    patch[key] = typeof value === 'string' ? value.trim() : value;
  }
  return patch;
}

function text(value, label, max = 80) {
  if (typeof value !== 'string' || value.trim().length > max) throw new Error(`${label} must be text up to ${max} characters.`);
  return value.trim();
}

function list(value, label) {
  if (!Array.isArray(value) || value.length > 20) throw new Error(`${label} must be a list of up to 20 items.`);
  return value.map((v) => text(v, label)).filter(Boolean);
}

function validateDoctor(input, doctor) {
  const patch = {};
  if ('schedule' in input) patch.schedule = text(input.schedule, 'Schedule', 400);
  if (doctor?.fixed) return patch; // only the schedule of the two Mirandas can change
  for (const key of ['name', 'label', 'badge', 'bio']) if (key in input) patch[key] = text(input[key], key, key === 'bio' ? 300 : 80);
  if ('services' in input) patch.services = list(input.services, 'Services');
  if ('color' in input) {
    if (!COLORS.includes(input.color)) throw new Error(`Color must be one of: ${COLORS.join(', ')}.`);
    patch.color = input.color;
  }
  if (patch.name === '') throw new Error('The doctor needs a name.');
  return patch;
}

function validateUser(input, existing) {
  const patch = {};
  if ('name' in input) patch.name = text(input.name, 'Name');
  if ('username' in input) {
    patch.username = text(input.username, 'Username', 40);
    if (!/^[\w.-]{3,40}$/.test(patch.username)) throw new Error('Username: 3 to 40 letters, numbers, dots or dashes.');
    const taken = patch.username.toLowerCase() === ADMIN_USER.toLowerCase() ||
      site.users.some((u) => u !== existing && u.username.toLowerCase() === patch.username.toLowerCase());
    if (taken) throw new Error('That username is taken.');
  }
  if ('role' in input) {
    if (!ROLES.includes(input.role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}.`);
    patch.role = input.role;
  }
  if ('doctorIds' in input) {
    if (!Array.isArray(input.doctorIds) || !input.doctorIds.every((id) => site.doctors.some((d) => d.id === id))) throw new Error('Unknown doctor.');
    patch.doctorIds = [...new Set(input.doctorIds)];
  }
  if ('password' in input && input.password !== '') patch.password = validNewPassword(input.password);
  const role = patch.role || existing?.role;
  const doctorIds = patch.doctorIds || existing?.doctorIds || [];
  if (role === 'doctor' && doctorIds.length > 1) throw new Error('A doctor login belongs to one doctor.');
  return patch;
}

function validNewPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) throw new Error('Password must be at least 8 characters.');
  return hashPassword(password);
}

function describeRoomChange(room, patch) {
  const parts = [];
  if ('number' in patch) parts.push(`number ${String(patch.number).padStart(3, '0')}`);
  if ('doctorIn' in patch) parts.push(patch.doctorIn ? 'doctor in' : 'doctor out');
  if ('message' in patch) parts.push(patch.message ? `message “${patch.message}”` : 'message cleared');
  if ('doctorId' in patch) parts.push(`doctor ${doctorName(patch.doctorId) || 'none'}`);
  for (const key of ['name', 'department', 'color']) if (key in patch) parts.push(`${key} ${patch[key]}`);
  return `${room.name}: ${parts.join(', ')}`;
}

async function handleApi(req, res, url) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  // Public reads polled by the TV and phones: revalidated with ETags instead of re-sent in full.
  if (req.method === 'GET' && url.pathname === '/api/rooms') return sendCached(req, res, Buffer.from(JSON.stringify(rooms.map(publicRoom))), 'application/json', 'no-cache');

  if (req.method === 'GET' && url.pathname === '/api/site') return sendCached(req, res, Buffer.from(JSON.stringify({ doctors: site.doctors, announcement: site.announcement, closures: site.closures })), 'application/json', 'no-cache');

  if (req.method === 'GET' && url.pathname === '/api/session') {
    const session = getSession(req);
    return send(res, 200, { loggedIn: Boolean(session), user: session && publicUser(session.user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (tooManyAttempts(ip)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    const { username, password } = await readJson(req);
    const userId = checkCredentials(String(username || '').trim(), String(password || ''));
    if (!userId) {
      recordFailure(ip);
      return send(res, 401, { error: ADMIN_PASSWORD || site.users.length ? 'Incorrect username or password.' : 'ADMIN_PASSWORD is not set on the server.' });
    }
    failedLogins.delete(ip);
    const sid = crypto.randomBytes(32).toString('hex');
    sessions.set(sid, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
    logAction(findUser(userId), 'Logged in');
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return send(res, 200, { ok: true }, { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}` });
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const session = getSession(req);
    if (session) sessions.delete(session.id);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  // Everything below needs a login.
  const session = getSession(req);
  if (!session) return send(res, 401, { error: 'Please log in again.' });
  const { user } = session;
  const isAdmin = user.role === 'admin';
  const forbidden = () => send(res, 403, { error: 'Your login can’t do that.' });

  if (req.method === 'POST' && url.pathname === '/api/password') {
    if (user.superAdmin) return send(res, 400, { error: 'The super admin password is set in the server settings (.env).' });
    const { current, password } = await readJson(req);
    if (!passwordMatches(String(current || ''), user.password)) return send(res, 400, { error: 'Your current password is wrong.' });
    user.password = validNewPassword(password);
    saveSite();
    logAction(user, 'Changed their password');
    return send(res, 200, { ok: true });
  }

  // Room queue controls: doctors and staff on their own rooms, admins on all.
  const roomMatch = /^\/api\/rooms\/([\w-]+)$/.exec(url.pathname);
  if (roomMatch && req.method === 'PATCH') {
    const room = rooms.find((r) => r.id === roomMatch[1]);
    if (!room) return send(res, 404, { error: 'Room not found.' });
    if (!canRunRoom(user, room)) return forbidden();
    const patch = validatePatch(await readJson(req));
    if (!isAdmin && Object.keys(patch).some((k) => !QUEUE_FIELDS.includes(k))) return forbidden();
    Object.assign(room, patch);
    saveRooms();
    logAction(user, describeRoomChange(room, patch));
    return send(res, 200, publicRoom(room));
  }

  // Everything below is admin only.
  if (!isAdmin) return forbidden();

  if (req.method === 'PATCH' && url.pathname === '/api/announcement') {
    const input = await readJson(req);
    for (const key of ['title', 'details', 'hours']) if (key in input) site.announcement[key] = text(input[key], key, 200);
    saveSite();
    logAction(user, 'Updated the announcement');
    return send(res, 200, site.announcement);
  }

  if (req.method === 'GET' && url.pathname === '/api/activity') return send(res, 200, activity);

  if (req.method === 'POST' && url.pathname === '/api/closures') {
    const input = await readJson(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || Number.isNaN(Date.parse(input.date))) return send(res, 400, { error: 'Pick a date.' });
    const closure = { id: crypto.randomUUID(), date: input.date, note: text(input.note ?? '', 'Note', 80) };
    site.closures.push(closure);
    site.closures.sort((a, b) => a.date.localeCompare(b.date));
    saveSite();
    logAction(user, `Added closure ${closure.date}${closure.note ? ` (${closure.note})` : ''}`);
    return send(res, 201, closure);
  }

  const closureMatch = /^\/api\/closures\/([\w-]+)$/.exec(url.pathname);
  if (closureMatch && req.method === 'DELETE') {
    const closure = site.closures.find((c) => c.id === closureMatch[1]);
    if (!closure) return send(res, 404, { error: 'Closure not found.' });
    site.closures = site.closures.filter((c) => c !== closure);
    saveSite();
    logAction(user, `Removed closure ${closure.date}`);
    return send(res, 204);
  }

  if (req.method === 'POST' && url.pathname === '/api/doctors') {
    const doctor = { id: crypto.randomUUID(), fixed: false, name: 'New doctor', label: '', badge: '', color: 'blue', photo: '', bio: '', services: [], schedule: '' };
    Object.assign(doctor, validateDoctor(await readJson(req)));
    site.doctors.push(doctor);
    saveSite();
    logAction(user, `Added doctor ${doctor.name}`);
    return send(res, 201, doctor);
  }

  const doctorMatch = /^\/api\/doctors\/([\w-]+)$/.exec(url.pathname);
  if (doctorMatch) {
    const doctor = site.doctors.find((d) => d.id === doctorMatch[1]);
    if (!doctor) return send(res, 404, { error: 'Doctor not found.' });
    if (req.method === 'PATCH') {
      Object.assign(doctor, validateDoctor(await readJson(req), doctor));
      saveSite();
      logAction(user, `Edited doctor ${doctor.name}`);
      return send(res, 200, doctor);
    }
    if (req.method === 'DELETE') {
      if (doctor.fixed) return send(res, 400, { error: `${doctor.name} can’t be removed.` });
      site.doctors = site.doctors.filter((d) => d !== doctor);
      site.users = site.users.filter((u) => !(u.role === 'doctor' && u.doctorIds.includes(doctor.id))); // their login goes too
      for (const u of site.users) u.doctorIds = u.doctorIds.filter((id) => id !== doctor.id);
      for (const r of rooms) if (r.doctorId === doctor.id) r.doctorId = '';
      saveSite();
      saveRooms();
      logAction(user, `Removed doctor ${doctor.name}`);
      return send(res, 204);
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/users') return send(res, 200, [publicUser(SUPER_ADMIN), ...site.users.map(publicUser)]);

  // Admins may manage doctor logins only; staff and admin accounts are the super admin's.
  const mayManage = (role) => user.superAdmin || role === 'doctor';

  if (req.method === 'POST' && url.pathname === '/api/users') {
    const input = await readJson(req);
    if (!mayManage(input.role || 'staff')) return forbidden();
    if (!input.username || !input.password) return send(res, 400, { error: 'A username and password are required.' });
    const newUser = { id: crypto.randomUUID(), name: '', role: 'staff', doctorIds: [], ...validateUser(input) };
    site.users.push(newUser);
    saveSite();
    logAction(user, `Added ${newUser.role} login ${newUser.username}`);
    return send(res, 201, publicUser(newUser));
  }

  const userMatch = /^\/api\/users\/([\w-]+)$/.exec(url.pathname);
  if (userMatch) {
    const target = site.users.find((u) => u.id === userMatch[1]);
    if (!target) return send(res, userMatch[1] === SUPER_ADMIN.id ? 400 : 404, { error: userMatch[1] === SUPER_ADMIN.id ? 'The super admin is set in the server settings (.env).' : 'User not found.' });
    if (!mayManage(target.role)) return forbidden();
    if (req.method === 'PATCH') {
      const patch = validateUser(await readJson(req), target);
      if (patch.role && !mayManage(patch.role)) return forbidden();
      Object.assign(target, patch);
      saveSite();
      logAction(user, `Edited login ${target.username}${patch.password ? ' (new password)' : ''}`);
      return send(res, 200, publicUser(target));
    }
    if (req.method === 'DELETE') {
      site.users = site.users.filter((u) => u !== target);
      saveSite();
      logAction(user, `Removed login ${target.username}`);
      return send(res, 204);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    const patch = validatePatch(await readJson(req));
    const room = { id: crypto.randomUUID(), name: `Room ${rooms.length + 1}`, department: '', doctorId: '', number: 0, doctorIn: false, color: 'blue', ...patch };
    rooms.push(room);
    saveRooms();
    logAction(user, `Added ${room.name}`);
    return send(res, 201, publicRoom(room));
  }

  const room = roomMatch && rooms.find((r) => r.id === roomMatch[1]);
  if (roomMatch && !room) return send(res, 404, { error: 'Room not found.' });

  if (room && req.method === 'DELETE') {
    rooms = rooms.filter((r) => r !== room);
    saveRooms();
    logAction(user, `Removed ${room.name}`);
    return send(res, 204);
  }

  return send(res, 404, { error: 'Not found.' });
}

function serveStatic(req, res, url) {
  const relative = PAGES[url.pathname] || url.pathname.slice(1);
  const file = path.join(PUBLIC_DIR, relative);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, { error: 'Not found.' });
  fs.readFile(file, (error, content) => {
    if (error) return send(res, 404, { error: 'Not found.' });
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    if (type.startsWith('text/html')) {
      content = Buffer.from(content.toString('utf8').replace(
        /\b(href|src)=(["'])\/([^"'?#]+\.(?:css|js))(?:\?[^"']*)?\2/g,
        (_match, attribute, quote, asset) => `${attribute}=${quote}/${asset}?v=${APP_VERSION}${quote}`,
      ));
    }
    // Versioned CSS and scripts bypass stale intermediary caches; other pages revalidate, images cache for a day.
    const cacheControl = /^image\//.test(type) ? 'public, max-age=86400' : 'no-cache';
    sendCached(req, res, content, type, cacheControl);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  try {
    await handleApi(req, res, url);
  } catch (error) {
    send(res, 400, { error: error.message });
  }
});

if (require.main === module) {
  if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD is not set: the super admin can’t log in until it is.');
  server.listen(PORT, () => console.log(`Miranda Clinics running on http://localhost:${PORT}`));
}

module.exports = server;
