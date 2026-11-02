"""Ronde C: echte komeet op een baan. Staart vertrekt bij de kop op tail0 x kopdiameter en loopt taps uit tot een punt."""
import sys, math; sys.path.insert(0,'tools')
from geom import circle_d
from final import _P, _D, _clean
import pathops
def pt(p, th):
    r=math.radians(p['rot']); t=math.radians(th)
    x,y=p['a']*math.cos(t), p['b']*math.sin(t)
    dx,dy=-p['a']*math.sin(t), p['b']*math.cos(t)
    return (p['cx']+x*math.cos(r)-y*math.sin(r), p['cy']+x*math.sin(r)+y*math.cos(r),
            dx*math.cos(r)-dy*math.sin(r), dx*math.sin(r)+dy*math.cos(r))
def width(p,u):  # u=0 at the tip, 1 at the head
    return p['hr']*2*p['tail0']*(p['floor']+(1-p['floor'])*u**p['k'])
def outline(p, n=400, knots=12):
    th_head=p['head_at']; th_tip=th_head+p['sweep']   # sweep>0: tail lies at larger angles
    P=[];N=[]
    for i in range(n+1):
        u=i/n; th=th_tip+(th_head-th_tip)*u
        X,Y,DX,DY=pt(p,th); L=math.hypot(DX,DY); nx,ny=DY/L,-DX/L
        w=width(p,u)/2; P.append((X+nx*w,Y+ny*w)); N.append((X-nx*w,Y-ny*w))
    idx=[round(i*n/knots) for i in range(knots+1)]
    def segs(pts):
        out=[]
        for a,b in zip(idx[:-1],idx[1:]):
            h=b-a
            def tan(i):
                i0,i1=max(i-1,0),min(i+1,n); return ((pts[i1][0]-pts[i0][0])/(i1-i0),(pts[i1][1]-pts[i0][1])/(i1-i0))
            ta,tb=tan(a),tan(b); out.append((pts[a],(pts[a][0]+ta[0]*h/3,pts[a][1]+ta[1]*h/3),(pts[b][0]-tb[0]*h/3,pts[b][1]-tb[1]*h/3),pts[b]))
        return out
    o=segs(P); i_=segs(N); f=lambda q:'%.2f %.2f'%q
    d='M'+f(o[0][0])
    for s in o: d+=' C'+f(s[1])+' '+f(s[2])+' '+f(s[3])
    d+=' L'+f(i_[-1][3])
    for s in reversed(i_): d+=' C'+f(s[2])+' '+f(s[1])+' '+f(s[0])
    return d+' Z'
def head(p): X,Y,_,_=pt(p,p['head_at']); return X,Y,p['hr']
def head_d(p): x,y,r=head(p); return circle_d(x,y,r)
def mono_d(p): return _clean(_D(pathops.op(_P(outline(p)),_P(head_d(p)),pathops.PathOp.UNION)))
def tail_d(p): return _clean(_D(pathops.op(_P(outline(p)),_P(head_d(p)),pathops.PathOp.DIFFERENCE)))
def inner(p, ink, headc=None):
    if headc and headc!=ink: return f'<path fill="{ink}" d="{tail_d(p)}"/><path fill="{headc}" d="{head_d(p)}"/>'
    return f'<path fill="{ink}" d="{mono_d(p)}"/>'
def bbox(p):
    u=_P(mono_d(p)).bounds; return u[0],u[1],u[2]-u[0],u[3]-u[1]
