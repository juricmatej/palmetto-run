// Assembles the game from src/ into two outputs:
//   dist/artifact.html  the page body exactly as published as a Claude Artifact
//                       (no <!doctype>/<head>; the artifact host adds that skeleton)
//   dist/index.html     the same page wrapped in a normal HTML document, for any
//                       browser, a local server or GitHub Pages (single-player)
//   dist/2d.html        the original top-down 2D version, wrapped the same way
//   dist/version.json   build id; the hosted game polls it and offers a reload when it changes
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const page = read('src/page.html');
for (const token of ['/*@@STYLE@@*/', '/*@@SCRIPT@@*/']) {
  if (page.split(token).length !== 2) throw new Error(`src/page.html must contain ${token} exactly once`);
}
const css = read('src/style.css'), js = read('src/game.js');
if (js.split('__BUILD_VERSION__').length !== 2) throw new Error('src/game.js must contain __BUILD_VERSION__ exactly once');
const version = createHash('sha256').update(page).update(css).update(js).digest('hex').slice(0, 12);
// Function replacers: the game code contains `$` sequences that a string replacer would rewrite.
const artifact = page
  .replace('/*@@STYLE@@*/', () => css)
  .replace('/*@@SCRIPT@@*/', () => js.replace('__BUILD_VERSION__', version));

const wrap = (body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
</head>
<body>
${body}
</body>
</html>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), artifact);
writeFileSync(join(root, 'dist/index.html'), wrap(artifact));
writeFileSync(join(root, 'dist/2d.html'), wrap(read('legacy/palmetto-run-2d.html')));
writeFileSync(join(root, 'dist/version.json'), JSON.stringify({ v: version }) + '\n');
console.log(`Built version ${version}: dist/artifact.html (${(artifact.length / 1024).toFixed(0)} KB), dist/index.html, dist/2d.html`);
