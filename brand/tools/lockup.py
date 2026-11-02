import sys, math; sys.path.insert(0,'tools')
from mark import *
from word import wordmark
def mark_bbox(p):
    a=p['a']; b=a*p['ratio']; r=math.radians(p['rot'])
    hw=math.sqrt((a*math.cos(r))**2+(b*math.sin(r))**2); hh=math.sqrt((a*math.sin(r))**2+(b*math.cos(r))**2)
    return p['cx']-hw, p['cy']-hh, 2*hw, 2*hh
def mark_g(p, x, y, h, ink='#000', dotc=None):
    """place mark so its ellipse bbox top-left at (x,y) with height h px"""
    bx,by,bw,bh=mark_bbox(p); s=h/bh
    t=f'translate({x-bx*s:.2f},{y-by*s:.2f}) scale({s:.5f})'
    return f'<g transform="{t}"><path fill="{ink}" fill-rule="evenodd" d="{ring_d(p)}"/><path fill="{dotc or ink}" d="{dot_d(p)}"/></g>', bw*s, bh
def horizontal(p=MASTER, size=200, x0=0, y0=0, k_h=1.30, k_gap=0.55, ink='#000', dotc=None):
    """size = wordmark font size. symbol height = k_h * ascender height; centred on x-height centre.
    gap = k_gap * symbol height. Returns svg fragment, total w, total h, and boxes."""
    asc=0.732*size; xh=0.510*size
    h=k_h*asc
    base=y0+ (h/2 + xh/2)  # baseline so that x-height centre = symbol centre
    sy=y0
    g,bw,_=mark_g(p,x0,sy,h,ink,dotc)
    gx=x0+bw+k_gap*h
    d,w,m=wordmark(size,gx-m_lsb(size),base)
    frag=g+f'<path fill="{ink}" d="{d}"/>'
    total_w=gx+ (w - (33+26-10*0)*size/1000) - x0
    return frag, total_w, max(h, base-y0+0.01*size)
def m_lsb(size): return 33*size/1000
