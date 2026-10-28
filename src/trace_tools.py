"""Turn a photo of tools on a 1 cm cutting mat into polygons in millimetres.

  1. find the printed 1 cm grid, fit a homography so 1 unit = 1 cm
  2. warp the photo top-down
  3. segment everything that is not mat green, one contour per tool
  4. emit the outlines, offset by the pocket clearance and by the wall

  python src/trace_tools.py tools/photo_01.jpg
"""
import json
import sys

import cv2
import numpy as np
from shapely.geometry import Polygon
from shapely.validation import make_valid

POCKET_CLEAR = 1.5   # mm of slack around the tool
WALL = 1.8           # mm of material around the pocket
PX_PER_MM = 8        # rectified resolution
PAD_CM = 2           # canvas margin so tools near the mat edge still fit


def hough(mask, minlen=120, gap=12):
    out = cv2.HoughLinesP(mask, 1, np.pi / 720, 60, minLineLength=minlen, maxLineGap=gap)
    return np.zeros((0, 4), np.int32) if out is None else out.reshape(-1, 4)


def cluster(lines, vertical, H, W, tol=8.0):
    """group segments that sit on the same grid line, return one fitted line each"""
    items = []
    for x1, y1, x2, y2 in lines:
        if vertical:
            if abs(y2 - y1) < 80:
                continue
            xm = x1 + (x2 - x1) * ((H / 2 - y1) / (y2 - y1))
        else:
            if abs(x2 - x1) < 80:
                continue
            xm = y1 + (y2 - y1) * ((W / 2 - x1) / (x2 - x1))
        items.append((xm, (x1, y1, x2, y2)))
    items.sort(key=lambda t: t[0])
    groups, cur = [], [items[0]]
    for v, s in items[1:]:
        if v - cur[-1][0] < tol:
            cur.append((v, s))
        else:
            groups.append(cur)
            cur = [(v, s)]
    groups.append(cur)

    out = []
    for g in groups:
        pts = np.array([[p for p in s] for _, s in g], np.float32).reshape(-1, 2)
        vx, vy, x0, y0 = cv2.fitLine(pts, cv2.DIST_L2, 0, 0.01, 0.01).ravel()
        out.append((float(np.median([v for v, _ in g])), (vx, vy, x0, y0)))
    return out


def intersect(la, lb):
    (ax, ay, ax0, ay0), (bx, by, bx0, by0) = la, lb
    A = np.array([[ax, -bx], [ay, -by]], float)
    b = np.array([bx0 - ax0, by0 - ay0], float)
    t, s = np.linalg.solve(A, b)
    return ax0 + t * ax, ay0 + t * ay


def main(path):
    img = cv2.imread(path)
    sc = 1600 / img.shape[1]
    im = cv2.resize(img, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
    H, W = im.shape[:2]

    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.int16)
    bg = cv2.medianBlur(g.astype(np.uint8), 41).astype(np.int16)
    bright = ((g - bg) > 10).astype(np.uint8) * 255
    bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    vmask = cv2.morphologyEx(bright, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 45)))
    hmask = cv2.morphologyEx(bright, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (45, 1)))

    vl = cluster(hough(vmask), True, H, W)
    hl = cluster(hough(hmask), False, H, W)
    print(f'grid lines: {len(vl)} vertical, {len(hl)} horizontal')

    # four extreme intersections - indices are only used as cm units
    i0, i1 = 0, len(vl) - 1
    j0, j1 = 0, len(hl) - 1
    src = np.float32([intersect(vl[i0][1], hl[j0][1]), intersect(vl[i1][1], hl[j0][1]),
                      intersect(vl[i1][1], hl[j1][1]), intersect(vl[i0][1], hl[j1][1])])
    pm = 10 * PX_PER_MM
    dst = np.float32([[i0 - i0 + PAD_CM, j0 - j0 + PAD_CM],
                      [i1 - i0 + PAD_CM, j0 - j0 + PAD_CM],
                      [i1 - i0 + PAD_CM, j1 - j0 + PAD_CM],
                      [i0 - i0 + PAD_CM, j1 - j0 + PAD_CM]]) * pm
    M = cv2.getPerspectiveTransform(src, dst)

    out_w = int((i1 - i0 + 2 * PAD_CM) * pm)
    out_h = int((j1 - j0 + 2 * PAD_CM) * pm)
    rect = cv2.warpPerspective(im, M, (out_w, out_h), flags=cv2.INTER_AREA)
    print(f'rectified {out_w} x {out_h} px = {out_w / PX_PER_MM / 10:.1f} x {out_h / PX_PER_MM / 10:.1f} cm')

    # mat green out, everything else is tool
    hsv = cv2.cvtColor(rect, cv2.COLOR_BGR2HSV)
    hue, sat, val = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    green = (hue > 35) & (hue < 95) & (sat > 40) & (val > 30)
    tool = (~green).astype(np.uint8)
    tool = cv2.morphologyEx(tool, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    tool = cv2.morphologyEx(tool, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

    n, lab, stats, cent = cv2.connectedComponentsWithStats(tool, 8)
    keep = []
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 8 * PX_PER_MM ** 2 * 200:          # < 2 cm2
            continue
        if x <= 2 or y <= 2 or x + w >= out_w - 2 or y + h >= out_h - 2:
            continue                               # touches the frame: not a tool
        keep.append(i)
    keep.sort(key=lambda i: cent[i][0])
    print(f'{len(keep)} tool candidates')

    mm = PX_PER_MM
    dbg = rect.copy()
    tools = []
    for idx, i in enumerate(keep, 1):
        mask = (lab == i).astype(np.uint8)
        cnt = max(cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0],
                  key=cv2.contourArea).reshape(-1, 2)

        # shapely, not cv2.dilate: buffering gives a clean, valid outline
        # instead of a pixel staircase that self-intersects at the jaw tips
        poly = Polygon(cnt / mm)
        if not poly.is_valid:
            poly = make_valid(poly)
            poly = max(getattr(poly, 'geoms', [poly]), key=lambda g: g.area)
        poly = poly.simplify(0.4, preserve_topology=True)
        pocket = poly.buffer(POCKET_CLEAR, join_style=1, quad_segs=6).simplify(0.12, preserve_topology=True)
        outer = poly.buffer(POCKET_CLEAR + WALL, join_style=1, quad_segs=6).simplify(0.12, preserve_topology=True)
        if pocket.geom_type != 'Polygon' or outer.geom_type != 'Polygon':
            print(f'  ! tool {idx}: buffer fell apart, skipping')
            continue

        pts = np.array(pocket.exterior.coords)[:-1]
        opts = np.array(outer.exterior.coords)[:-1]
        c = pts.mean(axis=0)
        pts, opts = pts - c, opts - c

        x, y, w, h, _ = stats[i]
        (cx, cy), (rw, rh), ang = cv2.minAreaRect(cv2.findNonZero(mask))
        if rw < rh:
            rw, rh, ang = rh, rw, ang + 90

        tools.append({
            'index': idx,
            'length_mm': round(max(rw, rh) / mm, 1),
            'width_mm': round(min(rw, rh) / mm, 1),
            'angle_deg': round(ang, 1),
            'area_cm2': round(poly.area / 100, 1),
            'pocket': pts.round(2).tolist(),
            'outer': opts.round(2).tolist(),
        })
        cv2.drawContours(dbg, [(pts * mm + [rect.shape[1], rect.shape[0]]) .astype(np.int32) * 0], -1, (0, 0, 0), 0)
        cv2.polylines(dbg, [pts.astype(np.int32) * 1], True, (0, 0, 255), 2)
        cv2.putText(dbg, f'{idx}: {max(rw,rh)/mm:.0f}x{min(rw,rh)/mm:.0f}',
                    (int(x), max(20, int(y) - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    cv2.imwrite('/tmp/rect.png', dbg)
    with open('tools/tools_01.json', 'w') as f:
        json.dump(tools, f, indent=1)
    for t in tools:
        print(f"  {t['index']}: {t['length_mm']:.0f} x {t['width_mm']:.0f} mm, "
              f"{len(t['pocket'])} pts")
    print('wrote tools/tools_01.json and /tmp/rect.png')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'tools/photo_01.jpg')
