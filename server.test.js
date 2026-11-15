const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ADMIN_PASSWORD = 'test-pass';
process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-')), 'rooms.json');
const server = require('./server');

test('queue API: public read, protected writes, add/edit/delete rooms', async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  const json = (method, body, cookie) => ({ method, headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }) }, body: JSON.stringify(body) });

  try {
    const seeded = await (await fetch(`${base}/api/rooms`)).json();
    assert.deepStrictEqual(seeded.map((r) => r.id), ['room1', 'room2']);

    assert.strictEqual((await fetch(`${base}/api/rooms/room1`, json('PATCH', { number: 5 }))).status, 401);
    assert.strictEqual((await fetch(`${base}/api/login`, json('POST', { username: 'admin', password: 'nope' }))).status, 401);

    const login = await fetch(`${base}/api/login`, json('POST', { username: 'admin', password: 'test-pass' }));
    const cookie = login.headers.get('set-cookie').split(';')[0];

    const updated = await (await fetch(`${base}/api/rooms/room1`, json('PATCH', { number: 7, doctorIn: true }, cookie))).json();
    assert.strictEqual(updated.number, 7);
    assert.strictEqual((await fetch(`${base}/api/rooms/room1`, json('PATCH', { number: -1 }, cookie))).status, 400);
    assert.strictEqual((await fetch(`${base}/api/rooms/room1`, json('PATCH', { color: 'red' }, cookie))).status, 400);
    assert.strictEqual((await (await fetch(`${base}/api/rooms/room1`, json('PATCH', { color: 'green' }, cookie))).json()).color, 'green');

    const added = await (await fetch(`${base}/api/rooms`, json('POST', { department: 'OB-GYN' }, cookie))).json();
    assert.strictEqual(added.name, 'Room 3');
    assert.strictEqual((await fetch(`${base}/api/rooms/${added.id}`, { method: 'DELETE', headers: { cookie } })).status, 204);

    const saved = JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'));
    assert.deepStrictEqual(saved.map((r) => [r.id, r.number]), [['room1', 7], ['room2', 0]]);
  } finally {
    server.close();
  }
});
