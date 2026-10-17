// Takes the canonical map tour: 12 screenshots from fixed camera spots plus the draw-call
// and triangle counts of each, in one headless Chrome run.
//   node scripts/tour.mjs [--out .work-tmp/tour] [--secs 2.5] [--shots 1,3,12] [--size 1280x800] [--no-build]
// --shots picks a subset by number (or name substring); default is every shot.
// Needs Node 22+ and Google Chrome, same as scripts/smoke.mjs.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: o } = parseArgs({ options: {
  out: { type: 'string', default: '.work-tmp/tour' }, secs: { type: 'string', default: '2.5' }, shots: { type: 'string', default: '' },
  size: { type: 'string', default: '1280x800' }, 'no-build': { type: 'boolean' },
} });
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
if (!o['no-build'] && spawnSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' }).status) process.exit(1);

// The fixed tour. Keep names and coordinates stable: map tickets diff against them.
const DAY = `document.getElementById('setTime').value='auto';document.getElementById('setTime').dispatchEvent(new Event('change'));`;
const SHOTS = [
  { n: 1, name: 'night-downtown', pre: `__pr.setClock(0.9);__pr.setWeather('clear');__pr.view(1887,1887,0.8,0.25)` },
  { n: 2, name: 'day-downtown', pre: `${DAY}__pr.setClock(0.5);__pr.setWeather('clear');__pr.view(1887,1887,0.8,0.25)` },
  { n: 3, name: 'day-avenue', pre: `${DAY}__pr.setClock(0.5);__pr.view(1380,1820,-0.9,0.35)` },
  { n: 4, name: 'day-midtown', pre: `${DAY}__pr.setClock(0.5);__pr.view(1060,620,0.55,0.25)` },
  { n: 5, name: 'day-suburb', pre: `${DAY}__pr.setClock(0.5);__pr.view(2820,620,0.5,0.25)` },
  { n: 6, name: 'day-hood', pre: `${DAY}__pr.setClock(0.5);__pr.view(3000,3000,0.8,0.3)` },
  { n: 7, name: 'day-docks', pre: `${DAY}__pr.setClock(0.5);__pr.view(500,1500,0,0.25)` },
  { n: 8, name: 'day-airport', pre: `${DAY}__pr.setClock(0.5);__pr.view(3700,1350,0,0.25)` },
  { n: 9, name: 'day-beach', pre: `${DAY}__pr.setClock(0.5);__pr.view(2050,4480,1.2,0.3)` },
  { n: 10, name: 'day-hills', pre: `${DAY}__pr.setClock(0.5);__pr.view(2350,-450,0.9,0.3)` },
  { n: 11, name: 'night-beach', pre: `__pr.setClock(0.9);__pr.setWeather('clear');__pr.view(2100,4500,1.0,0.3)` },
  { n: 12, name: 'phone-map', keys: 'KeyT', pre: `__pr.mapTest.zoom(1);[...document.querySelectorAll('#phHome button')].find(b=>/^Map/.test(b.textContent))?.click()` },
];
const want = o.shots.split(',').map((s) => s.trim()).filter(Boolean);
const shots = want.length ? SHOTS.filter((s) => want.some((w) => String(s.n) === w || s.name.includes(w))) : SHOTS;
if (!shots.length) { console.error('tour: no shots match', o.shots); process.exit(1); }
const outDir = join(root, o.out);
await mkdir(outDir, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname.replace(/\.\.+/g, '');
  try { const body = await readFile(join(dist, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end(); }
}).listen(0);
await new Promise((r) => server.once('listening', r));

const chromeBin = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const profile = await mkdtemp(join(tmpdir(), 'pr-tour-'));
const [w, h] = o.size.split('x').map(Number);
const chrome = spawn(chromeBin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${w},${h}`,
  ...(process.env.SMOKE_SW ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']),
  '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const bye = () => { try { chrome.kill('SIGKILL'); } catch {} };
process.on('exit', bye);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => process.exit(130));
setTimeout(() => { console.error('tour: hard timeout'); process.exit(1); }, shots.length * (Number(o.secs) + 10) * 1000 + 120000).unref();
let port;
for (let i = 0; i < 100 && !port; i++) { await sleep(0.1); try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0; const waiting = new Map(); const errors = new Map();
const err = (m) => errors.set(m, (errors.get(m) || 0) + 1);
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) { waiting.get(m.id)?.(m); return; }
  if (m.method === 'Runtime.exceptionThrown') err(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') err(m.params.args.map((a) => a.description || a.value).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/\/ws\b|favicon/.test(m.params.entry.url || '')) err(`${m.params.entry.text} ${m.params.entry.url || ''}`);
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.exceptionDetails ? `THREW ${r.result.exceptionDetails.exception?.description}` : r.result?.result?.value; };
const key = (type, code) => cdp('Input.dispatchKeyEvent', { type, code, key: code.replace(/^Key|^Digit/, ''), windowsVirtualKeyCode: 0 });

await Promise.all(['Runtime.enable', 'Log.enable', 'Page.enable'].map((m) => cdp(m)));
await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html?debug` });
await sleep(4);
if (!await js(`!document.getElementById('start').hidden`)) { console.error('tour: start screen never showed'); process.exit(1); }
await js(`document.getElementById('startForm').requestSubmit(), 'ok'`);
await sleep(1);

for (const s of shots) {
  if (s.keys) for (const c of s.keys.split(',')) { await key('rawKeyDown', c); await sleep(0.1); await key('keyUp', c); }
  const r = await js(s.pre);
  if (typeof r === 'string' && r.startsWith('THREW')) { console.error(`tour: shot ${s.n} pre threw: ${r}`); continue; }
  await sleep(Number(o.secs));
  const stats = await js(`[__pr.calls,__pr.tris]`);
  const png = await cdp('Page.captureScreenshot', { format: 'png' });
  const file = join(outDir, `${String(s.n).padStart(2, '0')}-${s.name}.png`);
  await writeFile(file, Buffer.from(png.result.data, 'base64'));
  console.log(`${String(s.n).padStart(2, '0')} ${s.name.padEnd(16)} calls ${stats?.[0] ?? '?'} tris ${stats?.[1] ?? '?'} -> ${file}`);
}
console.log(`errors: ${errors.size}`);
for (const [m, n] of errors) console.log(`  ${n}x ${m.split('\n').slice(0, 3).join(' | ')}`);
ws.close(); chrome.kill(); server.close(); await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(errors.size ? 1 : 0);
