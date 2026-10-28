/* Turn traced tool outlines into one printed cup per tool.
 *   python src/trace_tools.py tools/photo_01.jpg    -> tools/tools_01.json
 *   node src/build_tools.mjs                        -> out/tools/*.stl
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as J from '@jscad/modeling';
import * as G from '../docs/js/geom.js';

const JSCAD = J.default ?? J;
const { booleans, extrusions, geometries, transforms } = JSCAD;
const { geom2 } = geometries;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SET = process.argv[2] || 'tools_01';

// measured thickness per tool, in placement order (left to right on the mat)
const THICKNESS = { tools_01: [15, 16, 10, 10, 10] }[SET];
const FLOOR = 1.2;      // a cup has to hold the tool when you lift it
const RIM = 3;          // tool sits this far below the rim - enough to pinch it out

const ccw = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s < 0 ? pts.slice().reverse() : pts;
};
const prism = (pts, z0, z1) => transforms.translate([0, 0, z0],
  extrusions.extrudeLinear({ height: z1 - z0 }, geom2.fromPoints(ccw(pts))));

const tools = JSON.parse(readFileSync(join(root, 'tools', `${SET}.json`), 'utf8'));
const outDir = join(root, 'out', 'tools');
mkdirSync(outDir, { recursive: true });

const manifest = [];
for (const t of tools) {
  const th = THICKNESS[t.index - 1] ?? 12;
  const H = th + RIM;
  const outer = prism(t.outer, 0, H);
  const pocket = prism(t.pocket, FLOOR, H + 1);
  const cup = booleans.subtract(outer, pocket);
  const stl = Buffer.from(G.toSTL(cup));
  const name = `tool_${String(t.index).padStart(2, '0')}`;
  writeFileSync(join(outDir, `${name}.stl`), stl);
  const b = G.bounds(cup);
  manifest.push({ name, h: H, size: b.size.map((v) => +v.toFixed(1)) });
  console.log(`${name}  ${b.size[0].toFixed(0)} x ${b.size[1].toFixed(0)} x ${H} mm   `
    + `${(G.volume(cup) / 1000).toFixed(1)} cm3  ${(stl.length / 1024).toFixed(0)} kB`);
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
