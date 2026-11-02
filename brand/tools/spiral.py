import sys, math; sys.path.insert(0,'tools')
from geom import circle_d
def ss(a,b,x):
    t=min(max((x-a)/(b-a),0),1); return t*t*(3-2*t)
# Spiral "o": centreline starts on the outer radius, keeps an o-like ring for most of the first turn,
# then tightens toward the core. Screen coords, 1000 box. Angles in degrees, screen (y down), negative sweep = counter-clockwise.
SPIRAL = dict(cx=500, cy=500, rc=392, start=-62, sweep=-450, drop1=(0.48,0.80,0.36), w0=50, w1=100, k=1.0, head=1.55, n=480, sx=1.0)
def centre(p, u):
    th=math.radians(p['start']+p['sweep']*u)
    a1,b1,d1=p['drop1']
    r=p['rc']*(1-d1*ss(a1,b1,u))*(1-ss(b1-0.02,1.0,u))
    return p['cx']+p['sx']*r*math.cos(th), p['cy']+r*math.sin(th), r
def width(p,u): return p['w0']+(p['w1']-p['w0'])*u**p['k']
def samples(p):
    pts=[centre(p,i/p['n']) for i in range(p['n']+1)]
    return pts
def outline_d(p, knots=16):
    n=p['n']; P=[centre(p,i/n)[:2] for i in range(n+1)]
    # end head position = final centre point; the tail ends when it reaches head radius
    hx,hy=P[-1]; hr=p['w1']*p['head']/2
    E={+1:[],-1:[]}
    for i in range(n+1):
        a=P[max(i-1,0)]; b=P[min(i+1,n)]; dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy) or 1
        nx,ny=dy/L,-dx/L; w=width(p,i/n)/2
        for s in (1,-1): E[s].append((P[i][0]+s*nx*w, P[i][1]+s*ny*w))
    # cut the part that lies inside the head
    last=n
    while last>0 and math.hypot(P[last][0]-hx,P[last][1]-hy)<hr*0.55: last-=1
    idx=[round(i*last/knots) for i in range(knots+1)]
    def curve(pts):
        segs=[]
        for a,b in zip(idx[:-1],idx[1:]):
            h=b-a
            def tan(i):
                i0,i1=max(i-1,0),min(i+1,n); return ((pts[i1][0]-pts[i0][0])/(i1-i0),(pts[i1][1]-pts[i0][1])/(i1-i0))
            ta,tb=tan(a),tan(b)
            segs.append((pts[a],(pts[a][0]+ta[0]*h/3,pts[a][1]+ta[1]*h/3),(pts[b][0]-tb[0]*h/3,pts[b][1]-tb[1]*h/3),pts[b]))
        return segs
    o=curve(E[1]); i_=curve(E[-1]); f=lambda q:'%.2f %.2f'%q
    d='M'+f(o[0][0])
    for s in o: d+=' C'+f(s[1])+' '+f(s[2])+' '+f(s[3])
    d+=' L'+f(i_[-1][3])
    for s in reversed(i_): d+=' C'+f(s[2])+' '+f(s[1])+' '+f(s[0])
    # round start cap
    return d+' Z', (hx,hy,hr)
