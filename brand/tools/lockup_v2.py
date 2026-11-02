import sys; sys.path.insert(0,'tools')
from mark_v2 import *
from word import wordmark
INK='#1B1B22'; RED='#E70049'
def place_mark(p, x, y_top, h, ink, headc):
    bx,by,bw,bh=bbox(p); s=h/bh
    return f'<g transform="translate({x-bx*s:.2f},{y_top-by*s:.2f}) scale({s:.5f})">{inner(p,ink,headc)}</g>', bw*s
def horizontal(size=200, x0=0, y0=0, kh=1.04, kgap=None, mode='base', ink=INK, headc=RED, p=MASTER):
    """size: wordmark font size. y0 = top of the lockup box. mode 'base': mark bottom sits 1.5% below baseline (overshoot), top near ascender."""
    asc=0.732*size; xh=0.510*size; h=kh*asc
    if mode=='base':
        base=y0+h-0.015*size
    else:
        base=y0+h/2+xh/2
    g,mw=place_mark(p,x0,y0,h,ink,headc)
    bx,by,bw,bh=bbox(p); D=2*p['hr']*h/bh
    gx=x0+mw+(kgap*h if kgap is not None else 1.6*D)
    d,w,m=wordmark(size,gx-33*size/1000,base)
    wd=w-(33+26)*size/1000   # ink width of wordmark
    return g+f'<path fill="{ink}" d="{d}"/>', (gx+wd)-x0, h, base
def stacked(size=200, cx=0, y0=0, kh=1.9, kgap=0.34, ink=INK, headc=RED, p=MASTER):
    """mark above wordmark, centred on the wordmark ink width. kh: mark height in x-heights... relative to ascender"""
    asc=0.732*size; h=kh*asc
    bx,by,bw,bh=bbox(p); mw=bw*h/bh
    g,_=place_mark(p,cx-mw/2,y0,h,ink,headc)
    d0,w,_=wordmark(size,0,0); wd=w-(33+26)*size/1000
    base=y0+h+kgap*h+asc
    d,_,_=wordmark(size,cx-wd/2-33*size/1000,base)
    return g+f'<path fill="{ink}" d="{d}"/>', max(mw,wd), base-y0
