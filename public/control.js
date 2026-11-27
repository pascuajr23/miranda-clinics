const roomsEl = document.getElementById('rooms');
const panelView = document.getElementById('panelView');

let rooms = [];
let me = null;
let offline = false;

const pad = (n) => String(n).padStart(3, '0');
const call = (method, path, body) => api(method, path, body, () => location.assign('/admin'));
const isAdmin = () => me?.role === 'admin';
// Doctors see their own room, staff the rooms of their doctors (the server enforces the same rule).
const mine = (list) => (isAdmin() ? list : list.filter((r) => r.doctorId && me.doctorIds.includes(r.doctorId)));

async function showPanel() {
  panelView.classList.remove('hidden');
  document.getElementById('resetAllBtn').textContent = isAdmin() ? 'Reset all to 000' : 'Reset my rooms to 000';
  await refresh(true);
}

function roomCard(r) {
  // Original control panel markup (classes from original.css); "room" + data-* hooks drive the handlers below.
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
        <input name="number" type="number" min="0" max="9999" placeholder="Enter new number" aria-label="New number" required />
        <button type="submit">Override</button>
      </form>
      <form class="override-row" data-action="message">
        <input name="message" type="text" maxlength="60" value="${esc(r.message || '')}" placeholder="Message on TV" aria-label="Message on TV" />
        <button type="submit">${r.message ? 'Update' : 'Show'}</button>
      </form>
    </article>`;
}

// Room setup (name, doctor, colour, add/remove) lives in Admin → Rooms.
function render() {
  roomsEl.innerHTML = rooms.map(roomCard).join('') ||
    (isAdmin() ? '<p>No rooms yet. Add them in Admin → Rooms.</p>' : '<p>No room is assigned to you yet. Ask the admin to put your doctor in a room.</p>');
}

async function refresh(force = false) {
  // Don't clobber a field someone is typing in; the next poll will catch up.
  if (!force && roomsEl.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  try {
    const latest = mine(await call('GET', '/api/rooms'));
    if (offline) { offline = false; toast('Back online'); }
    if (!force && JSON.stringify(latest) === JSON.stringify(rooms)) return;
    rooms = latest;
    render();
  } catch (error) {
    // Polls every 5 s: say it once, keep the last numbers on screen, and keep retrying.
    if (!offline) toast(navigator.onLine ? `Can't reach the server. Retrying…` : 'You are offline. Retrying…', true);
    offline = true;
  }
}

async function updateRoom(id, patch, message) {
  const card = roomsEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  card?.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    const updated = await call('PATCH', `/api/rooms/${id}`, patch);
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

  if (!room) return;

  if (action === 'next') updateRoom(id, { number: room.number + 1 }, (r) => `${r.name}: now serving ${pad(r.number)}`);
  if (action === 'prev') updateRoom(id, { number: Math.max(room.number - 1, 0) }, (r) => `${r.name}: back to ${pad(r.number)}`);
  if (action === 'toggle') updateRoom(id, { doctorIn: !room.doctorIn }, (r) => `${r.doctor || r.name} is ${r.doctorIn ? 'in' : 'out'}`);
});

roomsEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = event.target.closest('.room').dataset.id;
  if (event.target.dataset.action === 'message') {
    return updateRoom(id, { message: event.target.message.value }, (r) => (r.message ? `TV shows: ${r.message}` : 'Message cleared'));
  }
  const number = Number(event.target.number.value);
  if (!Number.isInteger(number) || number < 0) return toast('Enter a whole number, 0 or more.', true);
  updateRoom(id, { number }, (r) => `${r.name}: now serving ${pad(r.number)}`);
});

document.getElementById('resetAllBtn').addEventListener('click', async (event) => {
  if (!confirmTap(event.currentTarget, 'Tap again to reset all')) return;
  try {
    await Promise.all(rooms.map((r) => call('PATCH', `/api/rooms/${r.id}`, { number: 0 })));
    await refresh(true);
    toast('All rooms reset to 000');
  } catch (error) {
    toast(error.message, true);
  }
});

(async () => {
  const { loggedIn, user } = await call('GET', '/api/session').catch(() => ({ loggedIn: false }));
  if (!loggedIn) return location.assign('/admin');
  me = user;
  showPanel();
  // Keeps two phones/tablets in sync if both doctors use the panel at once.
  setInterval(() => !panelView.classList.contains('hidden') && refresh(), 5000);
})();
