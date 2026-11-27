const loginView = document.getElementById('loginView');
const panelView = document.getElementById('panelView');
const loginForm = document.getElementById('loginForm');
const doctorsEl = document.getElementById('doctors');
const usersEl = document.getElementById('users');
const announcementForm = document.getElementById('announcementForm');

let me = null;
let doctors = [];
let users = [];
let rooms = [];
let closures = [];
const closureListEl = document.getElementById('closureList');
const dateFmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const roomListEl = document.getElementById('roomList');

// Tabs (admins only); the hash keeps the tab across reloads.
function showTab(name) {
  if (me?.role !== 'admin' || !document.querySelector(`[data-panel="${name}"]`) || (name === 'staff' && !me.superAdmin)) name = 'main';
  document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  document.querySelectorAll('[data-tab]').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === name);
    t.setAttribute('aria-selected', String(t.dataset.tab === name));
    t.tabIndex = t.dataset.tab === name ? 0 : -1; // arrow keys move between tabs
  });
  history.replaceState(null, '', name === 'main' ? location.pathname : `#${name}`);
}
window.addEventListener('hashchange', () => {
  showTab(location.hash.slice(1));
  if (location.hash === '#activity') loadActivity();
});
// Left/right arrows move between tabs (standard tablist keyboard pattern).
document.querySelector('.tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const tabs = [...document.querySelectorAll('[data-tab]:not([hidden])')];
  const next = tabs[(tabs.indexOf(document.activeElement) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  next.focus();
  next.click();
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  if (!e.target.dataset.tab) return;
  showTab(e.target.dataset.tab);
  if (e.target.dataset.tab === 'activity') loadActivity();
});

const call = (method, path, body) => api(method, path, body, () => showLogin('Your session ended. Please sign in again.'));
const ROLE_NAMES = { admin: 'Admin', staff: 'Staff', doctor: 'Doctor' };
const STAFF_ROLES = [['staff', 'Staff'], ['admin', 'Admin']];

function showLogin(message = '') {
  loginView.classList.remove('hidden');
  panelView.classList.add('hidden');
  document.getElementById('loginError').textContent = message;
  loginForm.username.focus();
}

async function showPanel(user) {
  me = user;
  loginView.classList.add('hidden');
  panelView.classList.remove('hidden');
  document.body.classList.toggle('is-admin', user.role === 'admin');
  document.getElementById('greeting').textContent = `Hi, ${user.name || user.username}`;
  document.getElementById('passwordSection').hidden = Boolean(user.superAdmin); // super admin password lives in .env
  document.querySelector('[data-tab="staff"]').hidden = !user.superAdmin; // only the super admin manages staff
  showTab(location.hash.slice(1));
  if (user.role === 'admin') await loadAdmin();
  if (location.hash === '#activity') loadActivity();
}

async function loadAdmin() {
  try {
    const [site, userList, roomList] = await Promise.all([call('GET', '/api/site'), call('GET', '/api/users'), call('GET', '/api/rooms')]);
    doctors = site.doctors;
    users = userList;
    rooms = roomList;
    closures = site.closures;
    renderRooms();
    renderClosures();
    for (const key of ['title', 'details', 'hours']) announcementForm[key].value = site.announcement[key] || '';
    renderDoctors();
    renderUsers();
  } catch (error) {
    toast(error.message, true);
  }
}

// A doctor's login lives on their card; it controls whichever room the doctor is put in.
function loginBlock(d) {
  const u = users.find((x) => x.role === 'doctor' && x.doctorIds[0] === d.id);
  if (u) return `
    <div data-user="${esc(u.id)}">
      <label>Login username</label><input type="text" data-ufield="username" value="${esc(u.username)}" maxlength="40" autocapitalize="none" />
      <label>New password</label><input type="password" data-ufield="password" autocomplete="new-password" placeholder="Leave empty to keep" />
      <button type="button" class="remove" data-action="delete-login">Remove login</button>
    </div>`;
  return `
    <label>Login username</label><input type="text" data-new="username" maxlength="40" autocapitalize="none" placeholder="No login yet" />
    <label>Password</label><input type="password" data-new="password" autocomplete="new-password" placeholder="At least 8 characters" />
    <button type="button" data-action="create-login">Create login</button>`;
}

function doctorCard(d) {
  const schedule = `
    <label>Schedule</label>
    <textarea data-field="schedule" maxlength="400" placeholder="Mon – Fri  9:00 AM – 12:00 PM">${esc(d.schedule)}</textarea>`;
  if (d.fixed) {
    return `
      <article class="room-card" data-id="${esc(d.id)}">
        <h2>${esc(d.name)} <span class="tag">Always listed</span></h2>
        ${schedule}
        ${loginBlock(d)}
      </article>`;
  }
  return `
    <article class="room-card" data-id="${esc(d.id)}">
      <h2>${esc(d.name)}</h2>
      <label>Name</label><input type="text" data-field="name" value="${esc(d.name)}" maxlength="80" />
      <label>Field</label><input type="text" data-field="label" value="${esc(d.label)}" maxlength="80" placeholder="e.g. OB-GYN care" />
      <label>Badge</label><input type="text" data-field="badge" value="${esc(d.badge)}" maxlength="80" placeholder="e.g. Women" />
      <label>About</label><textarea data-field="bio" maxlength="300">${esc(d.bio)}</textarea>
      <label>Services</label><textarea data-field="services" placeholder="One per line">${esc(d.services.join('\n'))}</textarea>
      ${schedule}
      <label>Colour</label>
      <select data-field="color">${COLORS.map((c) => `<option value="${c}"${c === d.color ? ' selected' : ''}>${c}</option>`).join('')}</select>
      ${loginBlock(d)}
      <button type="button" class="remove" data-action="delete">Remove doctor</button>
    </article>`;
}

function renderDoctors() {
  doctorsEl.innerHTML = doctors.map(doctorCard).join('') + '<button type="button" class="add-card" data-action="add">+ Add a doctor</button>';
}

function userCard(u) {
  if (u.superAdmin) {
    return `
      <article class="room-card">
        <h2>${esc(u.username)} <span class="tag">Super admin</span></h2>
        <p class="hint">Manages everything. Its login is set in the server's .env file.</p>
      </article>`;
  }
  const checks = doctors.map((d) => `
    <label><input type="checkbox" data-doctor="${esc(d.id)}"${u.doctorIds.includes(d.id) ? ' checked' : ''} /> ${esc(d.name)}</label>`).join('');
  return `
    <article class="room-card" data-id="${esc(u.id)}">
      <h2>${esc(u.name || u.username)} <span class="tag">${ROLE_NAMES[u.role]}</span></h2>
      <label>Name</label><input type="text" data-field="name" value="${esc(u.name)}" maxlength="80" />
      <label>Username</label><input type="text" data-field="username" value="${esc(u.username)}" maxlength="40" autocapitalize="none" />
      <label>Role</label>
      <select data-field="role">${STAFF_ROLES.map(([v, n]) => `<option value="${v}"${v === u.role ? ' selected' : ''}>${n}</option>`).join('')}</select>
      ${u.role === 'admin' ? '<p class="hint">Runs every room, sets up rooms, adds doctors and their logins.</p>' : `
        <p class="group-label" id="manages-${esc(u.id)}">Manages</p>
        <div class="checks" role="group" aria-labelledby="manages-${esc(u.id)}">${checks}</div>
        <p class="hint">Runs the rooms of the ticked doctors.</p>`}
      <label>New password</label><input type="password" data-field="password" autocomplete="new-password" placeholder="Leave empty to keep" />
      <button type="button" class="remove" data-action="delete">Remove user</button>
    </article>`;
}

function renderUsers() {
  // Doctor logins are managed on the Doctors tab.
  usersEl.innerHTML = users.filter((u) => u.role !== 'doctor').map(userCard).join('') + `
    <form class="room-card" id="addUserForm">
      <h2>Add staff</h2>
      <label>Name</label><input type="text" name="name" maxlength="80" />
      <label>Username</label><input type="text" name="username" maxlength="40" autocapitalize="none" required />
      <label>Password</label><input type="password" name="password" autocomplete="new-password" minlength="8" required />
      <label>Role</label>
      <select name="role">${STAFF_ROLES.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>
      <button type="submit">Add staff</button>
    </form>`;
}

function renderClosures() {
  closureListEl.innerHTML = closures.map((c) => `
    <li data-id="${esc(c.id)}"><span><strong>${esc(dateFmt(c.date))}</strong>${c.note ? ` · ${esc(c.note)}` : ''}</span>
    <button type="button">Remove</button></li>`).join('') || '<li>No closures planned.</li>';
}

document.getElementById('closureForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    closures.push(await call('POST', '/api/closures', Object.fromEntries(new FormData(form))));
    closures.sort((a, b) => a.date.localeCompare(b.date));
    form.reset();
    renderClosures();
    toast('Closure added');
  } catch (error) {
    toast(error.message, true);
  }
});

closureListEl.addEventListener('click', async (event) => {
  const id = event.target.closest('button') && event.target.closest('[data-id]')?.dataset.id;
  if (!id) return;
  try {
    await call('DELETE', `/api/closures/${id}`);
    closures = closures.filter((c) => c.id !== id);
    renderClosures();
    toast('Closure removed');
  } catch (error) {
    toast(error.message, true);
  }
});

async function loadActivity() {
  try {
    const log = await call('GET', '/api/activity');
    document.getElementById('activityList').innerHTML = log.map((e) => `
      <li><span>${esc(e.action)} <span class="who">· ${esc(e.user)}</span></span>
      <time datetime="${esc(e.at)}">${esc(new Date(e.at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</time></li>`).join('') || '<li>Nothing yet.</li>';
  } catch (error) {
    toast(error.message, true);
  }
}

function renderRooms() {
  const standby = doctors.filter((d) => !rooms.some((r) => r.doctorId === d.id));
  document.getElementById('standby').textContent = standby.length ? `On standby: ${standby.map((d) => d.name).join(', ')}` : 'Every doctor is in a room.';
  roomListEl.innerHTML = rooms.map((r) => `
    <article class="room-card" data-id="${esc(r.id)}">
      <h2>${esc(r.name)}</h2>
      <label>Doctor in this room</label>
      <select data-field="doctorId"><option value="">No doctor</option>${doctors.map((d) => `<option value="${esc(d.id)}"${d.id === r.doctorId ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
      <p class="hint">Their login controls this room.</p>
      <label>Room name</label><input type="text" data-field="name" value="${esc(r.name)}" maxlength="80" />
      <label>Department</label><input type="text" data-field="department" value="${esc(r.department)}" maxlength="80" placeholder="e.g. Pediatrics" />
      <label>Colour on the TV</label>
      <select data-field="color">${COLORS.map((c) => `<option value="${c}"${c === r.color ? ' selected' : ''}>${c}</option>`).join('')}</select>
      <button type="button" class="remove" data-action="delete">Remove room</button>
    </article>`).join('') + '<button type="button" class="add-card" data-action="add">+ Add a room</button>';
}

roomListEl.addEventListener('change', async (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const id = event.target.closest('[data-id]').dataset.id;
  try {
    const updated = await call('PATCH', `/api/rooms/${id}`, { [field]: event.target.value });
    rooms = rooms.map((r) => (r.id === id ? updated : r));
    renderRooms();
    toast('Saved');
  } catch (error) {
    toast(error.message, true);
  }
});

roomListEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  try {
    if (button.dataset.action === 'add') {
      rooms.push(await call('POST', '/api/rooms', {}));
      renderRooms();
      return toast('Room added. Pick its doctor.');
    }
    const room = rooms.find((r) => r.id === button.closest('[data-id]').dataset.id);
    if (!confirmTap(button, `Tap again to remove ${room.name}`)) return;
    await call('DELETE', `/api/rooms/${room.id}`);
    rooms = rooms.filter((r) => r !== room);
    renderRooms();
    toast(`${room.name} removed`);
  } catch (error) {
    toast(error.message, true);
  }
});

async function save(kind, id, patch) {
  try {
    const updated = await call('PATCH', `/api/${kind}/${id}`, patch);
    if (kind === 'doctors') doctors = doctors.map((d) => (d.id === id ? updated : d));
    else users = users.map((u) => (u.id === id ? updated : u));
    renderDoctors();
    renderUsers(); // user cards list doctor names
    renderRooms();
    toast('Saved');
  } catch (error) {
    toast(error.message, true);
  }
}

doctorsEl.addEventListener('change', (event) => {
  const { ufield } = event.target.dataset;
  if (ufield) return save('users', event.target.closest('[data-user]').dataset.user, { [ufield]: event.target.value });
  const field = event.target.dataset.field;
  if (!field) return;
  const value = field === 'services' ? event.target.value.split('\n').map((s) => s.trim()).filter(Boolean) : event.target.value;
  save('doctors', event.target.closest('[data-id]').dataset.id, { [field]: value });
});

doctorsEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  try {
    if (button.dataset.action === 'add') {
      const added = await call('POST', '/api/doctors', {});
      doctors.push(added);
      renderDoctors();
      renderUsers();
      renderRooms();
      doctorsEl.querySelector(`[data-id="${CSS.escape(added.id)}"] [data-field="name"]`)?.select();
      return;
    }
    const card = button.closest('[data-id]');
    const id = card.dataset.id;
    const doctor = doctors.find((d) => d.id === id);
    if (button.dataset.action === 'create-login') {
      const value = (k) => card.querySelector(`[data-new="${k}"]`).value;
      users.push(await call('POST', '/api/users', { name: doctor.name, username: value('username').trim(), password: value('password'), role: 'doctor', doctorIds: [id] }));
      renderDoctors();
      return toast(`Login created for ${doctor.name}`);
    }
    if (button.dataset.action === 'delete-login') {
      const userId = button.closest('[data-user]').dataset.user;
      if (!confirmTap(button, 'Tap again to remove login')) return;
      await call('DELETE', `/api/users/${userId}`);
      users = users.filter((u) => u.id !== userId);
      renderDoctors();
      return toast('Login removed');
    }
    if (!confirmTap(button, `Tap again to remove ${doctor.name}`)) return;
    await call('DELETE', `/api/doctors/${id}`);
    users = users.filter((u) => !(u.role === 'doctor' && u.doctorIds[0] === id)); // the server removed their login too
    doctors = doctors.filter((d) => d.id !== id);
    users = users.map((u) => ({ ...u, doctorIds: u.doctorIds.filter((x) => x !== id) }));
    rooms = rooms.map((r) => (r.doctorId === id ? { ...r, doctorId: '', doctor: '' } : r));
    renderDoctors();
    renderUsers();
    renderRooms();
    toast(`${doctor.name} removed`);
  } catch (error) {
    toast(error.message, true);
  }
});

usersEl.addEventListener('change', (event) => {
  const card = event.target.closest('[data-id]');
  if (!card) return; // the add-user form saves on submit
  const user = users.find((u) => u.id === card.dataset.id);
  if (event.target.dataset.doctor) {
    const ids = [...card.querySelectorAll('[data-doctor]:checked')].map((c) => c.dataset.doctor);
    return save('users', user.id, { doctorIds: ids });
  }
  const field = event.target.dataset.field;
  if (field) save('users', user.id, { [field]: event.target.value });
});

usersEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="delete"]');
  if (!button) return;
  const user = users.find((u) => u.id === button.closest('[data-id]').dataset.id);
  if (!confirmTap(button, `Tap again to remove ${user.username}`)) return;
  try {
    await call('DELETE', `/api/users/${user.id}`);
    users = users.filter((u) => u !== user);
    renderUsers();
    toast(`${user.username} removed`);
  } catch (error) {
    toast(error.message, true);
  }
});

usersEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    const added = await call('POST', '/api/users', Object.fromEntries(new FormData(form)));
    users.push(added);
    renderUsers();
    toast(`${added.username} added. Tick the doctors they handle.`);
  } catch (error) {
    toast(error.message, true);
  }
});

announcementForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await call('PATCH', '/api/announcement', Object.fromEntries(new FormData(announcementForm)));
    toast('Announcement saved');
  } catch (error) {
    toast(error.message, true);
  }
});

document.getElementById('passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    await call('POST', '/api/password', Object.fromEntries(new FormData(form)));
    form.reset();
    toast('Password changed');
  } catch (error) {
    toast(error.message, true);
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  document.getElementById('loginError').textContent = '';
  try {
    await call('POST', '/api/login', { username: loginForm.username.value.trim(), password: loginForm.password.value });
    loginForm.reset();
    const { user } = await call('GET', '/api/session');
    showPanel(user);
  } catch (error) {
    document.getElementById('loginError').textContent = error.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await call('POST', '/api/logout').catch(() => {});
  showLogin();
});

(async () => {
  const { loggedIn, user } = await call('GET', '/api/session').catch(() => ({ loggedIn: false }));
  if (loggedIn) showPanel(user);
  else showLogin();
})();
