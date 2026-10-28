# Muji drawer inserts

Parametric, 3D-printable drawer organiser for a **Muji 340 × 230 × 45 mm** drawer
(34 × 23 × 4.5 cm inside). Tuned for minimum material: **1.6 mm walls, no floor
by default, nothing doing structural work it doesn't have to.**

**Generator site:** <https://davedasun123.github.io/muji-drawer-inserts/>
— change any dimension, watch it rebuild, download the STL. Everything runs in
the browser; nothing is uploaded.

```
docs/                 the site (GitHub Pages serves this folder)
  index.html
  js/geom.js          all the geometry, one pure function per part
  js/app.js           UI, three.js preview, STL writer
  css/style.css
src/export_stl.mjs    writes out/*.stl from the same geometry the site uses
out/                  generated STLs
test/geom.test.mjs    volumes, sizes and derived dimensions must not drift
legacy/               the original CadQuery model (design v1, superseded)
```

## The efficient default

- **Pocket width is derived**: `pitch − wall`. Walls went 2.6 → 1.6 mm, so the
  plier pockets went 24.5 → 28.4 mm wide (+16 % capacity) with no change in
  footprint.
- **`floor = 0`** cuts every pocket straight through: the drawer becomes the
  floor. Model volume drops from 1040 cm³ to 425 cm³ for the pair.
- **28 mm tall** instead of 32 — the drawer is 45 deep, the extra height was
  doing nothing.
- The outer rim is one wall thick, and the pockets run to within 1.6 mm of the
  edge, so no material sits where no tool does.

A floorless part is a skeleton: it cannot be lifted out with tools in it, and it
wants a brim when printed. Set `floor = 1.2` if you'd rather lift the module out
and keep the finger chutes — that path keeps the 11 mm front margin the chutes
need.

## What it makes

| part | size | contents |
|---|---|---|
| **A — plier comb** | 152 × 229 × 28 | 5 cradles: 28.4 mm well → shoulder → 18.4 mm jaw channel |
| **B — drills, tips** | 185 × 229 × 28 | 3 thin slots · open drill-bit tub · 7 solder-tip ribs |
| **single tool** | tool + 2 × wall | a block wrapped around one measured tool: handle well + narrower jaw channel |
| **tool rack** | 137 × 168 × 22 / 163 × 118 × 22 | the five measured tools as plain rectangular pockets, sized for a 256 mm bed |
| **open tub** | 289 × 129 × 18 | plain box for spring tools kept at full extension, with a finger notch |
| **fit coupon** | 62 × 52 × 28 | corner of A — print this first, ~10 min |
| **parts tray** | 352 × 212 × 28 | 8 × 5 grid, 42 mm cells, splits into two |
| **bins** | 1×1 / 2×1 / 2×2 | loose bins — these always keep a floor, or they aren't bins |

## Printing a skeleton

- 1.6 mm walls = 4 perimeters at 0.4 mm, or 3 at 0.6 mm. Nothing else is solid.
- Set **top solid layers to 0 and infill to 0 %** — there is no solid region to
  fill, and the slicer will otherwise waste time on the rim.
- **Brim, 5 mm.** The first layer is a set of free-standing wall outlines with no
  plate under them.
- PETG or ASA; PLA is fine for light bits but creeps under a heavy crimper.
- The pair is ~425 cm³ of model, roughly 150 g printed.

## Traced tools from a photo (measurement only)

For one-offs, photograph the tool on a 1 cm cutting mat and trace it instead of
guessing numbers:

```bash
python src/trace_tools.py tools/photo_01.jpg     # -> tools/tools_01.json
node   src/build_tools.mjs                       # -> out/tools/tool_*.stl
python src/render_stls.py out/tools/tool_*.stl   # -> preview png
```

The generated cups were tried and dropped: a silhouette-following 1.8 mm wall
is a fragile part and it wastes drawer width. `trace_tools.py` is kept for the
measurements it produces - those numbers are what `RACK` in `geom.js` is built
from. `trace_tools.py` finds the printed grid, fits a homography so 1 unit = 1 cm,
warps the photo top-down, segments everything that is not mat green, and emits
one outline per tool (shapely buffer for the pocket + wall, so the outline is
valid rather than a pixel staircase). Thickness is not visible from above - take it from a side photo or a caliper.

## Running it locally

```bash
npm install          # @jscad/modeling, for the tests and the exporter
npm test             # volumes / sizes / derived widths must not drift
npm run export       # regenerate out/*.stl from docs/js/geom.js
npm run serve        # http://localhost:8080
```

The page uses ES modules, so it needs a server — opening `index.html` from the
file system will not work.

## How the site works

`docs/js/geom.js` is plain functions of a params object, returning a JSCAD
`geom3`. `app.js` renders inputs from a schema, calls the right builder, and
draws the triangles with three.js. The STL is written by hand (80-byte header +
50 bytes per triangle) so the page needs no exporter dependency.

Adding a part: write `buildX(P)` in `geom.js`, add an entry to `PARTS` in
`app.js` with the parameter groups it needs.

## Deploying (GitHub Pages)

Already configured: **Settings → Pages → Source = Deploy from a branch →
`main` / `docs`**. Push to `main`, the site rebuilds in about a minute.

From scratch on another repo:

```bash
git init && git add -A && git commit -m "first commit"
gh repo create my-repo --public --source=. --push
gh api -X POST repos/:owner/:repo/pages \
  -f 'source[branch]=main' -f 'source[path]=/docs'
```

## Licence

MIT.
