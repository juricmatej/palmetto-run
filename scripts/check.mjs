// Syntax-checks the game code without running it (it needs a browser and WebGL to run).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [['src/game.js', (s) => s]];
// The 2D version keeps its script inline; check the last <script> block.
files.push(['legacy/palmetto-run-2d.html', (s) => s.slice(s.lastIndexOf('<script>') + 8, s.lastIndexOf('</script>'))]);

let failed = false;
for (const [file, extract] of files) {
  try {
    new vm.Script(extract(readFileSync(join(root, file), 'utf8')), { filename: file });
    console.log(`ok   ${file}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${file}\n${err.stack.split('\n').slice(0, 4).join('\n')}`);
  }
}
process.exit(failed ? 1 : 0);
