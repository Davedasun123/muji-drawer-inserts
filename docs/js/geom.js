/* Parametric geometry for the Muji drawer inserts.
 * Pure functions of a params object -> JSCAD geom3. Runs in the browser and
 * in Node (see test/geom.test.mjs), so the same code is the site and the tests.
 *
 * Units: mm. X = drawer width, Y = drawer depth (front = -Y), Z = up.
 * Modules are built with the block centre at the origin; placement happens at
 * export time in app.js.
 */
import * as J from '@jscad/modeling';

// Node resolves @jscad/modeling as CJS (all exports under .default), the
// browser import map resolves it to a real ESM bundle with named exports.
const JSCAD = J.default ?? J;
const {
  booleans, extrusions, geometries, modifiers, primitives, transforms,
} = JSCAD;
const { geom2, geom3 } = geometries;

const D90 = Math.PI / 2;
const seg = 12; // segments per rounded corner

export const DEFAULTS = {
  // drawer interior, measured
  DW: 340, DD: 230, DH: 45,
  CLR: 0.7,      // air gap per side
  WALL: 1.6,     // every wall between pockets - thin on purpose
  FLOOR: 0,      // 0 = no floor at all, the drawer is the floor
  MOD_H: 28,     // block height
  R_OUT: 5,      // outer corner radius (clamped: a big radius eats thin rims)
  GAP: 2,        // gap between the two modules
  // module A - pliers. pocket width = pitch - WALL, so thin walls widen it
  aCount: 5, aPitch: 30, aJawInset: 10, aHandleLen: 96,
  // module B - thin tools
  bCount: 3, bPitch: 24, bJawInset: 6, bHandleLen: 70,
  // module B - drill-bit tub + solder tips
  tipCount: 7, tipPitch: 14.5, tipLen: 70, tipDepth: 11, tipDia: 9, RIB_H: 10,
  // single tool: a module sized around one tool, not around the drawer
  tL: 160, tW: 26, tJw: 16, tJl: 55,
  // parts grid
  gridCols: 8, gridRows: 5, cell: 42, cellWall: 1.6, splits: 2,
  // bed check
  bedW: 230, bedD: 230,
};

/* ---------------------------------------------------------------- helpers */

function roundedRectPts(w, d, r) {
  const hw = w / 2; const hd = d / 2;
  r = Math.max(0, Math.min(r, hw - 0.05, hd - 0.05));
  const pts = [];
  const corners = [
    [hw - r, hd - r, 0],
    [-(hw - r), hd - r, D90],
    [-(hw - r), -(hd - r), Math.PI],
    [hw - r, -(hd - r), 3 * D90],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + D90 * (i / seg);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

/** signed area; JSCAD needs counter-clockwise outlines or the normals come
 *  out inverted and every boolean silently produces the wrong solid. */
const ccw = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s < 0 ? pts.slice().reverse() : pts;
};

const extrude = (pts, z0, z1) => transforms.translate(
  [0, 0, z0],
  extrusions.extrudeLinear({ height: z1 - z0 }, geom2.fromPoints(ccw(pts))),
);

const slab = (w, d, h, r) => extrude(roundedRectPts(w, d, r), 0, h);

const pocket = (w, d, cx, cy, z0, z1, r) => transforms.translate(
  [cx, cy, 0],
  extrude(roundedRectPts(w, d, r), z0, z1),
);

const roundHole = (x, y, dia, z0, z1, n = 40) => primitives.cylinder({
  radius: dia / 2, height: z1 - z0, segments: n,
  center: [x, y, (z0 + z1) / 2],
});

/** cylinder whose axis runs along Y - used for the solder-tip scallops */
const yRod = (x, yc, len, dia, z, n = 28) => transforms.translate(
  [x, yc, z],
  transforms.rotateX(D90, primitives.cylinder({ radius: dia / 2, height: len, segments: n })),
);

/** wide handle pocket in front of y=ys, narrow jaw pocket behind it.
 *  One closed outline - a union of two slots would leave tangent faces. */
function toolPocket(cx, y0, ys, y1, hw, sw, z0, z1) {
  const a = hw / 2; const b = sw / 2;
  const pts = [[cx - a, y0], [cx - a, ys], [cx - b, ys], [cx - b, y1 - b]];
  for (let i = 1; i < seg; i++) {
    const t = Math.PI - Math.PI * (i / seg);
    pts.push([cx + b * Math.cos(t), (y1 - b) + b * Math.sin(t)]);
  }
  pts.push([cx + b, y1 - b], [cx + b, ys], [cx + a, ys], [cx + a, y0]);
  return extrude(pts, z0, z1);
}

const cuboid = (x0, x1, y0, y1, z0, z1) => primitives.cuboid({
  size: [x1 - x0, y1 - y0, z1 - z0],
  center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
});

/** 45 deg finger ramp cut into a pocket wall. sign=+1 ramps toward +Y.
 *  Stops `lift` above the floor so it is printable and leaves a small lip. */
function scoop(x0, x1, yEdge, zFloor, size, sign, lift = 1.2) {
  const z0 = zFloor + lift;
  const tri = [[z0, yEdge], [z0, yEdge + sign * size], [z0 + size, yEdge]];
  const g = extrusions.extrudeLinear({ height: x1 - x0 }, geom2.fromPoints(ccw(tri)));
  // local (X=z, Y=y, Z=len) -> world (x, y, z)
  return transforms.translate([x1, 0, 0], transforms.rotateY(-D90, g));
}

/** A finger ramp whose side planes meet a rounded outer corner at a tangent
 *  produces sub-0.01 mm slivers - clamp the ramp inside the flat part of the
 *  face, or skip it if there is no room left. */
function scoopInside(x0, x1, halfWidth, rOut, yEdge, zFloor, size, sign) {
  const lim = halfWidth - rOut - 0.5;
  const a = Math.max(x0, -lim);
  const b = Math.min(x1, lim);
  return b - a > 1 ? scoop(a, b, yEdge, zFloor, size, sign) : null;
}

/* ------------------------------------------------------------ drawer math */

/** A corner radius larger than ~3.4x the rim would cut through the material
 *  beside the corner pockets, so clamp it rather than emit a broken part. */
export const rOut = (P) => Math.min(P.R_OUT, 3.4 * P.WALL);

export function layout(P) {
  const W = P.DW - 2 * P.CLR;
  const D = P.DD - 2 * P.CLR;
  const H = P.MOD_H;
  // a module is n cells of `pitch` plus one rim wall, so the outer rim is as
  // thick as the internal walls and the pockets can stay (pitch - WALL) wide
  const WA = P.aCount * P.aPitch + P.WALL;
  const WB = W - WA - P.GAP;
  return {
    W, D, H, WA, WB,
    // with a floor the pockets stop short of the rim so a chute fits; without
    // one they run to within a single wall of the edge and the part is a
    // skeleton - no material doing nothing
    yFront: -D / 2 + (P.FLOOR > 0 ? 11 : P.WALL),
    yBack: D / 2 - (P.FLOOR > 0 ? 9 : P.WALL),
    chutes: P.FLOOR > 0,
    xa: -W / 2 + WA / 2,
    xb: -W / 2 + WA + P.GAP + WB / 2,
    aHandle: Math.max(6, P.aPitch - P.WALL),
    aJaw: Math.max(4, P.aPitch - P.WALL - P.aJawInset),
    bHandle: Math.max(5, P.bPitch - P.WALL),
    bJaw: Math.max(3, P.bPitch - P.WALL - P.bJawInset),
    // every pocket is cut from here: below the floor if there is one, right
    // through the part if there is not
    zCut: P.FLOOR > 0 ? P.FLOOR : -1,
  };
}

/* ------------------------------------------------------------- module A */

export function buildA(P) {
  const L = layout(P);
  const { H, D, yFront: yf, yBack: yb, WA } = L;
  const ys = yf + P.aHandleLen;
  const pitch = P.aPitch; const hw = L.aHandle; const sw = L.aJaw;
  let s = slab(WA, D, H, rOut(P));

  const cuts = [];
  const scoops = [];
  for (let i = 0; i < P.aCount; i++) {
    const cx = -WA / 2 + P.WALL + (pitch - P.WALL) / 2 + i * pitch;
    cuts.push(toolPocket(cx, yf, ys, yb, hw, sw, L.zCut, H + 1));
    if (L.chutes) {
      scoops.push(scoopInside(cx - hw / 2, cx + hw / 2, WA / 2, rOut(P), yf, L.zCut, 12, -1));
      scoops.push(scoopInside(cx - sw / 2, cx + sw / 2, WA / 2, rOut(P), yb, L.zCut, 7, 1));
    }
  }
  s = booleans.subtract(s, ...cuts);
  return booleans.subtract(s, ...scoops.filter(Boolean));
}

/* ------------------------------------------------------------- module B */

export function buildB(P) {
  const L = layout(P);
  const { H, D, yFront: yf, yBack: yb, WB } = L;
  const ys = yf + P.bHandleLen;
  const pitch = P.bPitch; const hw = L.bHandle; const sw = L.bJaw;

  let s = slab(WB, D, H, rOut(P));
  const cuts = [];
  const scoops = [];
  let lastX = -WB / 2;
  for (let i = 0; i < P.bCount; i++) {
    const cx = -WB / 2 + P.WALL + (pitch - P.WALL) / 2 + i * pitch;
    lastX = cx;
    cuts.push(toolPocket(cx, yf, ys, yb, hw, sw, L.zCut, H + 1));
    if (L.chutes) {
      scoops.push(scoopInside(cx - hw / 2, cx + hw / 2, WB / 2, rOut(P), yf, L.zCut, 10, -1));
      scoops.push(scoopInside(cx - sw / 2, cx + sw / 2, WB / 2, rOut(P), yb, L.zCut, 6, 1));
    }
  }
  s = booleans.subtract(s, ...cuts);
  s = booleans.subtract(s, ...scoops.filter(Boolean));

  // right-hand zones: one open drill-bit tub, solder tips behind it
  const BX0 = lastX + hw / 2 + P.WALL;
  const BX1 = WB / 2 - P.WALL;
  const BW = BX1 - BX0;
  const BCX = (BX0 + BX1) / 2;
  if (BW < 40) return s; // drawer too narrow for the right-hand zones

  const zones = [];
  const ribCuts = [];
  const span = yb - yf;
  const tipBlock = P.tipCount > 0 ? P.tipLen + P.WALL : 0;
  const tubD = span - tipBlock;

  if (tubD > 25) {
    zones.push(pocket(BW, tubD, BCX, yf + tubD / 2, L.zCut, H + 1, 5));
    if (L.chutes) {
      zones.push(scoopInside(BCX - BW / 2, BCX + BW / 2, WB / 2, 0,
        yf, L.zCut, Math.min(24, tubD / 2), -1));
    }
  }

  if (tipBlock && tubD > 25) {
    const yTip = yb - P.tipLen;
    if (P.FLOOR > 0) {
      // floored: a shallow tray with scallops that stop the tips rolling
      const tipFloor = H - P.tipDepth;
      zones.push(pocket(BW, P.tipLen, BCX, yTip + P.tipLen / 2, tipFloor, H + 1, 6));
      for (let i = 0; i < P.tipCount; i++) {
        const x = BCX + (i - (P.tipCount - 1) / 2) * P.tipPitch;
        zones.push(yRod(x, yTip + P.tipLen / 2, P.tipLen - 3, P.tipDia, tipFloor + 2));
      }
    } else {
      // floorless: cut the zone right through, then stand short ribs in it -
      // a raised shelf would be a bridge with nothing under it
      zones.push(pocket(BW, P.tipLen, BCX, yTip + P.tipLen / 2, L.zCut, H + 1, 3));
      const lanes = Math.max(1, P.tipCount);
      const step = P.tipLen / lanes;
      for (let i = 0; i <= lanes; i++) {
        const y0 = yTip + i * step - (i === 0 ? 0 : P.WALL / 2);
        const y1 = y0 + (i === 0 || i === lanes ? P.WALL / 2 : P.WALL);
        ribCuts.push([y0, y1]);
      }
    }
  }
  s = booleans.subtract(s, ...zones);
  if (ribCuts.length) {
    // short ribs across the tip zone, 1.6 x 10 mm, joined to the side walls
    const ribs = ribCuts.map(([y0, y1]) => cuboid(BX0, BX1, y0, y1, 0, P.RIB_H));
    s = booleans.union(s, ...ribs);
  }
  return s;
}

/* ------------------------------------------------------------ assembly */

/** A and B side by side in drawer coordinates - for previewing the pair */
export function buildAssembly(P) {
  const L = layout(P);
  return booleans.union(
    transforms.translate([L.xa, 0, 0], buildA(P)),
    transforms.translate([L.xb, 0, 0], buildB(P)),
  );
}

/* ------------------------------------------------------ one custom tool */

/** A block wrapped around one tool. Module = tool + one wall all round, so the
 *  pocket is exactly what you measured; set tJw = tW for a plain rectangular
 *  well, or a narrower tJw to keep a shoulder that stops the tool sliding. */
export function buildTool(P) {
  const w = Math.max(3, P.tW);
  const l = Math.max(10, P.tL);
  const jw = Math.max(2, Math.min(P.tJw, w - 0.5));
  const jl = Math.max(jw * 0.6, Math.min(P.tJl, l - 5));
  const H = P.MOD_H;
  const W = w + 2 * P.WALL;
  const D = l + 2 * P.WALL;
  const zCut = P.FLOOR > 0 ? P.FLOOR : -1;

  let s = slab(W, D, H, Math.min(rOut(P), W / 2 - 0.1, D / 2 - 0.1));
  const yF = -D / 2 + P.WALL;
  const ys = yF + (l - jl);
  const yB = D / 2 - P.WALL;
  s = booleans.subtract(s, toolPocket(0, yF, ys, yB, w, jw, zCut, H + 1));

  if (P.FLOOR > 0) {
    const c = scoopInside(-w / 2, w / 2, W / 2, rOut(P), yF, zCut, 12, -1);
    if (c) s = booleans.subtract(s, c);
  }
  return s;
}

/* --------------------------------------------------------------- coupon */

export function buildCoupon(P) {
  const A = buildA(P);
  const box = transforms.translate([0, 0, 0], slab(62, 52, P.MOD_H + 4, 0.01));
  const placed = transforms.translate(
    [-P.aCount * P.aPitch / 2 + 31, -(P.DD - 2 * P.CLR) / 2 + 26, 0], box,
  );
  return booleans.intersect(A, placed);
}

/* ---------------------------------------------------------- parts grid */

export function buildTray(P) {
  const w = P.cellWall;
  const W = P.gridCols * P.cell + w;
  const D = P.gridRows * P.cell + w;
  const H = P.MOD_H;
  let s = slab(W, D, H, P.R_OUT);
  const cuts = [];
  for (let i = 0; i < P.gridCols; i++) {
    for (let j = 0; j < P.gridRows; j++) {
      cuts.push(pocket(P.cell - w, P.cell - w,
        -W / 2 + w + P.cell / 2 + i * P.cell,
        -D / 2 + w + P.cell / 2 + j * P.cell,
        P.FLOOR > 0 ? P.FLOOR : -1, P.MOD_H + 1, 4));
    }
  }
  const g = booleans.subtract(s, ...cuts);
  const splits = Math.max(1, Math.min(2, Math.round(P.splits || 1)));
  if (splits === 1) return { geom: g, pieces: 1, size: [W, D, H], pieceSize: [W, D, H] };

  // Split across the width with a stepped lap joint, so the halves cannot slide
  // apart in the drawer but still print on a 220 mm bed.
  const step = 3;
  const gap = 12;
  const clr = 0.15;
  const box = (x0, x1, y0, y1) => primitives.cuboid({
    size: [x1 - x0, y1 - y0, H + 4],
    center: [(x0 + x1) / 2, (y0 + y1) / 2, (H + 4) / 2 - 2],
  });
  const left = booleans.union(
    booleans.intersect(g, box(-W, 0, -D, 0)),
    booleans.intersect(g, box(-W, step, 0, D)),
  );
  const right = booleans.union(
    booleans.intersect(g, box(clr, W, -D, 0)),
    booleans.intersect(g, box(step + clr, W, 0, D)),
  );
  const lb = bounds(left);
  const rb = bounds(right);
  const placed = booleans.union(left, transforms.translate(
    [lb.hi[0] + gap - rb.lo[0], 0, 0], right,
  ));
  return {
    geom: placed,
    pieces: 2,
    size: [lb.size[0] + gap + rb.size[0], Math.max(lb.size[1], rb.size[1]), H],
    pieceSize: [Math.max(lb.size[0], rb.size[0]), Math.max(lb.size[1], rb.size[1]), H],
  };
}

export function buildBin(P, cols, rows) {
  const w = P.cellWall;
  const W = cols * P.cell - 1;
  const D = rows * P.cell - 1;
  const H = P.MOD_H;
  let s = slab(W, D, H, 4);
  const bf = Math.max(P.FLOOR, 1.2); // a bin has to hold parts when lifted
  s = booleans.subtract(s, pocket(W - 2 * w, D - 2 * w, 0, 0, bf, H + 1, 4));
  const ramp = scoopInside(-W / 2 + w, W / 2 - w, W / 2, 4, -D / 2 + w, bf,
    Math.min(18, (D - 2 * w) / 2), -1);
  if (ramp) s = booleans.subtract(s, ramp);
  return { geom: s, size: [W, D, H] };
}

/* ------------------------------------------------------------- reporting */

/** Triangulate. generalize() snaps coincident vertices together first - without
 *  it the raw CSG output has hundreds of T-junctions along the rounded rims.
 *  A handful of zero-area slits survive (verified: filling them changes the
 *  volume by 0.000 mm3), which every slicer ignores. */
export function triangles(geom) {
  const g = modifiers.generalize({ snap: true, triangulate: true }, geom);
  const out = [];
  for (const poly of g.polygons) {
    const v = poly.vertices;
    for (let i = 1; i + 1 < v.length; i++) {
      out.push([
        [v[0][0], v[0][1], v[0][2]],
        [v[i][0], v[i][1], v[i][2]],
        [v[i + 1][0], v[i + 1][1], v[i + 1][2]],
      ]);
    }
  }
  return out;
}

export function volume(geom) {
  let v = 0;
  for (const t of triangles(geom)) {
    if (t.length < 3) continue;
    const [a, b, c] = t;
    v += (a[0] * (b[1] * c[2] - b[2] * c[1])
        - a[1] * (b[0] * c[2] - b[2] * c[0])
        + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return Math.abs(v);
}

export function bounds(geom) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const t of triangles(geom)) {
    for (const p of t) {
      for (let i = 0; i < 3; i++) {
        if (p[i] < lo[i]) lo[i] = p[i];
        if (p[i] > hi[i]) hi[i] = p[i];
      }
    }
  }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

/** binary STL, written by hand so the site needs no serializer dependency */
export function toSTL(geom) {
  const tris = triangles(geom);
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris.length, true);
  let o = 84;
  for (const t of tris) {
    const [a, b, c] = t;
    const ux = b[0] - a[0]; const uy = b[1] - a[1]; const uz = b[2] - a[2];
    const vx = c[0] - a[0]; const vy = c[1] - a[1]; const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy; let ny = uz * vx - ux * vz; let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    view.setFloat32(o, nx, true); view.setFloat32(o + 4, ny, true); view.setFloat32(o + 8, nz, true);
    let p = o + 12;
    for (const v of [a, b, c]) {
      view.setFloat32(p, v[0], true); view.setFloat32(p + 4, v[1], true); view.setFloat32(p + 8, v[2], true);
      p += 12;
    }
    view.setUint16(o + 48, 0, true);
    o += 50;
  }
  return buf;
}
