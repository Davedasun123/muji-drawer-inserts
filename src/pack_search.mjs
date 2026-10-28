/* Re-pack a drawer cell list as tightly as possible.
 *   node src/pack_search.mjs        -> prints a STACK_D2 block to paste back
 * Cells that already carry x/y are stripped first, so this is safe to re-run.
 */
import * as G from '../docs/js/geom.js';

const P = { ...G.DEFAULTS };
const W = P.stackW; const wall = P.WALL; const inner = W - 2 * wall;
const SET = Number(process.argv[2] || 2);
const cells = G.STACK_SETS[SET].map(({ n, w, d, note }) => ({ n, w, d, note }));

function pack(order) {
  const placed = [];
  const hits = (x, y, w, d) => placed.some((p) => x < p.x + p.w + wall
    && p.x < x + w + wall && y < p.y + p.d + wall && p.y < y + d + wall);
  let bottom = 0;
  for (const c of order) {
    let best = null;
    for (const [w, d, rot] of [[c.w, c.d, 0], [c.d, c.w, 90]]) {
      if (w > inner) continue;
      for (let y = wall; y <= bottom + wall && !best; y++) {
        for (let x = wall; x + w <= W - wall; x++) {
          if (!hits(x, y, w, d)) { best = { ...c, x, y, w, d, rot }; break; }
        }
      }
      if (best) break;
    }
    if (!best) return { D: Infinity };
    placed.push(best);
    bottom = Math.max(bottom, best.y + best.d + wall);
  }
  return { placed, D: bottom + wall };
}

const ITER = Number(process.argv[3] || 4000);
let best = { D: Infinity };
for (let i = 0; i < ITER; i++) {
  const r = pack([...cells].sort(() => Math.random() - 0.5));
  if (r.D < best.D) best = r;
}

const sorted = best.placed.sort((a, b) => (a.y - b.y) || (a.x - b.x));
const used = sorted.reduce((a, c) => a + c.w * c.d, 0);
console.log(`// ${(100 * used / (W * best.D)).toFixed(0)}% fill, ${best.D.toFixed(0)} mm deep\n`);
console.log(`export const STACK_SET_${SET} = [`);
for (const c of sorted) {
  console.log(`  { n: '${c.n}', x: ${c.x.toFixed(1)}, y: ${c.y.toFixed(1)}, w: ${c.w}, d: ${c.d}, note: '${c.note}' },`);
}
console.log('];');
