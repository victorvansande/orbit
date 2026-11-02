import sys, io; sys.path.insert(0,'tools')
from r6 import *
from word import wordmark
from typo import path_d
import cairosvg, numpy as np
from PIL import Image, ImageDraw
INKD='#ECECF1'; PAPER='#F1F1EF'; BGD='#0F0F12'
SERIF='fonts/InstrumentSerif-Italic.ttf'
DIRS={'A':topo(n=3,w=50,rin=150,bunch=0.92),
      'B':brush_o(),
      'C':f'<path fill="{INK}" fill-rule="evenodd" d="{ellipse_d(500,500,440,440)} {ellipse_d(440,560,250,150,-32,ccw=True)}"/>'}
def dark(b): return b.replace(INK,INKD)
def svg(b,bg=None,rx=0):
    bgel=f'<rect width="1000" height="1000" rx="{rx}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">{bgel}{b}</svg>'
def ras(s,w,h=None,bg=None):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(),output_width=w,output_height=h or w,background_color=bg))).convert('RGBA')
def bbox(b):
    a=np.array(ras(svg(b),1000))[...,3]>8; ys,xs=np.nonzero(a); return xs.min(),ys.min(),xs.max()-xs.min(),ys.max()-ys.min()
def icon(b,bg,scale=0.66,rx=0):
    x,y,w,h=bbox(b); s=scale*1000/max(w,h); tx=500-(x+w/2)*s; ty=500-(y+h/2)*s
    return svg(f'<g transform="translate({tx:.1f},{ty:.1f}) scale({s:.4f})">{b}</g>',bg=bg,rx=rx)
def word(k,size,x0,base):
    if k=='B':
        d,w,_=path_d(SERIF,'orbit',(),size=size*1.18,x0=x0,y0=base); return d,w
    d,w,_=wordmark(size,x0-33*size/1000,base); return d,w
def lockup(k,size=120):
    b=DIRS[k]; x,y,w,h=bbox(b); asc=0.732*size; H=1.1*asc; s=H/h; gap=0.40*H
    base=H*0.5+0.255*size
    d,ww=word(k,size,w*s+gap,base)
    W=w*s+gap+ww
    body=f'<g transform="translate({-x*s:.1f},{-y*s:.1f}) scale({s:.4f})">{b}</g><path fill="{INK}" d="{d}"/>'
    top=min(0, base-0.80*size*(1.18 if k=='B' else 1)); bot=max(H,base+0.25*size)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {top:.0f} {W:.0f} {bot-top:.0f}">{body}</svg>', W, bot-top
def sheet(k,out):
    b=DIRS[k]; S=Image.new('RGB',(1400,520),PAPER)
    big=ras(icon(b,None,0.9),400); S.paste(big,(20,40),big)
    for i,(bg,bb) in enumerate(((PAPER,b),(BGD,dark(b)))):
        im=ras(icon(bb,bg,0.62,223),180)
        if bg==PAPER: ImageDraw.Draw(S).rounded_rectangle((459,39,640,220),radius=40,outline=(200,200,198))
        S.paste(im,(460+i*200,40),im)
    for i,px in enumerate((64,32,16)):
        im=ras(icon(b,PAPER,0.7,223),px); S.paste(im,(460+i*90,250),im)
    im=ras(icon(b,PAPER,0.7,223),32).resize((150,150),Image.NEAREST); S.paste(im,(460,330),im)
    im=ras(icon(b,PAPER,0.7,223),16).resize((150,150),Image.NEAREST); S.paste(im,(630,330),im)
    ls,W,H=lockup(k,100); sc=480/W; im=ras(ls,480,int(H*sc)); S.paste(im,(890,90),im)
    ls,W,H=lockup(k,24); im=ras(ls,int(W),int(H)); S.paste(im,(890,300),im)
    S.save(out)
