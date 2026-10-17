// End-to-end test for the multiplayer lobby (worker/index.js) against a local wrangler dev server.
//   node scripts/lobby.mjs   (also npm run lobby:test)
// Starts wrangler on a free port, waits for /ws to answer 426, then checks, in order: hello shape,
// presence relay both ways, malformed and oversized messages ignored, the leave broadcast, the latest
// presence in a fresh hello, per-room isolation (?room= clients never see the default city), and the
// 32 player limit (the 33rd connection gets HTTP 503).
// Needs Node 22+ (global WebSocket, fetch, net). Skips with exit 0 when wrangler is not installed.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { connect as netConnect, createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const bin = join(root, 'node_modules', '.bin', 'wrangler');

if (!existsSync(join(root, 'node_modules', 'wrangler')) || !existsSync(bin)) {
  console.log('lobby: wrangler not installed, skipping (run npm install)');
  process.exit(0);
}

// The worker serves dist/, so the build must exist before wrangler starts.
if (spawnSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' }).status) process.exit(1);

const port = await new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

// wrangler and its workerd child run in their own process group so one kill stops both.
let child = null, exited = null;
const stop = (sig) => { if (child) { try { process.kill(-child.pid, sig); } catch {} } };
process.on('exit', () => stop('SIGKILL'));
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stop('SIGTERM'); process.exit(130); });
setTimeout(() => { console.error('lobby: hard timeout, giving up'); stop('SIGTERM'); process.exit(1); }, 240000);
mkdirSync(join(root, '.work-tmp'), { recursive: true });
child = spawn(bin, ['dev', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', join(root, '.work-tmp', 'lobby-state')], { cwd: root, stdio: 'ignore', detached: true });
child.unref();
child.on('exit', (code) => { exited = code; });
child.on('error', (e) => { console.error(`lobby: could not start wrangler (${e && e.message})`); stop('SIGKILL'); process.exit(1); });

// Poll until /ws is up: the worker answers a plain request with 426 (Expected a WebSocket).
let up = false;
for (let i = 0; i < 360 && !up && exited === null; i++) {
  try { const r = await fetch(`http://127.0.0.1:${port}/ws`, { signal: AbortSignal.timeout(2000) }); if (r.status === 426) up = true; } catch {}
  if (!up) await sleep(0.25);
}
if (!up) {
  console.error(exited === null ? 'lobby: wrangler dev did not answer on /ws within 90 s' : `lobby: wrangler dev exited with code ${exited}`);
  process.exit(1);
}

const wsURL = `ws://127.0.0.1:${port}/ws`;
const wsRoomURL = (room) => `${wsURL}?room=${room}`;
function connect(url = wsURL) {
  const ws = new WebSocket(url);
  const q = [], waiters = [];
  ws.addEventListener('message', (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } const w = waiters.shift(); if (w) w(m); else q.push(m); });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', (e) => rej(new Error(String((e && (e.message || (e.error && e.error.message))) || 'WebSocket error'))));
  });
  const next = (ms) => q.length ? Promise.resolve(q.shift()) : new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`no message within ${ms} ms`)), ms);
    waiters.push((m) => { clearTimeout(t); res(m); });
  });
  return { ws, ready, send: (o) => ws.send(typeof o === 'string' ? o : JSON.stringify(o)), next, drain: () => { q.length = 0; }, left: () => q.length };
}
const ok = (name, cond, extra) => {
  if (cond) { console.log(`ok   ${name}`); return; }
  console.log(`FAIL ${name}${extra ? ' (' + extra + ')' : ''}`);
  process.exit(1);
};
// Reads the status line of a raw websocket upgrade so the 503 can be checked exactly.
const upgradeStatus = () => new Promise((res) => {
  const s = netConnect(port, '127.0.0.1');
  let buf = '';
  s.on('connect', () => s.write('GET /ws HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n'));
  s.on('data', (d) => { buf += d; const m = /^HTTP\/1\.[01] (\d{3})/.exec(buf); if (m) { s.destroy(); res(Number(m[1])); } });
  s.on('error', () => { s.destroy(); res(0); });
  s.setTimeout(5000, () => { s.destroy(); res(0); });
});

try {
  const A = connect(); await A.ready;
  const hA = await A.next(8000);
  ok('A hello: {t:"hello"}, 16 character peer id, empty peers', !!hA && hA.t === 'hello' && typeof hA.peer === 'string' && hA.peer.length === 16 && Array.isArray(hA.peers) && hA.peers.length === 0, JSON.stringify(hA));

  A.send({ t: 'p', d: { x: 1, y: 2, n: 'A' } });
  await sleep(0.25);
  const B = connect(); await B.ready;
  const hB = await B.next(8000);
  const seenA = hB && Array.isArray(hB.peers) ? hB.peers.find((p) => p && p.peer === hA.peer) : null;
  ok('B hello lists A with A presence {x:1,y:2,n:"A"}', !!seenA && !!seenA.d && seenA.d.x === 1 && seenA.d.y === 2 && seenA.d.n === 'A', JSON.stringify(hB));

  B.send({ t: 'p', d: { x: 3, y: 4, n: 'B' } });
  const toA = await A.next(2000);
  ok('B presence reaches A', !!toA && toA.t === 'p' && toA.peer === hB.peer && !!toA.d && toA.d.x === 3 && toA.d.y === 4 && toA.d.n === 'B', JSON.stringify(toA));

  A.send({ t: 'p', d: { x: 5, y: 6, n: 'A' } });
  const toB = await B.next(2000);
  ok('A presence reaches B', !!toB && toB.t === 'p' && toB.peer === hA.peer && !!toB.d && toB.d.x === 5 && toB.d.y === 6 && toB.d.n === 'A', JSON.stringify(toB));

  const bad = [['missing d', { t: 'p' }], ['d an array', { t: 'p', d: [1, 2] }], ['d a string', { t: 'p', d: 'x' }], ['t not p', { t: 'x', d: { x: 1, y: 2 } }]];
  for (const [name, m] of bad) { B.drain(); A.send(m); await sleep(0.4); ok(`malformed message ignored: ${name}`, B.left() === 0, `${B.left()} relayed`); }

  B.drain();
  A.send(JSON.stringify({ t: 'p', d: { n: 'x'.repeat(9000) } }));
  await sleep(0.4);
  ok('oversized message ignored', B.left() === 0, `${B.left()} relayed`);

  A.ws.close();
  const lv = await B.next(2000);
  ok('closing A makes B receive leave for A', !!lv && lv.t === 'leave' && lv.peer === hA.peer, JSON.stringify(lv));

  const C = connect(); await C.ready;
  const hC = await C.next(8000);
  ok('fresh C hello does not list A', !!hC && hC.t === 'hello' && Array.isArray(hC.peers) && !hC.peers.some((p) => p && p.peer === hA.peer), JSON.stringify(hC));

  // Rooms: clients in different rooms never see each other, two in the same room do.
  const R1 = connect(wsRoomURL('test1')); await R1.ready;
  const hR1 = await R1.next(8000);
  ok('test1 R1 hello: empty peers', !!hR1 && hR1.t === 'hello' && Array.isArray(hR1.peers) && hR1.peers.length === 0, JSON.stringify(hR1));
  const M = connect(); await M.ready; // no ?room=, so the default city
  const hM = await M.next(8000);
  ok('default M hello does not list R1', !!hM && hM.t === 'hello' && Array.isArray(hM.peers) && !hM.peers.some((p) => p && p.peer === hR1.peer), JSON.stringify(hM));
  R1.send({ t: 'p', d: { x: 7, y: 8, n: 'R1' } });
  await sleep(0.5);
  ok('room isolation: main receives nothing from test1 within 500 ms', M.left() === 0, `${M.left()} relayed`);
  const R2 = connect(wsRoomURL('test1')); await R2.ready;
  const hR2 = await R2.next(8000);
  const seenR1 = hR2 && Array.isArray(hR2.peers) ? hR2.peers.find((p) => p && p.peer === hR1.peer) : null;
  ok('test1 R2 hello lists R1 with R1 presence {x:7,y:8,n:"R1"}', !!seenR1 && !!seenR1.d && seenR1.d.x === 7 && seenR1.d.y === 8 && seenR1.d.n === 'R1', JSON.stringify(hR2));
  R1.send({ t: 'p', d: { x: 9, y: 10, n: 'R1' } });
  const toR2 = await R2.next(2000);
  ok('test1 R1 presence reaches R2', !!toR2 && toR2.t === 'p' && toR2.peer === hR1.peer && !!toR2.d && toR2.d.x === 9 && toR2.d.y === 10, JSON.stringify(toR2));
  ok('room isolation: main still receives nothing from test1', M.left() === 0, `${M.left()} relayed`);
  R1.ws.close(); R2.ws.close(); M.ws.close();
  await sleep(0.5);

  const conns = [B, C];
  for (let i = 0; i < 30; i++) {
    const c = connect(); await c.ready;
    const h = await c.next(8000);
    ok(`player ${conns.length + 1} connected`, !!h && h.t === 'hello');
    conns.push(c);
  }

  const c33 = connect();
  const r = await Promise.race([c33.ready.then(() => ({ open: true }), () => ({ open: false })), sleep(5).then(() => ({ open: false, why: 'timeout waiting for the handshake' }))]);
  const status = r.open ? 101 : await upgradeStatus();
  ok('33rd connection refused with HTTP 503', !r.open && status === 503, r.open ? 'accepted, the lobby limit was not enforced' : `status ${status}`);

  if (r.open) c33.ws.close();
  for (const c of conns) c.ws.close();
} catch (e) {
  console.log(`FAIL ${e && e.message ? e.message : e}`);
  process.exit(1);
}
process.exit(0);
