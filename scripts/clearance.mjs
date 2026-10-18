// Checks that every fixed point and rectangle in the city stays clear of the planned corridors
// (CUTS in src/game/00-core.js). Exits 1 if anything is closer than MIN.
//   node scripts/clearance.mjs
const MIN = 40, B = 440, R = 120, N = 10;
const cuts = [{ name: 'Palmetto Boulevard', ax: 1060, ay: 60, bx: 3150, by: 4560, half: 44 }];
// the canal is a water corridor: same test, half-width 28, only points near its line matter
const canal = { name: 'Docks canal', ax: -60, ay: 3800, bx: 760, by: 3800, half: 28 };
const door = (bi, bj) => [bi * B + R + (B - R) / 2, bj * B + R + 9];
const pts = {};
const add = (n, x, y) => { pts[n] = [x, y]; };
for (const [n, bi, bj] of [['club', 3, 3], ['store', 5, 3], ['safehouse', 4, 4], ['casino', 4, 2], ['bank', 3, 4],
  ['diner', 2, 7], ['ink', 3, 6], ['gym', 4, 6], ['pd', 5, 2], ['hosp', 2, 2], ['arcade', 3, 5], ['anchor', 0, 5],
  ['gun 1,1', 1, 1], ['gun 6,2', 6, 2], ['gun 2,6', 2, 6], ['gun 5,5', 5, 5],
  ['propLow', 6, 4], ['propMid', 7, 3], ['propBeach', 8, 8], ['propHeights', 9, 4], ['propPenth', 6, 3]]) {
  const [x, y] = door(bi, bj); add(n, x, y);
}
add('GANGHQ', 1 * B + 60, 3 * B + 60); add('KINGSHQ', 6 * B + 60, 5 * B + 60);
add('DEALER', 6 * B + R + 10, 5 * B + R + 10); add('GARAGE', 1 * B + R + 160, 3 * B + R + 9);
add('PAD', 3 * B + R + 160, 1 * B + R + 160);
const RWX = 9 * B + R + (B - R) / 2;
[0, 1, 2].forEach(i => add('jet ' + i, RWX + [0, -90, 90][i], 5 * B + R + 230));
[[1007, 1160], [1447, 1600], [1887, 2480], [1447, 4240], [3207, 4240]].forEach(([x, y], i) => add('vendor ' + i, x, y));
[[1250, 2260], [2260, 2100], [500, 1500], [3360, 2322], [1240, 4260], [4130, 1100]].forEach(([x, y], i) => add('ramp ' + i, x, y));
const rects = {
  plaza: [1000, 1880, 1320, 2200], pier: [1900, 4520, 2300, 4780], skate: [1880, 3280, 2200, 3600],
  marina: [120, 3200, 440, 3960], pit: [3240, 3240, 3560, 3560], bankblk: [1440, 1880, 1760, 2200],
  'block 2,4 plaza': [1000, 1880, 1320, 2200], 'block 4,7 skate': [1880, 3280, 2200, 3600], 'block 7,7 pit': [3240, 3240, 3560, 3560],
};
// Landmark rectangles are checked against land corridors only: the canal is meant to cut through the
// marina (it is the marina's waterway), so its rectangle is not a fault there.
const rectPts = {};
for (const k in rects) {
  const [x0, y0, x1, y1] = rects[k];
  for (let t = 0; t <= 1; t += .05) {
    rectPts[k + ' n' + t.toFixed(2)] = [x0 + (x1 - x0) * t, y0]; rectPts[k + ' s' + t.toFixed(2)] = [x0 + (x1 - x0) * t, y1];
    rectPts[k + ' w' + t.toFixed(2)] = [x0, y0 + (y1 - y0) * t]; rectPts[k + ' e' + t.toFixed(2)] = [x1, y0 + (y1 - y0) * t];
  }
}
const distToCut = (c, x, y) => {
  const dx = c.bx - c.ax, dy = c.by - c.ay, t = Math.max(0, Math.min(1, ((x - c.ax) * dx + (y - c.ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (c.ax + dx * t), y - (c.ay + dy * t));
};
let bad = 0;
for (const c of [...cuts, canal]) {
  const pool = c === canal ? pts : { ...pts, ...rectPts };
  let best = { d: Infinity, n: '' };
  for (const n in pool) { const d = distToCut(c, pool[n][0], pool[n][1]) - c.half; if (d < best.d) best = { d, n }; }
  const inside = Object.entries(pool).filter(([, p]) => distToCut(c, p[0], p[1]) < c.half).map(([n]) => n);
  console.log(`${c.name}: nearest fixed point is ${best.n} at ${best.d.toFixed(1)} units past the corridor edge (want >= ${MIN})`);
  if (best.d < MIN) { console.log(`  FAIL: ${best.n} is too close`); bad++; }
  if (inside.length) { console.log(`  FAIL: inside the corridor: ${inside.join(', ')}`); bad++; }
}
process.exit(bad ? 1 : 0);
