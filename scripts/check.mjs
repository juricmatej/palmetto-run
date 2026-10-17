// Syntax-checks the game code without running it (it needs a browser and WebGL to run).
// src/game/ holds one IIFE split across ordered files, so the game check runs on the joined source.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parts = readdirSync(join(root, 'src/game')).filter((f) => f.endsWith('.js')).sort();
const game = parts.map((f) => readFileSync(join(root, 'src/game', f), 'utf8')).join('');

const checks = [['src/game/* (' + parts.length + ' files)', game]];
// The 2D version keeps its script inline; check the last <script> block.
const legacy = readFileSync(join(root, 'legacy/palmetto-run-2d.html'), 'utf8');
checks.push(['legacy/palmetto-run-2d.html', legacy.slice(legacy.lastIndexOf('<script>') + 8, legacy.lastIndexOf('</script>'))]);

let failed = false;
for (const [file, src] of checks) {
  try {
    new vm.Script(src, { filename: file });
    console.log(`ok   ${file}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${file}\n${err.stack.split('\n').slice(0, 4).join('\n')}`);
  }
}
process.exit(failed ? 1 : 0);
