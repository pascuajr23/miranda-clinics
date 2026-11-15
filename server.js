// Miranda Clinics — static site + queue API. No dependencies; needs Node 18+.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'rooms.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const PAGES = { '/': 'index.html', '/queue': 'queue.html', '/control': 'control.html' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const EDITABLE = ['name', 'department', 'doctor', 'number', 'doctorIn', 'color'];
const COLORS = ['blue', 'green', 'purple', 'orange']; // must match the .room-color-* classes in styles.css

// Same two rooms the old site had, so the TV shows the same thing on first boot.
const SEED = [
  { id: 'room1', name: 'Room 1', department: 'Internal Medicine', doctor: 'Dr. Kenneth Miranda', number: 0, doctorIn: false, color: 'blue' },
  { id: 'room2', name: 'Room 2', department: 'Pediatrics', doctor: 'Dr. Kath Miranda', number: 0, doctorIn: false, color: 'green' },
];

function loadRooms() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error; // never silently replace a corrupt file with the seed
    return structuredClone(SEED);
  }
}

let rooms = loadRooms();

function saveRooms() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rooms, null, 2));
  fs.renameSync(tmp, DATA_FILE); // atomic swap so a crash mid-write can't corrupt the queue
}

// shortcut: sessions live in memory, so a server restart logs everyone out; move to the data file if that becomes annoying.
const sessions = new Map();
const failedLogins = new Map();

function sha(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function checkCredentials(user, password) {
  if (!ADMIN_PASSWORD) return false;
  const userOk = crypto.timingSafeEqual(sha(user), sha(ADMIN_USER));
  const passOk = crypto.timingSafeEqual(sha(password), sha(ADMIN_PASSWORD));
  return userOk && passOk;
}

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
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(match[1]);
    return null;
  }
  return { id: match[1], ...session };
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
      if (raw.length > 10_000) req.destroy();
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
    } else if (typeof value !== 'string' || value.trim().length > 80) {
      throw new Error(`${key} must be text up to 80 characters.`);
    }
    patch[key] = typeof value === 'string' ? value.trim() : value;
  }
  return patch;
}

async function handleApi(req, res, url) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  if (req.method === 'GET' && url.pathname === '/api/rooms') return send(res, 200, rooms);

  if (req.method === 'GET' && url.pathname === '/api/session') return send(res, 200, { loggedIn: Boolean(getSession(req)) });

  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (tooManyAttempts(ip)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    const { username, password } = await readJson(req);
    if (!checkCredentials(username || '', password || '')) {
      recordFailure(ip);
      return send(res, 401, { error: ADMIN_PASSWORD ? 'Incorrect username or password.' : 'ADMIN_PASSWORD is not set on the server.' });
    }
    failedLogins.delete(ip);
    const sid = crypto.randomBytes(32).toString('hex');
    sessions.set(sid, { expiresAt: Date.now() + SESSION_TTL_MS });
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return send(res, 200, { ok: true }, { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}` });
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const session = getSession(req);
    if (session) sessions.delete(session.id);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  // Everything below changes the queue and needs a logged-in admin.
  if (!getSession(req)) return send(res, 401, { error: 'Please log in again.' });

  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    const patch = validatePatch(await readJson(req));
    const room = { id: crypto.randomUUID(), name: `Room ${rooms.length + 1}`, department: '', doctor: '', number: 0, doctorIn: false, color: 'blue', ...patch };
    rooms.push(room);
    saveRooms();
    return send(res, 201, room);
  }

  const match = /^\/api\/rooms\/([\w-]+)$/.exec(url.pathname);
  const room = match && rooms.find((r) => r.id === match[1]);
  if (match && !room) return send(res, 404, { error: 'Room not found.' });

  if (room && req.method === 'PATCH') {
    Object.assign(room, validatePatch(await readJson(req)));
    saveRooms();
    return send(res, 200, room);
  }

  if (room && req.method === 'DELETE') {
    rooms = rooms.filter((r) => r !== room);
    saveRooms();
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
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(content);
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
  if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD is not set: nobody can log in to /control until it is.');
  server.listen(PORT, () => console.log(`Miranda Clinics running on http://localhost:${PORT}`));
}

module.exports = server;
