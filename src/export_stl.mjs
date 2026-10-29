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
  ['one_drawer_bottom_left', G.buildStack({ ...P, stackSet: 1, stackH: 27, stackHalf: 1 })],
  // the left half was already printed from the pre-fix file, which ran to
  // x = +0.92; this right half starts there so the pair still makes 336 mm
  ['one_drawer_bottom_right', G.buildStack({ ...P, stackSet: 1, stackH: 27, stackHalf: 2, stackSeam: 0.845 })],
  // the top tier gets a floor: it is lifted out, so it has to carry its tools
  ['one_drawer_top_left', G.buildStack({ ...P, FLOOR: 1.2, stackSet: 2, stackH: 17, stackHalf: 1 })],
  ['one_drawer_top_right', G.buildStack({ ...P, FLOOR: 1.2, stackSet: 2, stackH: 17, stackHalf: 2 })],
];

for (const [name, geom] of parts) {
  const buf = Buffer.from(G.toSTL(geom));
  writeFileSync(join(out, `${name}.stl`), buf);
  console.log(`${name.padEnd(18)} ${(G.volume(geom) / 1000).toFixed(1)} cm3  ${(buf.length / 1024).toFixed(0)} kB`);
}
