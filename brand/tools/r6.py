import sys, math; sys.path.insert(0,'tools')
from geom import circle_d, ellipse_d
import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
INK='#1B1B22'; RED='#E70049'
def _P(d):
    p=pathops.Path(); rp=RecordingPen(); parse_path(d,rp); pen=p.getPen()
    for op,args in rp.value: getattr(pen,op)(*args)
    return p
def _D(p): sp=SVGPathPen(None); p.draw(sp); return sp.getCommands()
def stroke_d(d, w, cap=pathops.LineCap.ROUND_CAP):
    p=_P(d); p.stroke(w, cap, pathops.LineJoin.ROUND_JOIN, 4); p.convertConicsToQuads(); p.simplify(); return _D(p)
def topo(n=4, R=440, rin=120, w=34, ang=225, bunch=0.75, ratio=1.0):
    """nested circles, centres shifted toward angle ang so lines bunch on that side."""
    a=math.radians(ang); body=''
    for k in range(n):
        t=k/(n-1)
        r=R-(R-rin)*t
        off=(R-r)*bunch        # the smaller, the more shifted
        cx=500+math.cos(a)*off; cy=500-math.sin(a)*off
        body+=f'<path fill="{INK}" d="{stroke_d(ellipse_d(cx,cy,r-w/2,(r-w/2)*ratio),w)}"/>'
    return body
def loop_o(w=70, rx=300, ry=360, slant=14, over=60, tail=150):
    """one drawn stroke: starts at the top right, runs counter-clockwise around, overshoots its start and flicks out."""
    sl=math.tan(math.radians(slant)); pts=[]
    N=200; start=70; sweep=360+over
    for i in range(N+1):
        th=math.radians(start+sweep*i/N)
        x=rx*math.cos(th); y=-ry*math.sin(th)
        pts.append((500+x - y*sl, 520+y))
    # flick out to the right
    lx,ly=pts[-1]; px,py=pts[-2]; dx,dy=lx-px,ly-py; L=math.hypot(dx,dy)
    d='M'+' L'.join('%.1f %.1f'%q for q in pts)+' L%.1f %.1f'%(lx+dx/L*tail, ly+dy/L*tail*0.6)
    return f'<path fill="{INK}" d="{stroke_d(d,w)}"/>'
def stack(n=3, w0=700, h0=200, rx=60, gap=0.62, shift=(70,-120), shrink=0.72):
    body=''; items=[]
    x,y,w,h=150,560,w0,h0
    for k in range(n):
        items.append((x,y,w,h)); x+=shift[0]; y+=shift[1]; w*=shrink; h*=shrink; 
    for k,(x,y,w,h) in reversed(list(enumerate(items))):
        col=INK
        body+=f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx*(h/h0):.1f}" fill="{col}" stroke="#F1F1EF" stroke-width="{28*(h/h0):.1f}"/>'
    return body

def lens(n=7, R=330, c=(500,500), mag=0.55, base_w=0.22, box=(100,900)):
    """horizontal stripes; inside a circle the stripes bulge (fisheye) and thicken. Built from sampled polygons."""
    body=''; x0,x1=box; H=x1-x0; pitch=H/n
    for k in range(n):
        yc=x0+pitch*(k+0.5); top=[]; bot=[]
        for i in range(161):
            x=x0+(x1-x0)*i/160
            dx=x-c[0]
            def warp(y):
                dy=y-c[1]; r=math.hypot(dx,dy)
                if r>=R: return y
                f=(1-(r/R)**2)**1.5
                return c[1]+dy*(1+mag*f)
            hw=pitch*base_w*(1+1.6*max(0,1-(math.hypot(dx,yc-c[1])/R)**2))
            top.append((x,warp(yc-hw))); bot.append((x,warp(yc+hw)))
        d='M'+' L'.join('%.1f %.1f'%q for q in top+bot[::-1])+' Z'
        body+=f'<path fill="{INK}" d="{d}"/>'
    return f'<clipPath id="sq"><rect x="{x0}" y="{x0}" width="{H}" height="{H}" rx="0"/></clipPath><g clip-path="url(#sq)">{body}</g>'
def brush_o(cx=500, cy=520, rx=290, ry=350, nib=150, ang=-35, slant=12, start=60, sweep=320, k=0.5):
    """broad-nib o: width varies with stroke direction relative to a fixed nib angle; open at the top right"""
    sl=math.tan(math.radians(slant)); na=math.radians(ang); L=[];R=[]
    N=240
    for i in range(N+1):
        th=math.radians(start+sweep*i/N)
        x=rx*math.cos(th); y=-ry*math.sin(th)
        X=cx+x-y*sl; Y=cy+y
        L.append((X+math.cos(na)*nib/2, Y+math.sin(na)*nib/2)); R.append((X-math.cos(na)*nib/2, Y-math.sin(na)*nib/2))
    d='M'+' L'.join('%.1f %.1f'%q for q in L+R[::-1])+' Z'
    return f'<path fill="{INK}" d="{d}"/>'

def hollow(R=440, r=175, off=150, ang=225, shape='circle'):
    a=math.radians(ang); hx=500+math.cos(a)*off; hy=500-math.sin(a)*off
    outer=ellipse_d(500,500,R,R) if shape=='circle' else ''
    return f'<path fill="{INK}" fill-rule="evenodd" d="{outer} {ellipse_d(hx,hy,r,r,ccw=True)}"/>'
