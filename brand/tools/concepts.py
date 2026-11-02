import sys, math; sys.path.insert(0,'tools')
from geom import ellipse_d, circle_d
from typo import path_d
INS='fonts/InstrumentSans[wdth,wght].ttf'; AX=(('wght',500),('wdth',100))

def perihelion(rot=0, a=430, ratio=0.8, tL=78, tR=18, tV=45, dot=46):
    b = a*ratio; cx=cy=500
    ai = a-(tL+tR)/2; sh=(tL-tR)/2; bi=b-tV
    c = math.sqrt(a*a-b*b)
    r=math.radians(rot)
    ix, iy = cx+sh*math.cos(r), cy+sh*math.sin(r)
    fx, fy = cx-c*math.cos(r), cy-c*math.sin(r)
    return ellipse_d(cx,cy,a,b,rot) + " " + ellipse_d(ix,iy,ai,bi,rot,ccw=True) + " " + circle_d(fx,fy,dot)

def rasterkern(R=440, s=58, gamma=1.25):
    d=''; cx=cy=500
    rows=int(R/(s*0.866))+2
    for j in range(-rows,rows+1):
        for i in range(-rows-2,rows+3):
            x=cx+(i+0.5*(j%2))*s; y=cy+j*s*0.866
            dist=math.hypot(x-cx,y-cy)
            if dist>R: continue
            r=0.5*s*0.98*(1-(dist/R)**gamma)
            if r<2.5: continue
            d+=circle_d(x,y,r)+' '
    return d

def comet_ring(cx, cy, rc, wmax, start=-90, sweep=330, head=1.3, n=120):
    """Closed tapered loop: centerline circle radius rc, width 0->wmax along sweep, round head at end."""
    outer=[];inner=[]
    for k in range(n+1):
        t=k/n; ang=math.radians(start+sweep*t)
        w=wmax*(t**0.9)*0.5
        outer.append((cx+(rc+w)*math.cos(ang), cy+(rc+w)*math.sin(ang)))
        inner.append((cx+(rc-w)*math.cos(ang), cy+(rc-w)*math.sin(ang)))
    pts=outer+inner[::-1]
    d='M'+' L'.join('%.1f %.1f'%p for p in pts)+' Z'
    ang=math.radians(start+sweep)
    d+=' '+circle_d(cx+rc*math.cos(ang), cy+rc*math.sin(ang), wmax*head/2)
    return d
