// Plays the built game in headless Chrome and reports every console error and uncaught exception.
//   node scripts/smoke.mjs [--secs 8] [--pre "js"] [--keys "KeyW*2,KeyE,wait*1"] [--eval "js"] [--shot out.png] [--size 1280x800]
// --keys runs left to right after the start screen: Code*seconds holds a key (KeyW, Space, ShiftLeft...), KeyW+ShiftLeft*2 holds both,
// a bare Code taps it, click*seconds holds the left mouse button on the canvas, wait*seconds idles.
// The page loads with ?debug, so --pre (runs right after the start screen) and --eval (runs at the end) can use window.__pr.
// Exits 1 if anything was logged as an error. Needs Node 22+ and Google Chrome. Uses the GPU (about 60 fps);
// SMOKE_SW=1 forces software rendering, which runs near 6 fps, so game time then moves at about a fifth of real time.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: o } = parseArgs({ options: {
  secs: { type: 'string', default: '8' }, pre: { type: 'string', multiple: true, default: [] }, keys: { type: 'string', default: '' }, eval: { type: 'string', multiple: true, default: [] },
  shot: { type: 'string' }, size: { type: 'string', default: '1280x800' }, 'no-build': { type: 'boolean' },
} });
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
if (!o['no-build'] && spawnSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' }).status) process.exit(1);

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname.replace(/\.\.+/g, '');
  try { const body = await readFile(join(dist, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end(); }
}).listen(0);
await new Promise((r) => server.once('listening', r));

const chromeBin = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const profile = await mkdtemp(join(tmpdir(), 'pr-smoke-'));
const [w, h] = o.size.split('x').map(Number);
const chrome = spawn(chromeBin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${w},${h}`,
  ...(process.env.SMOKE_SW ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']), '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
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

await Promise.all(['Runtime.enable', 'Log.enable', 'Page.enable'].map((m) => cdp(m)));
await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html?debug` });
await sleep(4);
console.log('start screen:', await js(`!document.getElementById('start').hidden`));
await js(`document.getElementById('startForm').requestSubmit(), 'ok'`);
await sleep(1);
for (const e of o.pre) console.log(`pre ${e} =>`, JSON.stringify(await js(e)));
const key = (type, code) => cdp('Input.dispatchKeyEvent', { type, code, key: code.replace(/^Key|^Digit/, ''), windowsVirtualKeyCode: 0 });
const mouse = (type) => cdp('Input.dispatchMouseEvent', { type, x: w / 2, y: h / 2, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
let spent = 0;
for (const step of o.keys.split(',').map((s) => s.trim()).filter(Boolean)) {
  const [code, t = '0.1'] = step.split('*'); const s = Number(t); spent += s;
  if (code === 'wait') await sleep(s);
  else if (code === 'click') { await mouse('mousePressed'); await sleep(s); await mouse('mouseReleased'); }
  else { const codes = code.split('+'); for (const c of codes) await key('rawKeyDown', c); await sleep(s); for (const c of codes) await key('keyUp', c); }
}
await sleep(Math.max(0.5, Number(o.secs) - spent));
console.log('playing:', await js(`document.getElementById('start').hidden`));
for (const e of o.eval) console.log(`eval ${e} =>`, JSON.stringify(await js(e)));
if (o.shot) { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(o.shot, Buffer.from(r.result.data, 'base64')); console.log('screenshot:', o.shot); }
console.log(`errors: ${errors.size}`);
for (const [m, n] of errors) console.log(`  ${n}x ${m.split('\n').slice(0, 3).join(' | ')}`);
ws.close(); chrome.kill(); server.close(); await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(errors.size ? 1 : 0);
