const roomsEl = document.getElementById('rooms');
const loginView = document.getElementById('loginView');
const panelView = document.getElementById('panelView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const toastEl = document.getElementById('toast');

let rooms = [];
let toastTimer;

const COLORS = ['blue', 'green', 'purple', 'orange']; // same list as server.js
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pad = (n) => String(n).padStart(3, '0');

// Two-tap confirm instead of window.confirm(), which some browsers and in-app views block (it then returns false).
function confirmTap(button, prompt) {
  if (button.dataset.armed) return true;
  const original = button.textContent;
  button.dataset.armed = '1';
  button.textContent = prompt;
  setTimeout(() => { delete button.dataset.armed; button.textContent = original; }, 4000);
  return false;
}

function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && path !== '/api/login') showLogin('Your session ended. Please sign in again.');
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

function showLogin(message = '') {
  loginView.classList.remove('hidden');
  panelView.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  loginError.textContent = message;
  loginForm.username.focus();
}

async function showPanel() {
  loginView.classList.add('hidden');
  panelView.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  await refresh(true);
}

function roomCard(r, detailsOpen) {
  // Original control panel markup (classes from original.css); "room" + data-* hooks drive the handlers below.
  const color = r.color || 'blue';
  return `
    <article class="room-card room" data-id="${esc(r.id)}">
      <h2>${esc(r.name)}${r.department ? ' · ' + esc(r.department) : ''}</h2>
      <label>Current Number</label>
      <input type="text" readonly value="${pad(r.number)}" aria-label="Current number" />
      <label>Doctor</label>
      <input type="text" readonly value="${esc(r.doctor)}" />
      <div class="doctor-status-row">
        <span class="doctor-status-label">Doctor status</span>
        <button type="button" class="doctor-toggle${r.doctorIn ? ' is-active' : ''}" aria-pressed="${r.doctorIn}" data-action="toggle">
          <span class="doctor-toggle__dot"></span>
          <span class="doctor-toggle__label">${r.doctorIn ? 'Doctor In' : 'Doctor Out'}</span>
        </button>
      </div>
      <div class="button-row">
        <button type="button" data-action="prev">-1</button>
        <button type="button" data-action="next">+1</button>
      </div>
      <form class="override-row" data-action="set">
        <input name="number" type="number" min="0" max="9999" placeholder="Enter new number" required />
        <button type="submit">Override</button>
      </form>
      <details class="details"${detailsOpen ? ' open' : ''}>
        <summary>Edit room details</summary>
        <label>Room name</label><input type="text" data-field="name" value="${esc(r.name)}" maxlength="80" />
        <label>Department</label><input type="text" data-field="department" value="${esc(r.department)}" maxlength="80" placeholder="e.g. Pediatrics" />
        <label>Doctor</label><input type="text" data-field="doctor" value="${esc(r.doctor)}" maxlength="80" placeholder="e.g. Dr. Juan Dela Cruz" />
        <label>Colour on the TV</label>
        <select data-field="color">${COLORS.map((c) => `<option value="${c}"${c === color ? ' selected' : ''}>${c}</option>`).join('')}</select>
        <button type="button" data-action="reset">Reset to 000</button>
        <button type="button" class="remove" data-action="delete">Remove room</button>
      </details>
    </article>`;
}

function render(openIds = []) {
  // Keep any "Edit room details" panels open across re-renders.
  const open = new Set([...openIds, ...[...roomsEl.querySelectorAll('details[open]')].map((d) => d.closest('.room').dataset.id)]);
  roomsEl.innerHTML = rooms.map((r) => roomCard(r, open.has(r.id))).join('') +
    '<button type="button" class="add-room" data-action="add">+ Add a room or doctor</button>';
}

async function refresh(force = false) {
  // Don't clobber a field someone is typing in; the next poll will catch up.
  if (!force && roomsEl.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  try {
    const latest = await api('GET', '/api/rooms');
    if (!force && JSON.stringify(latest) === JSON.stringify(rooms)) return;
    rooms = latest;
    render();
  } catch (error) {
    toast(error.message, true);
  }
}

async function updateRoom(id, patch, message) {
  const card = roomsEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  card?.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    const updated = await api('PATCH', `/api/rooms/${id}`, patch);
    rooms = rooms.map((r) => (r.id === id ? updated : r));
    render();
    if (message) toast(message(updated));
  } catch (error) {
    toast(error.message, true);
    card?.querySelectorAll('button').forEach((b) => (b.disabled = false));
  }
}

roomsEl.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const id = event.target.closest('.room')?.dataset.id;
  const room = rooms.find((r) => r.id === id);

  if (action === 'add') {
    try {
      const added = await api('POST', '/api/rooms', {});
      rooms.push(added);
      render([added.id]);
      toast('Room added. Fill in the doctor and department.');
      roomsEl.querySelector(`[data-id="${CSS.escape(added.id)}"] [data-field="doctor"]`)?.focus();
    } catch (error) {
      toast(error.message, true);
    }
    return;
  }
  if (!room) return;

  if (action === 'next') updateRoom(id, { number: room.number + 1 }, (r) => `${r.name}: now serving ${pad(r.number)}`);
  if (action === 'prev') updateRoom(id, { number: Math.max(room.number - 1, 0) }, (r) => `${r.name}: back to ${pad(r.number)}`);
  if (action === 'reset') updateRoom(id, { number: 0 }, (r) => `${r.name} reset to 000`);
  if (action === 'toggle')updateRoom(id, { doctorIn: !room.doctorIn }, (r) => `${r.doctor || r.name} is ${r.doctorIn ? 'in' : 'out'}`);
  if (action === 'delete') {
    if (!confirmTap(event.target.closest('[data-action]'), `Tap again to remove ${room.name}`)) return;
    try {
      await api('DELETE', `/api/rooms/${id}`);
      rooms = rooms.filter((r) => r.id !== id);
      render();
      toast(`${room.name} removed`);
    } catch (error) {
      toast(error.message, true);
    }
  }
});

roomsEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = event.target.closest('.room').dataset.id;
  const number = Number(event.target.number.value);
  if (!Number.isInteger(number) || number < 0) return toast('Enter a whole number, 0 or more.', true);
  updateRoom(id, { number }, (r) => `${r.name}: now serving ${pad(r.number)}`);
});

// Text fields save when you leave them (or press Enter).
roomsEl.addEventListener('change', (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const id = event.target.closest('.room').dataset.id;
  updateRoom(id, { [field]: event.target.value }, () => 'Saved');
});

document.getElementById('resetAllBtn').addEventListener('click', async (event) => {
  if (!confirmTap(event.currentTarget, 'Tap again to reset all')) return;
  try {
    await Promise.all(rooms.map((r) => api('PATCH', `/api/rooms/${r.id}`, { number: 0 })));
    await refresh(true);
    toast('All rooms reset to 000');
  } catch (error) {
    toast(error.message, true);
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  try {
    await api('POST', '/api/login', { username: loginForm.username.value.trim(), password: loginForm.password.value });
    loginForm.reset();
    showPanel();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logoutBtn.addEventListener('click', async () => {
  await api('POST', '/api/logout').catch(() => {});
  showLogin();
});

(async () => {
  const { loggedIn } = await api('GET', '/api/session').catch(() => ({ loggedIn: false }));
  if (loggedIn) showPanel();
  else showLogin();
  // Keeps two phones/tablets in sync if both doctors use the panel at once.
  setInterval(() => !panelView.classList.contains('hidden') && refresh(), 5000);
})();
