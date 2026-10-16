// Assembles the game from src/ into two outputs:
//   dist/artifact.html  the page body exactly as published as a Claude Artifact
//                       (no <!doctype>/<head>; the artifact host adds that skeleton)
//   dist/index.html     the same page wrapped in a normal HTML document, for any
//                       browser, a local server or GitHub Pages (single-player)
//   dist/2d.html        the original top-down 2D version, wrapped the same way
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const page = read('src/page.html');
for (const token of ['/*@@STYLE@@*/', '/*@@SCRIPT@@*/']) {
  if (page.split(token).length !== 2) throw new Error(`src/page.html must contain ${token} exactly once`);
}
// Function replacers: the game code contains `$` sequences that a string replacer would rewrite.
const artifact = page
  .replace('/*@@STYLE@@*/', () => read('src/style.css'))
  .replace('/*@@SCRIPT@@*/', () => read('src/game.js'));

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
console.log(`Built dist/artifact.html (${(artifact.length / 1024).toFixed(0)} KB), dist/index.html and dist/2d.html`);
