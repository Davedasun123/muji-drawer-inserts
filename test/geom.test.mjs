/* Smoke test: the browser geometry must match the CadQuery reference model.
 *   A_plier_comb   -> 506.4 cm3 solid, 150 x 228.6 x 32
 *   B_bits_tips_tub-> 576.8 cm3 solid, 186.6 x 228.6 x 32
 */
import * as G from '../docs/js/geom.js';

const P = { ...G.DEFAULTS };
const cm3 = (g) => (G.volume(g) / 1000).toFixed(1);
const box = (g) => G.bounds(g).size.map((v) => v.toFixed(1)).join(' x ');

const a = G.buildA(P);
const b = G.buildB(P);
const c = G.buildCoupon(P);
const t = G.buildTray(P);
const bin = G.buildBin(P, 2, 2);

console.log('A   ', cm3(a), 'cm3  ', box(a));
console.log('B   ', cm3(b), 'cm3  ', box(b));
console.log('coup', cm3(c), 'cm3  ', box(c));
console.log('tray', cm3(t.geom), 'cm3  ', box(t.geom));
console.log('bin ', cm3(bin.geom), 'cm3  ', box(bin.geom));

const stl = G.toSTL(a);
console.log('STL ', (stl.byteLength / 1024).toFixed(0), 'kB  tris', new DataView(stl).getUint32(80, true));

let bad = 0;
const near = (x, y, tol) => Math.abs(x - y) <= tol;
if (!near(+cm3(a), 506.4, 3)) { console.log('FAIL volume A'); bad++; }
if (!near(+cm3(b), 576.8, 3)) { console.log('FAIL volume B'); bad++; }
if (!near(+box(a).split(' x ')[0], 150, 0.3)) { console.log('FAIL width A'); bad++; }
const asm = G.buildAssembly(P);
console.log('asm ', cm3(asm), 'cm3  ', box(asm));
if (!near(+cm3(asm), 1084, 4)) { console.log('FAIL volume assembly'); bad++; }

console.log(bad ? `${bad} check(s) failed` : 'all checks passed');
process.exit(bad ? 1 : 0);
