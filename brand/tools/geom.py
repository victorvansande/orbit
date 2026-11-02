import math
K = 0.5522847498307936
def ellipse_d(cx, cy, rx, ry, rot=0.0, ccw=False):
    """Ellipse as 4 cubic beziers, rotated by rot degrees around (cx,cy)."""
    a = math.radians(rot); ca, sa = math.cos(a), math.sin(a)
    def P(x, y): return (cx + x*ca - y*sa, cy + x*sa + y*ca)
    pts = [(rx,0),(0,ry),(-rx,0),(0,-ry)]
    ctr = [((rx, K*ry),(K*rx, ry)), ((-K*rx, ry),(-rx, K*ry)), ((-rx,-K*ry),(-K*rx,-ry)), ((K*rx,-ry),(rx,-K*ry))]
    if ccw:
        pts = [pts[0], pts[3], pts[2], pts[1]]
        ctr = [((rx,-K*ry),(K*rx,-ry)), ((-K*rx,-ry),(-rx,-K*ry)), ((-rx,K*ry),(-K*rx,ry)), ((K*rx,ry),(rx,K*ry))]
    f = lambda p: "%.2f %.2f" % P(*p)
    d = "M" + f(pts[0])
    for i in range(4):
        c1, c2 = ctr[i]; e = pts[(i+1)%4]
        d += " C" + f(c1) + " " + f(c2) + " " + f(e)
    return d + " Z"
def circle_d(cx, cy, r, ccw=False): return ellipse_d(cx, cy, r, r, 0, ccw)
