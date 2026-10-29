# Muji drawer inserts

Parametric inserts for Muji's 34 × 23 × 4.5 cm drawers, generated in the browser
with JSCAD — no build step, no server.

**Live:** https://davedasun123.github.io/muji-drawer-inserts/

## The one that is actually being printed

Everything — the five pliers from the first photo *and* the twenty tools off the
workbench — in **one drawer, two tiers**:

| tier | size | height | what |
|---|---|---|---|
| bottom | 336 × 216 | 27 mm | 2 spring cutters stacked + 1 beside, crimper, tape measure, both screwdrivers, Swiss army knife |
| top | 336 × 182 | 17 mm | combination pliers, wire stripper, blue side cutter, probes, spanners, tweezers, drills, small drivers, syringes |

27 + 17 = 44 mm in a 45 mm drawer. Both tiers are split into 168 mm halves for a
256 mm bed. The top tier has a 1.2 mm floor — it lifts out, so it has to carry
its tools. The bottom tier is floorless; the tools sit on the drawer.

Print files: `out/one_drawer_print_files.zip`, plans: `out/onedrawer_*_plan.svg`.

## Regenerating

```bash
node src/export_stl.mjs        # -> out/one_drawer_*.stl
node src/diagram.mjs 1         # -> out/onedrawer_bottom_plan.svg
node src/diagram.mjs 2         # -> out/onedrawer_top_plan.svg
node src/pack_search.mjs 1     # re-pack a tier, prints a block to paste back
npm test                       # geometry + STL checks
```

Cell coordinates in `STACK_BOTTOM` / `STACK_TOP` are a **verified packing**, not a
policy — the packer is a greedy bottom-left search, and shelf packing wasted
30–45 % of the floor. Change a cell size, re-run `pack_search`, paste the result.

## What is measured and what is not

Measured off a 1 cm cutting mat (photo → homography → trace, `src/trace_tools.py`):
blue side cutter 166 × 63, tape measure 70 × 65 (26 with the clip), Swiss army
knife 95 × 27 × 19, crimper 190 × 55, yellow screwdriver 140 × 19, black
screwdriver 115 × 17, six flat spanners, two probes, three spring cutters at full
extension (107, 85, 81 wide).

Still guesses: the two small black drivers (110 × 30), the drill tube (110 × 25),
the flux syringes (95 × 25), the tweezers stack (130 × 22), and the drawer
interior itself (assumed 340 × 230 × 45 — the tray is 336 wide, so 4 mm of margin
is the whole budget).

## The rest of the generator

The site still builds the earlier parts — a plier comb, a bits/tips module, a
split parts tray, bins, a fit coupon, a single-tool cradle and an open tub — from
the same `docs/js/geom.js`. They are generated on demand; no STLs are checked in.

## Running it locally

```bash
npm run serve      # http://localhost:8000
npm test           # geometry assertions
npm run smoke      # puppeteer: drives the real page
```

JSCAD gotchas worth knowing: outlines must be CCW or booleans invert; a translator
on a pending Sketch does nothing; a fan triangulation of a boolean result is
usually not watertight, so `triangles()` checks manifoldness and falls back to
`generalize()`.

MIT.
