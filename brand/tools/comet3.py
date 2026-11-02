"""Ronde D: staart en kop vloeiend verbonden (raaklijnen), staart met minimale dikte en ronde punt, smalle witte rand tussen kop en staart."""
import sys, math; sys.path.insert(0,'tools')
from geom import circle_d
from final import _P, _D, _clean
from comet2 import pt
import pathops
def width(p,u):  # u=0 at tip, 1 at joint
    return p['wmin']+(p['wj']-p['wmin'])*u**p['k']
def tail_poly(p, n=500):
    """tail from tip to the joint point (a bit behind the head centre), as a sampled outline with a round tip"""
    th_h=p['head_at']; th_tip=th_h+p['sweep']; th_j=th_h+p['joint']*(1 if p['sweep']>0 else -1)
    L=[];R=[]; C=[]
    for i in range(n+1):
        u=i/n; th=th_tip+(th_j-th_tip)*u
        X,Y,DX,DY=pt(p,th); l=math.hypot(DX,DY); nx,ny=DY/l,-DX/l; w=width(p,u)/2
        L.append((X+nx*w,Y+ny*w)); R.append((X-nx*w,Y-ny*w)); C.append((X,Y,w))
    return L,R,C
def fit(pts, knots):
    n=len(pts)-1; idx=[round(i*n/knots) for i in range(knots+1)]; out=[]
    for a,b in zip(idx[:-1],idx[1:]):
        h=b-a
        def tan(i):
            i0,i1=max(i-1,0),min(i+1,n); return ((pts[i1][0]-pts[i0][0])/(i1-i0),(pts[i1][1]-pts[i0][1])/(i1-i0))
        ta,tb=tan(a),tan(b); out.append((pts[a],(pts[a][0]+ta[0]*h/3,pts[a][1]+ta[1]*h/3),(pts[b][0]-tb[0]*h/3,pts[b][1]-tb[1]*h/3),pts[b]))
    return out
def tangents(c1, r1, c2, r2):
    """outer tangent points between circle1 (small, tail end) and circle2 (head)"""
    dx,dy=c2[0]-c1[0],c2[1]-c1[1]; d=math.hypot(dx,dy); a=math.atan2(dy,dx); b=math.acos((r1-r2)/d)
    pts=[]
    for s in (1,-1):
        ang=a+s*b
        pts.append(((c1[0]+r1*math.cos(ang),c1[1]+r1*math.sin(ang)),(c2[0]+r2*math.cos(ang),c2[1]+r2*math.sin(ang))))
    return pts
def head(p): X,Y,_,_=pt(p,p['head_at']); return X,Y,p['hr']
def head_d(p): x,y,r=head(p); return circle_d(x,y,r)
def comet_mono(p, knots=12):
    L,R,C=tail_poly(p); f=lambda q:'%.2f %.2f'%q
    o=fit(L,knots); i_=fit(R,knots)
    d='M'+f(o[0][0])
    for s in o: d+=' C'+f(s[1])+' '+f(s[2])+' '+f(s[3])
    d+=' L'+f(i_[-1][3])
    for s in reversed(i_): d+=' C'+f(s[2])+' '+f(s[1])+' '+f(s[0])
    d+=' Z'
    tip=C[0]; tipcap=circle_d(tip[0],tip[1],tip[2])
    end=C[-1]; hx,hy,hr=head(p)
    (a1,b1),(a2,b2)=tangents((end[0],end[1]),end[2],(hx,hy),hr)
    bridge=f'M{f(a1)} L{f(b1)} L{f(b2)} L{f(a2)} Z'
    endcap=circle_d(end[0],end[1],end[2])
    P=_P(d)
    for extra in (tipcap,endcap,bridge,head_d(p)):
        P=pathops.op(P,_P(extra),pathops.PathOp.UNION)
    return P
def mono_d(p): 
    P=comet_mono(p)
    if p.get('gap'):
        x,y,r=head(p)
        ring=pathops.op(_P(circle_d(x,y,r+p['gap'])),_P(circle_d(x,y,r)),pathops.PathOp.DIFFERENCE)
        P=pathops.op(P,ring,pathops.PathOp.DIFFERENCE)
    return _clean(_D(P))
def tail_d(p):
    x,y,r=head(p)
    return _clean(_D(pathops.op(_P(mono_d(p)),_P(circle_d(x,y,r+ (p.get('gap') or 0)-0.01 if p.get('gap') else r)),pathops.PathOp.DIFFERENCE)))
def inner(p, ink, headc=None):
    if headc and headc!=ink:
        if p.get('gap'): return f'<path fill="{ink}" d="{tail_d(p)}"/><path fill="{headc}" d="{head_d(p)}"/>'
        # no gap: tail continues under the head, red head on top (overlap, no seam)
        return f'<path fill="{ink}" d="{mono_d(p)}"/><path fill="{headc}" d="{head_d(p)}"/>'
    return f'<path fill="{ink}" d="{mono_d(p)}"/>'
def bbox(p):
    u=_P(mono_d(p)).bounds; return u[0],u[1],u[2]-u[0],u[3]-u[1]
