import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as G from './geom.js';

const REPO = 'https://github.com/Davedasun123/muji-drawer-inserts';
const P = { ...G.DEFAULTS };

/* ------------------------------------------------------------ parameter UI */

const GROUPS = {
  drawer: ['Drawer interior (measured)', [
    ['DW', 'width', 100, 600, 1, 'mm'],
    ['DD', 'depth', 100, 600, 1, 'mm'],
    ['DH', 'height', 10, 200, 1, 'mm'],
    ['CLR', 'gap per side', 0, 3, 0.1, 'mm'],
    ['MOD_H', 'block height', 10, 120, 0.5, 'mm'],
    ['WALL', 'wall thickness', 0.8, 6, 0.1, 'mm'],
    ['FLOOR', 'floor (0 = none)', 0, 10, 0.2, 'mm'],
    ['R_OUT', 'corner radius', 0, 40, 0.5, 'mm'],
  ]],
  A: ['Pliers / cutters', [
    ['aCount', 'cradles', 1, 10, 1, ''],
    ['aPitch', 'pitch', 15, 60, 0.5, 'mm'],
    ['aJawInset', 'jaw narrower by', 0, 30, 0.5, 'mm'],
    ['aHandleLen', 'handle depth', 30, 180, 1, 'mm'],
  ]],
  B: ['Thin tools', [
    ['bCount', 'slots', 0, 8, 1, ''],
    ['bPitch', 'pitch', 12, 48, 0.5, 'mm'],
    ['bJawInset', 'jaw narrower by', 0, 20, 0.5, 'mm'],
    ['bHandleLen', 'handle depth', 20, 150, 1, 'mm'],
  ]],
  bits: ['Drill-bit tub, solder tips', [
    ['tipCount', 'tip grooves', 0, 14, 1, ''],
    ['tipPitch', 'tip pitch', 8, 30, 0.5, 'mm'],
    ['tipLen', 'tip length', 30, 150, 1, 'mm'],
    ['tipDepth', 'tip tray depth', 4, 26, 0.5, 'mm'],
  ]],
  body: ['Block', [
    ['MOD_H', 'height', 8, 120, 0.5, 'mm'],
    ['WALL', 'wall thickness', 0.8, 6, 0.1, 'mm'],
    ['FLOOR', 'floor (0 = none)', 0, 10, 0.2, 'mm'],
    ['R_OUT', 'corner radius', 0, 40, 0.5, 'mm'],
  ]],
  tool: ['One tool, measured', [
    ['tL', 'length', 20, 400, 1, 'mm'],
    ['tW', 'max width', 4, 120, 0.5, 'mm'],
    ['tJw', 'head/jaw width', 2, 120, 0.5, 'mm'],
    ['tJl', 'head/jaw length', 5, 300, 1, 'mm'],
  ]],
  grid: ['Parts grid', [
    ['gridCols', 'columns', 1, 14, 1, ''],
    ['gridRows', 'rows', 1, 12, 1, ''],
    ['cell', 'cell size', 20, 90, 1, 'mm'],
    ['cellWall', 'wall', 1.2, 6, 0.1, 'mm'],
    ['splits', 'printable halves', 1, 2, 1, ''],
    ['MOD_H', 'height', 8, 120, 0.5, 'mm'],
    ['FLOOR', 'floor', 1, 10, 0.2, 'mm'],
  ]],
  print: ['Printer', [
    ['bedW', 'bed width', 100, 500, 1, 'mm'],
    ['bedD', 'bed depth', 100, 500, 1, 'mm'],
  ]],
};

const PARTS = [
  {
    id: 'A',
    label: 'Module A — plier comb',
    groups: ['drawer', 'A', 'print'],
    build: (p) => G.buildA(p),
    name: (p) => `A_pliers_${p.aCount}x${p.aPitch}`,
    hint: 'Handle well + narrower jaw channel; the shoulder stops the tool sliding forward. Pocket width is pitch − wall, so thin walls buy space. Floor 0 = a skeleton: no bottom, nothing wasted, but it lives in the drawer.',
  },
  {
    id: 'B',
    label: 'Module B — drills, tips',
    groups: ['drawer', 'B', 'bits', 'print'],
    build: (p) => G.buildB(p),
    name: () => 'B_bits_tips_tub',
    hint: 'Three thin tool slots, one open drill-bit tub as deep as the rest of the module allows, and solder tips in scallops. Set tip grooves to 0 to give the whole depth to drills.',
  },
  {
    id: 'both',
    label: 'Both modules — assembled',
    groups: ['drawer', 'A', 'B', 'bits', 'print'],
    build: (p) => G.buildAssembly(p),
    name: () => 'drawer_insert_pair',
    noBed: true,
    hint: 'Both modules in place. 2 mm between them, 0.7 mm to each drawer wall — check nothing collides before printing.',
  },
  {
    id: 'tool',
    label: 'Single tool — custom pocket',
    groups: ['tool', 'body', 'print'],
    build: (p) => G.buildTool(p),
    name: (p) => `tool_${Math.round(p.tL)}x${Math.round(p.tW)}`,
    hint: 'Give the tool\'s overall length and its widest part, then the narrower head and how long that head is. The block is the tool plus one wall all round. Set head/jaw width = max width for a plain rectangular well.',
  },
  {
    id: 'coupon',
    label: 'Fit coupon (print first)',
    groups: ['drawer', 'A', 'print'],
    build: (p) => G.buildCoupon(p),
    name: () => 'fit_coupon',
    hint: 'Corner of module A. 20 minutes of plastic to prove the drawer fit before committing to the big parts.',
  },
  {
    id: 'tray',
    label: 'Parts tray — full grid',
    groups: ['grid', 'print'],
    build: (p) => G.buildTray(p),
    name: (p) => `tray_${p.gridCols}x${p.gridRows}${p.splits > 1 ? `_split${p.splits}` : ''}`,
    hint: 'Compartment grid for hardware, bearings or electronic parts. With 2 halves it prints on a 220 mm bed and the stepped joint keeps them aligned.',
  },
  {
    id: 'bin1',
    label: 'Parts bin — 1 × 1',
    groups: ['grid', 'print'],
    build: (p) => G.buildBin(p, 1, 1).geom,
    name: () => 'bin_1x1',
    hint: 'Loose bin that sits in a grid cell. Sloped front so you can scoop parts out.',
  },
  {
    id: 'bin2',
    label: 'Parts bin — 2 × 1',
    groups: ['grid', 'print'],
    build: (p) => G.buildBin(p, 2, 1).geom,
    name: () => 'bin_2x1',
    hint: 'Two cells long — for longer hardware, drills or drivers.',
  },
  {
    id: 'bin4',
    label: 'Parts bin — 2 × 2',
    groups: ['grid', 'print'],
    build: (p) => G.buildBin(p, 2, 2).geom,
    name: () => 'bin_2x2',
    hint: 'Big square bin. Bearings and bulk hardware belong in the bottom drawer — this fits a lot of steel.',
  },
];

let part = PARTS[0];
let geom = null;
let extra = null;
let timer = 0;

/* ------------------------------------------------------------------- three */

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 1, 6000);
camera.position.set(300, -420, 330);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.maxDistance = 3000;
controls.minDistance = 40;

scene.add(new THREE.HemisphereLight(0xffffff, 0x223044, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(-260, -420, 560);
scene.add(key);
const fill = new THREE.DirectionalLight(0x9fc4ff, 0.75);
fill.position.set(420, 260, 180);
scene.add(fill);

const material = new THREE.MeshStandardMaterial({
  color: 0xc3cbd8, roughness: 0.72, metalness: 0.04, flatShading: true,
});
const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
scene.add(mesh);

const drawerBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0x49536a, transparent: true, opacity: 0.32 }),
);
scene.add(drawerBox);

function resize() {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function frame(size, center) {
  const r = 0.5 * Math.hypot(size[0], size[1], size[2]);
  const dist = r / Math.sin((camera.fov * Math.PI) / 360) * 1.15;
  const dir = new THREE.Vector3(0.55, -1.0, 0.78).normalize();
  camera.position.copy(new THREE.Vector3(...center).add(dir.multiplyScalar(dist)));
  camera.near = dist / 200;
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  controls.target.set(...center);
  controls.update();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ render */

function showError(e) {
  const el = document.getElementById('err');
  el.hidden = false;
  el.textContent = `${e && e.message ? e.message : e}\n\n${e && e.stack ? e.stack.split('\n').slice(1, 4).join('\n') : ''}`;
  document.getElementById('hud').textContent = 'failed — see the message below';
}

function renderControls() {
  const box = document.getElementById('controls');
  box.innerHTML = '';
  for (const gid of part.groups) {
    const [title, rows] = GROUPS[gid];
    const g = document.createElement('div');
    g.className = 'group';
    const h = document.createElement('h2');
    h.textContent = title;
    g.appendChild(h);
    for (const [key, label, min, max, step, unit] of rows) {
      const row = document.createElement('div');
      row.className = 'row';
      const lab = document.createElement('label');
      lab.htmlFor = `p_${gid}_${key}`;
      lab.innerHTML = `${label}${unit ? ` <span class="unit">${unit}</span>` : ''}`;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.id = `p_${gid}_${key}`;
      inp.min = min; inp.max = max; inp.step = step;
      inp.value = P[key];
      inp.addEventListener('input', () => {
        const v = Number(inp.value);
        if (Number.isFinite(v)) {
          P[key] = v;
          schedule();
        }
      });
      row.append(lab, inp);
      g.appendChild(row);
    }
    box.appendChild(g);
  }
}

function build() {
  document.getElementById('err').hidden = true;
  try {
    const res = part.build(P);
    geom = res && res.geom ? res.geom : res;
    extra = res && res.pieceSize ? res : null;
  } catch (e) {
    geom = null;
    showError(e);
    return;
  }
  if (!geom || !geom.polygons) {
    showError(new Error('empty geometry — a parameter is out of range'));
    return;
  }

  const tris = G.triangles(geom);
  const pos = new Float32Array(tris.length * 9);
  let o = 0;
  for (const t of tris) {
    for (const v of t) {
      pos[o++] = v[0]; pos[o++] = v[1]; pos[o++] = v[2];
    }
  }
  mesh.geometry.dispose();
  mesh.geometry = new THREE.BufferGeometry();
  mesh.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  mesh.geometry.computeVertexNormals();

  const b = G.bounds(geom);
  frame(b.size, [0, 0, b.size[2] / 2]);

  // drawer footprint, for context
  drawerBox.scale.set(P.DW, P.DD, P.DH);
  drawerBox.position.set(0, 0, P.DH / 2);
  drawerBox.visible = part.groups.includes('drawer');

  const vol = G.volume(geom) / 1000;
  const mass = vol * 0.35; // ≈ 3 perimeters + 15 % infill, per cm3 of model volume
  const chk = extra && extra.pieceSize ? extra.pieceSize : b.size;
  const fits = part.noBed || (chk[0] <= P.bedW && chk[1] <= P.bedD);
  const lines = [
    extra && extra.pieces > 1
      ? `${extra.pieces} pieces · each ${extra.pieceSize[0].toFixed(1)} × ${extra.pieceSize[1].toFixed(1)} × ${extra.pieceSize[2].toFixed(1)} mm`
      : `${b.size[0].toFixed(1)} × ${b.size[1].toFixed(1)} × ${b.size[2].toFixed(1)} mm`,
    `${vol.toFixed(0)} cm³ model · ≈${mass.toFixed(0)} g printed`,
    `${tris.length.toLocaleString()} triangles`,
  ];
  document.getElementById('hud').innerHTML = lines.join('\n')
    + (part.noBed ? '' : `\n<span class="${fits ? '' : 'bad'}">${fits ? 'fits the bed' : `TOO BIG for ${P.bedW}×${P.bedD} bed`}</span>`);
  document.getElementById('hint').textContent = part.hint;
  document.getElementById('download').disabled = false;
}

function schedule() {
  clearTimeout(timer);
  document.getElementById('hud').textContent = 'building…';
  timer = setTimeout(build, 160);
}

/* ---------------------------------------------------------------- download */

document.getElementById('download').addEventListener('click', () => {
  if (!geom) return;
  const buf = G.toSTL(geom);
  const blob = new Blob([buf], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${part.name(P)}.stl`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

document.getElementById('reset').addEventListener('click', () => {
  Object.assign(P, G.DEFAULTS);
  renderControls();
  build();
});

/* ------------------------------------------------------------------- boot */

const sel = document.getElementById('part');
for (const p of PARTS) {
  const o = document.createElement('option');
  o.value = p.id;
  o.textContent = p.label;
  sel.appendChild(o);
}
sel.addEventListener('change', () => {
  part = PARTS.find((p) => p.id === sel.value);
  history.replaceState(null, '', `?part=${part.id}`);
  renderControls();
  build();
});

// deep links: ?part=both
const want = new URLSearchParams(location.search).get('part');
if (want) {
  const found = PARTS.find((p) => p.id === want);
  if (found) {
    part = found;
    sel.value = found.id;
  }
}

document.getElementById('repo-link').href = REPO;
renderControls();
resize();
build();
animate();

window.__ready = true;
