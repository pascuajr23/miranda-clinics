const roomsEl = document.getElementById('rooms');
const panelView = document.getElementById('panelView');

let rooms = [];
let doctors = [];
let me = null;

const pad = (n) => String(n).padStart(3, '0');
const call = (method, path, body) => api(method, path, body, () => location.assign('/admin'));
const isAdmin = () => me?.role === 'admin';
// Doctors see their own room, staff the rooms of their doctors (the server enforces the same rule).
const mine = (list) => (isAdmin() ? list : list.filter((r) => r.doctorId && me.doctorIds.includes(r.doctorId)));

async function showPanel() {
  panelView.classList.remove('hidden');
  document.getElementById('resetAllBtn').textContent = isAdmin() ? 'Reset all to 000' : 'Reset my rooms to 000';
  if (isAdmin()) doctors = (await call('GET', '/api/site')).doctors;
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
      ${isAdmin() ? `<details class="details"${detailsOpen ? ' open' : ''}>
        <summary>Edit room details</summary>
        <label>Room name</label><input type="text" data-field="name" value="${esc(r.name)}" maxlength="80" />
        <label>Department</label><input type="text" data-field="department" value="${esc(r.department)}" maxlength="80" placeholder="e.g. Pediatrics" />
        <label>Doctor</label>
        <select data-field="doctorId"><option value="">No doctor</option>${doctors.map((d) => `<option value="${esc(d.id)}"${d.id === r.doctorId ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        <label>Colour on the TV</label>
        <select data-field="color">${COLORS.map((c) => `<option value="${c}"${c === color ? ' selected' : ''}>${c}</option>`).join('')}</select>
        <button type="button" data-action="reset">Reset to 000</button>
        <button type="button" class="remove" data-action="delete">Remove room</button>
      </details>` : ''}
    </article>`;
}

function render(openIds = []) {
  // Keep any "Edit room details" panels open across re-renders.
  const open = new Set([...openIds, ...[...roomsEl.querySelectorAll('details[open]')].map((d) => d.closest('.room').dataset.id)]);
  roomsEl.innerHTML = rooms.map((r) => roomCard(r, open.has(r.id))).join('') +
    (isAdmin() ? '<button type="button" class="add-room" data-action="add">+ Add a room</button>' : '') ||
    '<p>No rooms are assigned to you yet. Ask the admin to link your login to a doctor.</p>';
}

async function refresh(force = false) {
  // Don't clobber a field someone is typing in; the next poll will catch up.
  if (!force && roomsEl.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  try {
    const latest = mine(await call('GET', '/api/rooms'));
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

  if (action === 'add') {
    try {
      const added = await call('POST', '/api/rooms', {});
      rooms.push(added);
      render([added.id]);
      toast('Room added. Pick the doctor and department.');
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
      await call('DELETE', `/api/rooms/${id}`);
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
