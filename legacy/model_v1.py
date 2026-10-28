"""
Muji 34 x 23 x 4.5 cm drawer -> two-part tool insert.

  Module A  "plier comb"   5 cradles, wide handle pocket + narrow jaw pocket
  Module B  "bits + tips"  3 thin slots, one open drill-bit tub, and 7
                           solder-tip grooves

Units mm. Each module is built with the block centre at the origin and is
placed into drawer coordinates only for previews / the assembly file.
X = drawer width, Y = drawer depth (front = -Y), Z = up from the drawer floor.

Run:  uv run --with cadquery python src/model.py
"""
import os

import cadquery as cq

# --------------------------------------------------------------------------
# 1. DRAWER INTERIOR  -- measure yours, everything else follows
# --------------------------------------------------------------------------
DW, DD, DH = 340.0, 230.0, 45.0   # measured INSIDE: 34 x 23 x 4.5 cm
CLR = 0.7                          # air gap per side: drops in, lifts out
WALL = 2.6                         # thinnest wall between pockets
FLOOR = 2.8                        # material under the deepest pocket
MOD_H = 32.0                       # block height (drawer is 45 deep)
R_OUT = 7.0                        # outer corner radius
LIP = 1.2                          # ledge at the bottom of every finger ramp
TOP_CH = 0.8                       # chamfer on the top rim (no razor edge)
FLOOR_FIL = 1.0                    # fillet where pocket wall meets pocket floor
GAP = 2.0                          # gap between the two modules

W = DW - 2 * CLR
D = DD - 2 * CLR
H = MOD_H

Y_FRONT = -D / 2 + 11.0            # front wall of every pocket
Y_BACK = D / 2 - 9.0               # back wall of every pocket


# --------------------------------------------------------------------------
# 2. HELPERS
# --------------------------------------------------------------------------
def prism(wp2d, z0, z1):
    return wp2d.close().extrude(z1 - z0).translate((0, 0, z0))


def rounded_slab(w, d, h, r, cx=0.0, cy=0.0):
    s = cq.Workplane("XY").sketch().rect(w, d).vertices().fillet(r).finalize()
    return s.extrude(h).translate((cx, cy, 0))


def bin_pocket(w, d, cx, cy, z0, z1, r):
    s = cq.Workplane("XY").sketch().rect(w, d).vertices().fillet(r).finalize()
    return s.extrude(z1 - z0).translate((cx, cy, z0))


def tool_pocket(cx, y0, ys, y1, hw, sw, z0, z1):
    """wide handle pocket in front of y=ys, narrow jaw pocket behind it.
    Drawn as ONE closed wire: a union of two slots leaves tangent faces that
    break every later chamfer/fillet, and loses the flat shoulder."""
    a, b = hw / 2.0, sw / 2.0
    p = (cq.Workplane("XY")
         .moveTo(cx - a, y0)
         .lineTo(cx - a, ys)
         .lineTo(cx - b, ys)
         .lineTo(cx - b, y1 - b)
         .threePointArc((cx, y1), (cx + b, y1 - b))
         .lineTo(cx + b, ys)
         .lineTo(cx + a, ys)
         .lineTo(cx + a, y0))
    return prism(p, z0, z1)


def scoop(x0, x1, y_edge, z_floor, size, sign):
    """45 deg finger ramp cut into a pocket wall. sign=+1 ramps toward +Y.
    Stops LIP above the pocket floor: a knife edge there is unprintable and it
    breaks every later blend, and the tiny lip stops bits rolling out."""
    z0 = z_floor + LIP
    pts = [(y_edge, z0), (y_edge + sign * size, z0), (y_edge, z0 + size)]
    return (cq.Workplane("YZ").polyline(pts).close()
            .extrude(x1 - x0).translate((x0, 0, 0)))


def finish(solid):
    """cosmetics, each attempted independently - a failed blend is not fatal"""
    for label, fn in (
        ("floor fillet", lambda s: s.edges(cq.selectors.BoxSelector(
            (-1e3, -1e3, FLOOR - 0.2), (1e3, 1e3, FLOOR + 0.2))).fillet(FLOOR_FIL)),
        ("rim chamfer", lambda s: s.faces(">Z").edges().chamfer(TOP_CH)),
    ):
        try:
            solid = fn(solid)
        except Exception as e:                                # noqa: BLE001
            print(f"  {label} skipped: {str(e)[:50]}")
    return solid


# --------------------------------------------------------------------------
# 3. MODULE A - 4 cradles for pliers / cutters / crimpers
# --------------------------------------------------------------------------
WA = 150.0
A_PITCH, A_HW, A_SW = 30.0, 24.5, 14.5
A_SHOULDER = Y_FRONT + 96.0
A_XS = [-WA / 2 + A_PITCH / 2 + i * A_PITCH for i in range(5)]

a = rounded_slab(WA, D, H, R_OUT)
for xc in A_XS:
    a = a.cut(tool_pocket(xc, Y_FRONT, A_SHOULDER, Y_BACK, A_HW, A_SW, FLOOR, H + 1))
for xc in A_XS:
    # front chute so a finger can pinch the handle out of the well
    a = a.cut(scoop(xc - A_HW / 2, xc + A_HW / 2, Y_FRONT, FLOOR, 12.0, -1))
    # back chute to flick out a dropped tool
    a = a.cut(scoop(xc - A_SW / 2, xc + A_SW / 2, Y_BACK, FLOOR, 7.0, +1))

# --------------------------------------------------------------------------
# 4. MODULE B - 3 thin slots + hex-bit field + 2 scoop bins
# --------------------------------------------------------------------------
WB = W - WA - GAP
B_PITCH, B_HW, B_SW = 24.0, 18.0, 13.0
B_SHOULDER = Y_FRONT + 70.0
B_XS = [-WB / 2 + 12.0 + B_PITCH * i for i in range(3)]

b = rounded_slab(WB, D, H, R_OUT)
for xc in B_XS:
    b = b.cut(tool_pocket(xc, Y_FRONT, B_SHOULDER, Y_BACK, B_HW, B_SW, FLOOR, H + 1))
for xc in B_XS:
    b = b.cut(scoop(xc - B_HW / 2, xc + B_HW / 2, Y_FRONT, FLOOR, 10.0, -1))
    b = b.cut(scoop(xc - B_SW / 2, xc + B_SW / 2, Y_BACK, FLOOR, 6.0, +1))

# --- right half of module B: drill-bit tub + solder tips ------------------
BX0 = B_XS[-1] + B_HW / 2 + WALL
BX1 = WB / 2 - WALL
BCX, BW = (BX0 + BX1) / 2, BX1 - BX0

TIP_N, TIP_PITCH, TIP_L, TIP_DEPTH, TIP_R = 7, 14.5, 70.0, 11.0, 4.5

span = Y_BACK - Y_FRONT
tip_block = TIP_L + WALL if TIP_N else 0.0
tub_d = span - tip_block

# one big open tub beats any fitted index for mixed drill sizes
if tub_d > 25:
    b = b.cut(bin_pocket(BW, tub_d, BCX, Y_FRONT + tub_d / 2, FLOOR, H + 1, 5.0))
    b = b.cut(scoop(BCX - BW / 2, BCX + BW / 2, Y_FRONT, FLOOR,
                    min(24.0, tub_d / 2), -1))

# solder tips, lying in shallow scallops
if tip_block and tub_d > 25:
    y_tip = Y_BACK - TIP_L
    b = b.cut(bin_pocket(BW, TIP_L, BCX, y_tip + TIP_L / 2, H - TIP_DEPTH, H + 1, 6.0))
    for i in range(TIP_N):
        x = BCX + (i - (TIP_N - 1) / 2) * TIP_PITCH
        b = b.cut(cq.Workplane().add(cq.Solid.makeCylinder(
            TIP_R, TIP_L - 3, cq.Vector(x, y_tip + 1.5, H - TIP_DEPTH + 2.0),
            cq.Vector(0, 1, 0))))

# small corner coupon: print this first, it takes 10 min and proves the fit
coupon = a.intersect(cq.Workplane("XY").center(-WA / 2 + 31, -D / 2 + 26)
                     .rect(62, 52).extrude(H + 4))

a, b = finish(a), finish(b)

# --------------------------------------------------------------------------
# 5. PLACEMENT + EXPORT
# --------------------------------------------------------------------------
XA = -W / 2 + WA / 2
XB = -W / 2 + WA + GAP + WB / 2
MODULES = [("A_plier_comb", a, (XA, 0, 0)), ("B_bits_tips_tub", b, (XB, 0, 0))]
COUPON = ("fit_coupon", coupon, (0, 0, 0))


def build():
    return [(n, s.translate(o)) for n, s, o in MODULES]


if __name__ == "__main__":
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, "out")
    os.makedirs(out, exist_ok=True)

    for name, shp, off in MODULES + [COUPON]:
        cq.exporters.export(shp, os.path.join(out, name + ".stl"),
                            tolerance=0.08, angularTolerance=0.25)
        cq.exporters.export(shp, os.path.join(out, name + ".step"))
        bb = shp.val().BoundingBox()
        print(f"{name:18s} {bb.xlen:6.1f} x {bb.ylen:6.1f} x {bb.zlen:5.1f}  "
              f"solid {shp.val().Volume()/1000:6.1f} cm3")

    assy = cq.Assembly(name="muji_drawer_insert")
    for name, shp, off in MODULES + [COUPON]:
        assy.add(shp, name=name, loc=cq.Location(cq.Vector(*off)))
    assy.save(os.path.join(out, "drawer_insert_assembly.step"))
    print("assembly written")
