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
    const home = await fetch(`${base}/`);
    const homeHtml = await home.text();
    const version = home.headers.get('x-app-version');
    assert.ok(version);
    assert.ok(homeHtml.includes(`/original.css?v=${version}`));
    assert.ok(homeHtml.includes(`/menu.js?v=${version}`));

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

    // Roles: a doctor runs only their own room, and only the queue fields.
    const asUser = async (username, password) => (await fetch(`${base}/api/login`, json('POST', { username, password }))).headers.get('set-cookie')?.split(';')[0];
    assert.strictEqual((await fetch(`${base}/api/users`, json('POST', { username: 'drkath', password: 'kath-pass-1', role: 'doctor', doctorIds: ['kath'] }, cookie))).status, 201);
    assert.strictEqual((await fetch(`${base}/api/users`, json('POST', { username: 'admin', password: 'whatever-1' }, cookie))).status, 400);
    const kath = await asUser('drkath', 'kath-pass-1');
    assert.ok(kath);
    assert.strictEqual((await fetch(`${base}/api/rooms/room2`, json('PATCH', { number: 3 }, kath))).status, 200);
    assert.strictEqual((await fetch(`${base}/api/rooms/room1`, json('PATCH', { number: 3 }, kath))).status, 403);
    assert.strictEqual((await fetch(`${base}/api/rooms/room2`, json('PATCH', { department: 'X' }, kath))).status, 403);
    assert.strictEqual((await fetch(`${base}/api/users`, json('POST', { username: 'sneaky', password: 'sneaky-pass' }, kath))).status, 403);
    assert.strictEqual((await fetch(`${base}/api/rooms/room2`, json('PATCH', { number: 0 }, cookie))).status, 200);

    // A staff admin manages rooms and doctor logins, but not staff accounts.
    assert.strictEqual((await fetch(`${base}/api/users`, json('POST', { username: 'boss2', password: 'boss-pass-1', role: 'admin' }, cookie))).status, 201);
    const boss = await asUser('boss2', 'boss-pass-1');
    assert.strictEqual((await fetch(`${base}/api/rooms/room1`, json('PATCH', { doctorId: 'kath' }, boss))).status, 200);
    assert.strictEqual((await fetch(`${base}/api/rooms/room1`, json('PATCH', { doctorId: 'ken' }, boss))).status, 200);
    assert.strictEqual((await fetch(`${base}/api/users`, json('POST', { username: 'drken', password: 'ken-pass-1', role: 'doctor', doctorIds: ['ken'] }, boss))).status, 201);
    assert.strictEqual((await fetch(`${base}/api/users`, json('POST', { username: 'boss3', password: 'boss-pass-1', role: 'admin' }, boss))).status, 403);

    // Room messages (doctors may set their own), closures, and the activity log.
    assert.strictEqual((await (await fetch(`${base}/api/rooms/room2`, json('PATCH', { message: 'Back at 1 PM' }, kath))).json()).message, 'Back at 1 PM');
    assert.strictEqual((await fetch(`${base}/api/closures`, json('POST', { date: '2026-12-25', note: 'Christmas' }, kath))).status, 403);
    assert.strictEqual((await fetch(`${base}/api/closures`, json('POST', { date: 'soon' }, cookie))).status, 400);
    assert.strictEqual((await fetch(`${base}/api/closures`, json('POST', { date: '2026-12-25', note: 'Christmas' }, cookie))).status, 201);
    assert.strictEqual((await fetch(`${base}/api/activity`, { headers: { cookie: kath } })).status, 403);
    const log = await (await fetch(`${base}/api/activity`, { headers: { cookie } })).json();
    assert.ok(log.some((e) => e.action === 'Room 2: message “Back at 1 PM”'));

        // The two Mirandas stay: no removal, and only their schedule changes.
    assert.strictEqual((await fetch(`${base}/api/doctors/ken`, { method: 'DELETE', headers: { cookie } })).status, 400);
    const ken = await (await fetch(`${base}/api/doctors/ken`, json('PATCH', { name: 'Someone else', schedule: 'Mon 9-12' }, cookie))).json();
    assert.deepStrictEqual([ken.name, ken.schedule], ['Dr. Kenneth Miranda', 'Mon 9-12']);
    const site = await (await fetch(`${base}/api/site`)).json();
    assert.deepStrictEqual(site.doctors.map((d) => d.id), ['ken', 'kath']);
    assert.ok(!JSON.stringify(await (await fetch(`${base}/api/users`, { headers: { cookie } })).json()).includes('password'));

    // Polling stays cheap: ETag revalidation answers 304, and responses carry the app version.
    const first = await fetch(`${base}/api/rooms`);
    assert.ok(first.headers.get('x-app-version'));
    assert.strictEqual((await fetch(`${base}/api/rooms`, { headers: { 'if-none-match': first.headers.get('etag') } })).status, 304);
    const css = await fetch(`${base}/original.css`, { headers: { 'accept-encoding': 'gzip' } });
    assert.strictEqual(css.headers.get('content-encoding'), 'gzip');

        const saved = JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'));
    assert.deepStrictEqual(saved.map((r) => [r.id, r.number]), [['room1', 7], ['room2', 0]]);
  } finally {
    server.close();
  }
});
