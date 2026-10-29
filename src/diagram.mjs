/* Plan-view diagram of a packed tray, as SVG.
 *   node src/diagram.mjs            -> out/drawer2_plan.svg
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../docs/js/geom.js';

const SET = Number(process.argv[2] || 1);
const P = { ...G.DEFAULTS, stackH: SET === 2 ? 17 : 27 };
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'out');
mkdirSync(out, { recursive: true });

const CELLS = G.STACK_SETS[SET] || G.STACK_BOTTOM;
const NAME = SET === 2 ? 'top tier, 17 mm' : 'bottom tier, 27 mm';
const SHEET = process.argv[3] === 'measure';
// what the numbers in each cell are based on: measured off the photo, or read
// by eye from the grid / guessed from the photo's proportions
const STATUS = {
  'Side cutter': ['measured', '166 × 63'],
  'Tape measure': ['measured', '70 × 65'],
  'Swiss army knife': ['measured', '101 × 28'],
  Crimper: ['check', '244 × 48'],
  'Long screwdrivers': ['check', 'two, ~150 × 20 each'],
  Probes: ['measured', '161 × 11 and 158 × 7'],
  Tweezers: ['check', '127 × 17'],
  'Flat spanners': ['measured', '68–79 × 10–18'],
  'Drills + hex keys': ['check', '105 × 17'],
  'Small drivers': ['check', '~105 × 12'],
  'Flux syringes': ['measured', '90 × 20'],
};
const MARK = { measured: ['#2f7d4f', '✓'], check: ['#b0453c', '?'] };
const { placed, D } = G.packCells(CELLS, P.stackW, P.WALL);
// number them in reading order of the picture, which is bottom-up in model y
const cells = [...placed].sort((a, b) => ((D - b.y - b.d) - (D - a.y - a.d)) || (a.x - b.x));

const S = 2.4;                       // px per mm
const ML = 84; const MT = 118; const GAP = 108;
const ROW = 21;
const planW = P.stackW * S;
const planH = D * S;
const legendH = 34 + cells.length * ROW + 30;
const width = Math.max(planW + ML + 34, 860);
const height = MT + planH + GAP + legendH;

const px = (mm) => +(mm * S).toFixed(1);
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const clip = (t, size, box) => {
  const max = Math.max(3, Math.floor(box / (size * 0.56)));
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
};
function T(x, y, txt, o = {}) {
  const fam = o.mono ? 'ui-monospace,Menlo,monospace' : 'ui-sans-serif,system-ui,sans-serif';
  const w = o.weight ? ` font-weight="${o.weight}"` : '';
  const a = o.anchor ? ` text-anchor="${o.anchor}"` : '';
  return `<text x="${x}" y="${y}" font-family="${fam}" font-size="${o.size || 13}"${w}${a} fill="${o.fill || '#26303f'}">${esc(txt)}</text>`;
}
const parts = [];

// drawer
const dw = G.DEFAULTS.DW - 1.4;
const dd = G.DEFAULTS.DD - 1.4;
const drawX = ML - px((dw - P.stackW) / 2);
const drawY = MT - px((dd - D) / 2);
if (dd - D < 70 && dd - D > 25) {
  parts.push(`<rect x="${drawX}" y="${drawY}" width="${px(dw)}" height="${px(dd)}" fill="none" stroke="#c3cbd8" stroke-width="2" stroke-dasharray="9 7"/>`);
}


// tray
parts.push(`<rect x="${ML}" y="${MT}" width="${planW}" height="${planH}" fill="#f6f8fc" stroke="#2b3546" stroke-width="2.5" rx="4"/>`);

cells.forEach((c, i) => {
  // model +y runs away from the viewer, and the slicer draws it upward, so a
  // cell at y = 0 belongs at the bottom of the page - not the top
  const x = ML + px(c.x); const y = MT + px(D - c.y - c.d);
  const w = px(c.w); const h = px(c.d);
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e4ebf6" stroke="#2b3546" stroke-width="1.6" rx="3"/>`);

  const wide = w > 90;
  const numSize = h > 78 ? 26 : 17;
  const nameSize = h > 78 ? 15 : 12.5;

  if (SHEET) {
    const st = STATUS[c.n] || ['check', ''];
    const [col, mark] = MARK[st[0]];
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fffdf6" stroke="${col}" stroke-width="2" rx="3"/>`);
    parts.push(T(x + 9, y + 22, i + 1, { size: 15, weight: 700 }));
    parts.push(T(x + 30, y + 21, clip(c.n, 13, w - 40), { size: 13, fill: '#37445c' }));
    parts.push(T(x + w - 10, y + 21, mark, { size: 15, weight: 700, fill: col, anchor: 'end' }));
    if (w > 110 && h > 34) parts.push(T(x + 10, y + 38, st[1], { size: 11, mono: true, fill: '#8a97a9' }));
    if (st[0] === 'check' && w > 100 && h > 56) {
      const my = y + Math.min(h - 12, 62);
      parts.push(T(x + 10, my, clip('______ × ______ mm', 12, w - 22), { size: 12, fill: '#b0453c' }));
    }
    return;
  }
  if (h > 78) {
    parts.push(T(x + 10, y + numSize + 6, i + 1, { size: numSize, weight: 700 }));
    if (wide) {
      const room = w - 14 - numSize * 1.1 - 6;
      parts.push(T(x + 10 + numSize * 1.15, y + numSize + 2, clip(c.n.toUpperCase(), nameSize, room), { size: nameSize, fill: '#37445c' }));
    }
    parts.push(T(x + 11, y + h - 9, `${c.w} × ${c.d} mm`, { size: 11, mono: true, fill: '#7b8aa0' }));
    if (!wide) parts.push(T(x + 11, y + numSize + 24, clip(c.n, 11, w - 20), { size: 11, fill: '#37445c' }));
  } else {
    parts.push(T(x + 9, y + 20, i + 1, { size: 16, weight: 700 }));
    parts.push(T(x + 9 + 20, y + 19, clip(c.n, nameSize, w - 34), { size: nameSize, fill: '#37445c' }));
    parts.push(T(x + 10, y + h - 7, `${c.w}×${c.d}`, { size: 10, mono: true, fill: '#7b8aa0' }));
  }
});

for (const r of G.freeRects(placed, P.stackW, D, P.WALL)) {
  const x = ML + px(r.x); const y = MT + px(D - r.y - r.d);
  parts.push(`<rect x="${x}" y="${y}" width="${px(r.w)}" height="${px(r.d)}" fill="#eef1f5" stroke="#a7b3c4" stroke-width="1.2" stroke-dasharray="6 4" rx="3"/>`);
  if (r.w > 30 && r.d > 12) parts.push(T(x + 7, y + 18, 'spare', { size: 12, fill: '#97a2b2' }));
}

// scale, front marker
parts.push(`<line x1="${ML}" y1="${MT + planH + 30}" x2="${ML + px(50)}" y2="${MT + planH + 30}" stroke="#2b3546" stroke-width="3"/>`);
parts.push(T(ML + px(50) + 10, MT + planH + 35, '50 mm', { size: 12, mono: true, fill: '#5a687d' }));
parts.push(T(width - 34, MT + planH + 35, 'Y = 0 — drawer front ↓', { size: 14, weight: 700, fill: '#b0453c', anchor: 'end' }));

// legend
const ly = MT + planH + GAP + 8;
if (SHEET) {
  const rows2 = [
    ['✓ measured', 'taken off the 1 cm grid photo, trust it'],
    ['? check', 'read by eye or guessed - these are the ones I need'],
  ];
  rows2.forEach(([a, b], k) => {
    const y = ly + 26 + k * 22;
    parts.push(T(ML, y, a, { size: 13.5, weight: 700, fill: k === 0 ? '#2f7d4f' : '#b0453c' }));
    parts.push(T(ML + 110, y, b, { size: 13, fill: '#556375' }));
  });
  parts.push(T(ML, ly + 92, 'Write the numbers straight onto the ? cells, photograph it on the mat,', { size: 13, fill: '#556375' }));
  parts.push(T(ML, ly + 111, 'and I can size the tray from that. The crimper (6) matters most.', { size: 13, fill: '#556375' }));
}
if (!SHEET) parts.push(T(ML, ly, 'What goes where', { size: 17, weight: 700 }));
const col = [ML, ML + 30, ML + 210, ML + 330];
cells.forEach((c, i) => {
  if (SHEET) return;
  const y = ly + 26 + i * ROW;
  if (i % 2 === 0) parts.push(`<rect x="${ML - 6}" y="${y - 15}" width="${width - ML - 20}" height="${ROW}" fill="#f4f6fa"/>`);
  parts.push(T(col[0], y, String(i + 1), { size: 13, mono: true, weight: 700 }));
  parts.push(T(col[1], y, c.n, { size: 13 }));
  parts.push(T(col[2], y, `${c.w} × ${c.d} mm`, { size: 12, mono: true, fill: '#7b8aa0' }));
  parts.push(T(col[3], y, c.note || '', { size: 12.5, fill: '#6c7c93' }));
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#ffffff"/>
${T(ML, 54, SHEET ? `${NAME[0].toUpperCase()}${NAME.slice(1)} — measure sheet` : `${NAME[0].toUpperCase()}${NAME.slice(1)} — where each tool goes`, { size: 27, weight: 700, fill: '#1b2431' })}
${T(ML, 82, SHEET ? `${P.stackW} × ${D.toFixed(0)} mm tray so far · cells marked ? are the numbers I still need` : `${P.stackW} × ${D.toFixed(0)} mm tray in a ${G.DEFAULTS.DW} × ${G.DEFAULTS.DD} drawer · ${P.stackH} mm walls · two halves, ${Math.round(P.stackW / 2)} mm each`, { size: 15, fill: '#6c7c93' })}
${parts.join('\n')}
</svg>`;

const file = SHEET ? `tier${SET}_measure.svg`
  : SET === 2 ? 'onedrawer_top_plan.svg' : 'onedrawer_bottom_plan.svg';
writeFileSync(join(out, file), svg);
console.log(`wrote out/${file} ${width} x ${height}`);
