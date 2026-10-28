/* Regression tests for docs/js/geom.js - the geometry the site actually ships.
 * Volumes are the recorded values for the default parameters; a change here is
 * a design change, so update the numbers deliberately.
 */
import * as G from '../docs/js/geom.js';

const P = { ...G.DEFAULTS };
const cm3 = (g) => +(G.volume(g) / 1000).toFixed(1);
const box = (g) => G.bounds(g).size.map((v) => +v.toFixed(1));

let bad = 0;
const eq = (label, got, want, tol) => {
  const ok = Array.isArray(want)
    ? got.length === want.length && got.every((v, i) => Math.abs(v - want[i]) <= tol)
    : Math.abs(got - want) <= tol;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${got}`);
  if (!ok) bad++;
};

const a = G.buildA(P);
const b = G.buildB(P);
const coupon = G.buildCoupon(P);
const tray = G.buildTray(P);
const bin = G.buildBin(P, 2, 2);
const asm = G.buildAssembly(P);
const tool = G.buildTool(P);
const L = G.layout(P);

eq('A volume', cm3(a), 260.0, 1.5);
eq('B volume', cm3(b), 165.3, 1.5);
eq('coupon volume', cm3(coupon), 8.3, 0.5);
eq('tray volume', cm3(tray.geom), 186.7, 1.5);
eq('bin volume', cm3(bin.geom), 20.2, 0.5);
eq('assembly volume', cm3(asm), 425.3, 3);

eq('single tool volume', cm3(tool), 36.5, 1.0);
eq('single tool size', box(tool), [29.2, 163.2, 28.0], 0.2);
eq('A size', box(a), [151.6, 228.6, 28.0], 0.2);
eq('B size', box(b), [185.0, 228.6, 28.0], 0.2);
eq('tray size', box(tray.geom), [352.5, 211.6, 28.0], 0.5);

// derived pocket widths: pitch - wall, so thin walls really do buy space
eq('handle width', +L.aHandle.toFixed(1), 28.4, 0.1);
eq('jaw width', +L.aJaw.toFixed(1), 18.4, 0.1);
eq('modules fit the drawer', +(L.WA + P.GAP + L.WB).toFixed(1), 338.6, 0.1);
eq('tray halves fit a bed', +tray.pieceSize[0].toFixed(1), 170.5, 2);

// the floorless part must not have a floor: volume well under a floored one
const flooredA = G.buildA({ ...P, FLOOR: 2.4 });
eq('floor costs plastic', cm3(flooredA) > cm3(a) + 20, true, 0);

const stl = G.toSTL(a);
eq('STL triangles', new DataView(stl).getUint32(80, true), G.triangles(a).length, 0);

console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
process.exit(bad ? 1 : 0);
