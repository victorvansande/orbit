import sys, math; sys.path.insert(0,'tools')
from geom import circle_d, ellipse_d
import pathops
# Comet loop on a tilted elliptical centreline. Units: 1000 box.
COMET = dict(a=380, b=290, rot=-32, cx=500, cy=500, th0=200, sweep=322, w0=10, w1=96, k=1.15, head=1.42, knots=10)
SMALLC= dict(a=400, b=305, rot=-32, cx=500, cy=500, th0=200, sweep=318, w0=34, w1=118, k=1.0, head=1.42, knots=8)
def _pt(p, th):
    r=math.radians(p['rot']); t=math.radians(th)
    x,y=p['a']*math.cos(t), p['b']*math.sin(t)
    dx,dy=-p['a']*math.sin(t), p['b']*math.cos(t)
    X=p['cx']+x*math.cos(r)-y*math.sin(r); Y=p['cy']+x*math.sin(r)+y*math.cos(r)
    DX=dx*math.cos(r)-dy*math.sin(r); DY=dx*math.sin(r)+dy*math.cos(r)
    return X,Y,DX,DY
def _edge(p, side, n):
    """sample edge points + derivative (d/du) with u in [0,1]"""
    pts=[]
    for i in range(n+1):
        u=i/n; th=p['th0']+p['sweep']*u
        X,Y,DX,DY=_pt(p,th); L=math.hypot(DX,DY); nx,ny=DY/L,-DX/L
        w=0.5*(p['w0']+(p['w1']-p['w0'])*u**p['k'])
        pts.append((X+side*nx*w, Y+side*ny*w))
    return pts
def _bez(pts, closed=False):
    """Catmull-Rom style tangents on dense samples, subsampled to knots, emitted as cubic segments"""
    return pts
def outline_d(p):
    n=p['knots']; dense=400
    def curve(side):
        P=_edge(p,side,dense)
        # tangent by central differences on dense samples
        idx=[round(i*dense/n) for i in range(n+1)]
        seg=[]
        for a,b in zip(idx[:-1],idx[1:]):
            h=(b-a)
            def tan(i):
                i0,i1=max(i-1,0),min(i+1,dense); return ((P[i1][0]-P[i0][0])/(i1-i0),(P[i1][1]-P[i0][1])/(i1-i0))
            ta,tb=tan(a),tan(b)
            c1=(P[a][0]+ta[0]*h/3, P[a][1]+ta[1]*h/3); c2=(P[b][0]-tb[0]*h/3, P[b][1]-tb[1]*h/3)
            seg.append((P[a],c1,c2,P[b]))
        return seg
    out=curve(+1); inn=curve(-1)
    f=lambda q:'%.2f %.2f'%q
    d='M'+f(out[0][0])
    for s in out: d+=' C'+f(s[1])+' '+f(s[2])+' '+f(s[3])
    # cap at end with line to inner end, run inner backwards, round-ish start cap = straight (hidden under thinness)
    d+=' L'+f(inn[-1][3])
    for s in reversed(inn): d+=' C'+f(s[2])+' '+f(s[1])+' '+f(s[0])
    return d+' Z'
def head_xy(p):
    X,Y,_,_=_pt(p,p['th0']+p['sweep']); return X,Y
def comet_d(p, union=True):
    tail=outline_d(p); hx,hy=head_xy(p); hd=circle_d(hx,hy,p['w1']*p['head']/2)
    if not union: return tail+' '+hd
    a=pathops.Path(); b=pathops.Path()
    from fontTools.svgLib.path import parse_path
    from fontTools.pens.recordingPen import RecordingPen
    def topath(d,P):
        rp=RecordingPen(); parse_path(d,rp)
        pen=P.getPen()
        for op,args in rp.value: getattr(pen,op)(*args)
    topath(tail,a); topath(hd,b)
    res=pathops.op(a,b,pathops.PathOp.UNION)
    from fontTools.pens.svgPathPen import SVGPathPen
    sp=SVGPathPen(None); res.draw(sp); return sp.getCommands()
def parts_c(p):
    hx,hy=head_xy(p); return dict(head=(hx,hy), head_r=p['w1']*p['head']/2)
