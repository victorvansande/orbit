import sys, math; sys.path.insert(0,'tools')
from geom import ellipse_d, circle_d
# Master construction, 1000-unit square, module u = 10 units.
MASTER = dict(a=440, ratio=0.76, tL=104, tR=22, tV=54, dot=58, gap=0.95, rot=-32, cx=500, cy=500)
SMALL  = dict(a=470, ratio=0.76, tL=128, tR=66, tV=80, dot=72, gap=1.0, rot=-32, cx=500, cy=500)
def parts(p):
    a=p['a']; b=a*p['ratio']; r=math.radians(p['rot'])
    ai=a-(p['tL']+p['tR'])/2; sh=(p['tL']-p['tR'])/2; bi=b-p['tV']
    c=math.sqrt(a*a-b*b)
    cx,cy=p['cx'],p['cy']
    inner=(cx+sh*math.cos(r), cy+sh*math.sin(r))
    # core: on the major axis, one gap (gap x dot radius) inside the thick side of the counter
    xin = -(ai - sh)                      # inner left edge, relative to centre, before rotation
    dx = xin + p['dot']*(1+p['gap'])
    focus=(cx+dx*math.cos(r), cy+dx*math.sin(r))
    return dict(a=a,b=b,ai=ai,bi=bi,sh=sh,c=c,inner=inner,focus=focus,rot=p['rot'])
def ring_d(p):
    q=parts(p)
    return ellipse_d(p['cx'],p['cy'],q['a'],q['b'],p['rot']) + ' ' + ellipse_d(*q['inner'],q['ai'],q['bi'],p['rot'],ccw=True)
def dot_d(p):
    q=parts(p); return circle_d(*q['focus'],p['dot'])
def mark_d(p): return ring_d(p)+' '+dot_d(p)
