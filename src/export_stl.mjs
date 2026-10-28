/* Write the STLs in out/ straight from the site's geometry, so the files in
 * the repo are always the same parts the generator produces.
 *   node src/export_stl.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../docs/js/geom.js';

const out = join(dirname(dirname(fileURLToPath(import.meta.url))), 'out');
mkdirSync(out, { recursive: true });
const P = { ...G.DEFAULTS };

const parts = [
  ['A_plier_comb', G.buildA(P)],
  ['B_bits_tips_tub', G.buildB(P)],
  ['fit_coupon', G.buildCoupon(P)],
  ['parts_tray_split', G.buildTray(P).geom],
  ['bin_2x2', G.buildBin(P, 2, 2).geom],
  ['tub_spring_tools', G.buildTub(P)],
  ['rack_1_pliers', G.buildRack({ ...P, rackPart: 1 })],
  ['rack_2_cutters', G.buildRack({ ...P, rackPart: 2 })],
  ['drawer1_left', G.buildStack({ ...P, stackSet: 1, stackHalf: 1 })],
  ['drawer1_right', G.buildStack({ ...P, stackSet: 1, stackHalf: 2 })],
  ['drawer2_left', G.buildStack({ ...P, stackSet: 2, stackHalf: 1 })],
  ['drawer2_right', G.buildStack({ ...P, stackSet: 2, stackHalf: 2 })],
  ['one_drawer_bottom_left', G.buildStack({ ...P, stackSet: 3, stackH: 26, stackHalf: 1 })],
  ['one_drawer_bottom_right', G.buildStack({ ...P, stackSet: 3, stackH: 26, stackHalf: 2 })],
  ['one_drawer_top_left', G.buildStack({ ...P, stackSet: 4, stackH: 18, stackHalf: 1 })],
  ['one_drawer_top_right', G.buildStack({ ...P, stackSet: 4, stackH: 18, stackHalf: 2 })],
];

for (const [name, geom] of parts) {
  const buf = Buffer.from(G.toSTL(geom));
  writeFileSync(join(out, `${name}.stl`), buf);
  console.log(`${name.padEnd(18)} ${(G.volume(geom) / 1000).toFixed(1)} cm3  ${(buf.length / 1024).toFixed(0)} kB`);
}
