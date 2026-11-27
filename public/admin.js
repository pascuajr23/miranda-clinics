const loginView = document.getElementById('loginView');
const panelView = document.getElementById('panelView');
const loginForm = document.getElementById('loginForm');
const doctorsEl = document.getElementById('doctors');
const usersEl = document.getElementById('users');
const announcementForm = document.getElementById('announcementForm');

let me = null;
let doctors = [];
let users = [];

const call = (method, path, body) => api(method, path, body, () => showLogin('Your session ended. Please sign in again.'));
const ROLE_NAMES = { admin: 'Admin', staff: 'Staff', doctor: 'Doctor' };

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
  if (user.role === 'admin') await loadAdmin();
}

async function loadAdmin() {
  try {
    const [site, userList] = await Promise.all([call('GET', '/api/site'), call('GET', '/api/users')]);
    doctors = site.doctors;
    users = userList;
    for (const key of ['title', 'details', 'hours']) announcementForm[key].value = site.announcement[key] || '';
    renderDoctors();
    renderUsers();
  } catch (error) {
    toast(error.message, true);
  }
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
      <select data-field="role">${Object.entries(ROLE_NAMES).map(([v, n]) => `<option value="${v}"${v === u.role ? ' selected' : ''}>${n}</option>`).join('')}</select>
      ${u.role === 'admin' ? '<p class="hint">Admins run every room and manage doctors and users.</p>' : `
        <label>${u.role === 'doctor' ? 'This login is for' : 'Manages'}</label>
        <div class="checks">${checks}</div>
        <p class="hint">${u.role === 'doctor' ? 'Tick one doctor. They run only their own room.' : 'Runs the rooms of the ticked doctors.'}</p>`}
      <label>New password</label><input type="password" data-field="password" autocomplete="new-password" placeholder="Leave empty to keep" />
      <button type="button" class="remove" data-action="delete">Remove user</button>
    </article>`;
}

function renderUsers() {
  usersEl.innerHTML = users.map(userCard).join('') + `
    <form class="room-card" id="addUserForm">
      <h2>Add a user</h2>
      <label>Name</label><input type="text" name="name" maxlength="80" />
      <label>Username</label><input type="text" name="username" maxlength="40" autocapitalize="none" required />
      <label>Password</label><input type="password" name="password" autocomplete="new-password" minlength="8" required />
      <label>Role</label>
      <select name="role">${Object.entries(ROLE_NAMES).map(([v, n]) => `<option value="${v}"${v === 'staff' ? ' selected' : ''}>${n}</option>`).join('')}</select>
      <button type="submit">Add user</button>
    </form>`;
}

async function save(kind, id, patch) {
  try {
    const updated = await call('PATCH', `/api/${kind}/${id}`, patch);
    if (kind === 'doctors') doctors = doctors.map((d) => (d.id === id ? updated : d));
    else users = users.map((u) => (u.id === id ? updated : u));
    renderDoctors();
    renderUsers(); // user cards list doctor names
    toast('Saved');
  } catch (error) {
    toast(error.message, true);
  }
}

doctorsEl.addEventListener('change', (event) => {
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
      doctorsEl.querySelector(`[data-id="${CSS.escape(added.id)}"] [data-field="name"]`)?.select();
      return;
    }
    const id = button.closest('[data-id]').dataset.id;
    const doctor = doctors.find((d) => d.id === id);
    if (!confirmTap(button, `Tap again to remove ${doctor.name}`)) return;
    await call('DELETE', `/api/doctors/${id}`);
    doctors = doctors.filter((d) => d.id !== id);
    users = users.map((u) => ({ ...u, doctorIds: u.doctorIds.filter((x) => x !== id) }));
    renderDoctors();
    renderUsers();
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
