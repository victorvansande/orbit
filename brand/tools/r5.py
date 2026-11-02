import sys, math; sys.path.insert(0,'tools')
from geom import circle_d
INK='#1B1B22'; RED='#E70049'
def well(n=7, s=120, W=(380,620), sigma=210, pull=0.55, grow=1.6, r0=17, core=46, clip=True):
    """square grid of dots pulled toward well W; dots grow near W. Returns svg body."""
    body=''; off=500-(n-1)*s/2
    for j in range(n):
        for i in range(n):
            x=off+i*s; y=off+j*s
            dx,dy=W[0]-x,W[1]-y; d=math.hypot(dx,dy); g=math.exp(-(d*d)/(sigma*sigma))
            if d<1: continue
            m=min(pull*g*d, d-core-14)    # move toward W, never into the core
            x2,y2=x+dx/d*m, y+dy/d*m
            r=r0*(1+grow*g)
            body+=f'<path fill="{INK}" d="{circle_d(x2,y2,r)}"/>'
    body+=f'<path fill="{RED}" d="{circle_d(W[0],W[1],core)}"/>'
    return body
def hexcomet(s=72, head=(330,670), dirdeg=-40, L=640, R=150, curve=0.0012, gamma=0.8, redcut=0.82):
    """halftone a soft comet field on a hex grid; dot radius ~ sqrt(ink)."""
    body=''; ux,uy=math.cos(math.radians(dirdeg)), math.sin(math.radians(dirdeg))
    rows=int(1000/(s*0.866))+2
    for j in range(-1,rows):
        for i in range(-1,int(1000/s)+2):
            x=(i+0.5*(j%2))*s; y=j*s*0.866
            px,py=x-head[0],y-head[1]
            t=px*ux+py*uy; q=-px*uy+py*ux        # along tail (t>0), across
            q-=curve*t*t                             # slight bend
            if t<0: ink=max(0,1-math.hypot(px,py)/R)
            else:
                w=R*(1-t/L)
                ink=0 if w<=0 else max(0,1-abs(q)/w)*(1-t/L)**gamma
            if ink<=0.04: continue
            r=0.5*s*0.96*math.sqrt(ink)
            col=RED if (t<R*0.35 and math.hypot(px,py)<R*0.62) else INK
            body+=f'<path fill="{col}" d="{circle_d(x,y,r)}"/>'
    return body
def flyby(core=(560,540), cr=58, a=300, e=1.35, w0=12, w1=96, rot=-35, n=300, span=2.15):
    """hyperbola-like flyby around core: r(f)=p/(1+e cos f); width peaks at periapsis."""
    p=a*(e-1) if e>1 else a
    pts=[]; rr=math.radians(rot)
    fmax=math.acos(-1/e)*0.86 if e>1 else math.pi*0.9
    for k in range(n+1):
        f=-fmax+2*fmax*k/n
        r=p/(1+e*math.cos(f))
        x,y=r*math.cos(f), r*math.sin(f)
        X=core[0]+x*math.cos(rr)-y*math.sin(rr); Y=core[1]+x*math.sin(rr)+y*math.cos(rr)
        w=w0+(w1-w0)*math.exp(-(f/0.75)**2)
        pts.append((X,Y,w))
    L=[];Rr=[]
    for k in range(n+1):
        a0=pts[max(k-1,0)]; b0=pts[min(k+1,n)]; dx,dy=b0[0]-a0[0],b0[1]-a0[1]; l=math.hypot(dx,dy) or 1
        nx,ny=dy/l,-dx/l; X,Y,w=pts[k]
        L.append((X+nx*w/2,Y+ny*w/2)); Rr.append((X-nx*w/2,Y-ny*w/2))
    poly=L+Rr[::-1]
    d='M'+' L'.join('%.1f %.1f'%q for q in poly)+' Z'
    return f'<path fill="{INK}" d="{d}"/><path fill="{RED}" d="{circle_d(core[0],core[1],cr)}"/>'

def flyby2(cr=62, e=1.45, rperi=150, rmax=470, w0=14, w1=100, rot=-135, n=360, sig=0.8):
    p=rperi*(1+e); fl=math.acos(-1/e) if e>1 else math.pi
    pts=[]
    for k in range(n+1):
        f=-fl*0.999+2*fl*0.999*k/n
        r=p/(1+e*math.cos(f))
        if r>rmax: continue
        pts.append((r*math.cos(f), r*math.sin(f), w0+(w1-w0)*math.exp(-(f/sig)**2)))
    rr=math.radians(rot); P=[(x*math.cos(rr)-y*math.sin(rr), x*math.sin(rr)+y*math.cos(rr), w) for x,y,w in pts]
    xs=[q[0] for q in P]+[-cr,cr]; ys=[q[1] for q in P]+[-cr,cr]
    ox=500-(max(xs)+min(xs))/2; oy=500-(max(ys)+min(ys))/2
    P=[(x+ox,y+oy,w) for x,y,w in P]; n=len(P)-1
    L=[];R=[]
    for k in range(n+1):
        a0=P[max(k-1,0)]; b0=P[min(k+1,n)]; dx,dy=b0[0]-a0[0],b0[1]-a0[1]; l=math.hypot(dx,dy) or 1
        nx,ny=dy/l,-dx/l; X,Y,w=P[k]; L.append((X+nx*w/2,Y+ny*w/2)); R.append((X-nx*w/2,Y-ny*w/2))
    d='M'+' L'.join('%.1f %.1f'%q for q in L+R[::-1])+' Z'
    return f'<path fill="{INK}" d="{d}"/><path fill="{RED}" d="{circle_d(ox,oy,cr)}"/>'
def hexcomet2(s=82, head=(300,700), dirdeg=-38, L=600, R=175, gamma=1.0):
    body=''; ux,uy=math.cos(math.radians(dirdeg)), math.sin(math.radians(dirdeg))
    rows=int(1000/(s*0.866))+3
    for j in range(-2,rows):
        for i in range(-2,int(1000/s)+3):
            x=(i+0.5*(j%2))*s; y=j*s*0.866
            px,py=x-head[0],y-head[1]; t=px*ux+py*uy; q=-px*uy+py*ux
            dh=math.hypot(px,py)
            ink_h=max(0,1-dh/R)*1.4
            w=R*max(0,1-t/L) if t>0 else 0
            ink_t=(max(0,1-abs(q)/w)*(1-t/L)**gamma) if w>0 else 0
            ink=min(1,max(ink_h,ink_t))
            if ink<=0.06: continue
            r=0.5*s*0.98*math.sqrt(ink)
            col=RED if dh<R*0.45 else INK
            body+=f'<path fill="{col}" d="{circle_d(x,y,r)}"/>'
    return body

def hexcomet3(s=100, head=(330,670), dirdeg=-38, L=620, R=185, gamma=1.3, hk=1.35, redr=0.45, maxdot=0.98):
    """hex lattice aligned with the comet axis; ink falls off monotonically along the tail."""
    body=''; a=math.radians(dirdeg); ux,uy=math.cos(a),math.sin(a); vx,vy=-uy,ux
    for j in range(-6,7):
        for i in range(-6,12):
            t=(i+0.5*(j%2))*s; q=j*s*0.866
            dh=math.hypot(t,q)
            ink_h=max(0,1-dh/R)*hk
            if t>0:
                w=R*(1-t/L)
                ink_t=0 if w<=0 else (1-t/L)**gamma*max(0,1-(abs(q)/w)**2)
            else: ink_t=0
            ink=min(1,max(ink_h,ink_t))
            if ink<0.07: continue
            x=head[0]+t*ux+q*vx; y=head[1]+t*uy+q*vy
            r=0.5*s*maxdot*math.sqrt(ink)
            body+=f'<path fill="{RED if dh<R*redr else INK}" d="{circle_d(x,y,r)}"/>'
    return body
