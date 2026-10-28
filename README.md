# Muji drawer inserts

Parametric, 3D-printable drawer organiser for a **Muji 340 × 230 × 45 mm** drawer
(34 × 23 × 4.5 cm inside). Two parts for hand tools plus a compartment grid for
hardware and electronic parts.

**Generator site:** <https://davedasun123.github.io/muji-drawer-inserts/>
— change any dimension, watch it rebuild, download the STL. Everything runs in
the browser; nothing is uploaded.

```
docs/                 the site (GitHub Pages serves this folder)
  index.html
  js/geom.js          all the geometry, one pure function per part
  js/app.js           UI, three.js preview, STL writer
  css/style.css
src/model.py          the original CadQuery model (reference implementation)
out/                  STLs + STEP exported from CadQuery
test/geom.test.mjs    checks the browser geometry against the CadQuery volumes
```

## What it makes

| part | size | contents |
|---|---|---|
| **A — plier comb** | 150 × 229 × 32 | 5 cradles: 24.5 mm handle well → shoulder → 14.5 mm jaw channel, 45° front chute |
| **B — bits, tips, tub** | 187 × 229 × 32 | 3 thin tool slots · 20 hex-bit pockets on a sunken shelf · 7 solder-tip scallops · open drill-bit tub |
| **fit coupon** | 62 × 52 × 32 | corner of A — print this first |
| **parts tray** | 338 × 212 × 32 | 8 × 5 compartment grid, 42 mm cells — splits into two 172 mm halves with a stepped lap joint (`printable halves = 2`) |
| **bins** | 1×1 / 2×1 / 2×2 | loose bins with a scoop front, for bearings, screws, parts |

## Printing

- PETG or ASA; PLA is fine for light bits but creeps under a heavy crimper.
- 0.2 mm layers, 3 perimeters, 15 % gyroid. No supports — every overhang is 45°
  or an inside corner.
- Module A and B are 229 mm deep: check your bed. The parts tray will need to be
  generated in two halves on a 220 mm bed (drop `rows`) or printed on a bigger one.
- The tools drawer is ~1.08 L of solid across both modules → roughly 400 g.

## Running it locally

```bash
npm install          # just @jscad/modeling, for the test
npm test             # volumes must match the CadQuery reference
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

Pages is already configured for this repo: **Settings → Pages → Source =
Deploy from a branch → `main` / `docs`**. push to `main` and the site rebuilds in
about a minute.

To do it from scratch on another repo:

```bash
git init && git add -A && git commit -m "first commit"
gh repo create my-repo --public --source=. --push
gh api -X POST repos/:owner/:repo/pages \
  -f 'source[branch]=main' -f 'source[path]=/docs'
```

## Licence

MIT.
