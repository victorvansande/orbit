"""Orbit mark, final construction (round 3+). 1000-unit box."""
import sys, math; sys.path.insert(0,'tools')
from comet import _pt, outline_d
from geom import circle_d
import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
# centreline: ellipse a x b, tilted rot deg; tail runs counter-clockwise (screen) from th0 over sweep; width w0 -> w1 with exponent k; head diameter = head * w1
MASTER = dict(a=380, b=300, rot=-32, cx=500, cy=500, th0=511, sweep=-356, w0=26, w1=88,  k=1.5, head=1.7, knots=10, core=38)
SMALL  = dict(a=400, b=316, rot=-32, cx=500, cy=500, th0=511, sweep=-354, w0=78, w1=120, k=1.0, head=1.65, knots=8, core=0)
def _P(d):
    p=pathops.Path(); rp=RecordingPen(); parse_path(d,rp); pen=p.getPen()
    for op,args in rp.value: getattr(pen,op)(*args)
    return p
def _D(p):
    sp=SVGPathPen(None); p.draw(sp); return sp.getCommands()
def head(p):
    X,Y,_,_=_pt(p,p['th0']+p['sweep']); return X,Y,p['w1']*p['head']/2
def tail_raw(p): return outline_d(p)
def head_d(p): x,y,r=head(p); return circle_d(x,y,r)
def mono_d(p):
    return _D(pathops.op(_P(tail_raw(p)),_P(head_d(p)),pathops.PathOp.UNION))
def tail_d(p):
    """tail with the head cut out (no overlapping paths in two-colour version)"""
    return _D(pathops.op(_P(tail_raw(p)),_P(head_d(p)),pathops.PathOp.DIFFERENCE))
def bbox(p):
    b=_P(mono_d(p)).bounds; return b[0],b[1],b[2]-b[0],b[3]-b[1]
def core(p):
    a,b=p['a'],p['b']; c=math.sqrt(a*a-b*b); r=math.radians(p['rot'])
    return p['cx']-c*math.cos(r), p['cy']-c*math.sin(r), p.get('core',0)
def core_d(p):
    x,y,r=core(p); return circle_d(x,y,r) if r else ''
def mark_svg_inner(p, ink, headc=None):
    cd=core_d(p); cpath=f'<path fill="{ink}" d="{cd}"/>' if cd else ''
    if headc and headc!=ink:
        return f'<path fill="{ink}" d="{tail_d(p)}"/><path fill="{headc}" d="{head_d(p)}"/>'+cpath
    return f'<path fill="{ink}" d="{mono_d(p)}"/>'+cpath

def _clean(d, tol=2.0):
    """drop degenerate cubic segments shorter than tol units (pathops intersection slivers)"""
    import re, math
    out=[]; cur=None; start=None
    for c,a in re.findall(r'([MLCQZ])([^MLCQZ]*)',d):
        n=[float(v) for v in re.findall(r'-?[\d.]+(?:e-?\d+)?',a)]
        if c=='M': cur=(n[0],n[1]); start=cur; out.append(['M',n]); continue
        if c=='Z': out.append(['Z',[]]); cur=start; continue
        end=(n[-2],n[-1])
        if math.hypot(end[0]-cur[0],end[1]-cur[1])<tol and out[-1][0] in 'CL':
            out[-1][1][-2:]=list(end)  # move previous end onto this end
        else: out.append([c,n])
        cur=end
    return ' '.join(c+' '.join('%.2f'%v for v in n) for c,n in out)
_mono_raw=mono_d; _tail_raw=tail_d
def mono_d(p): return _clean(_mono_raw(p))
def tail_d(p): return _clean(_tail_raw(p))
