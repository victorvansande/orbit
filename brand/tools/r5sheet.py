import sys, io; sys.path.insert(0,'tools')
from r5 import *
from word import wordmark
import cairosvg, numpy as np
from PIL import Image, ImageDraw
INKD='#ECECF1'; REDD='#F0306A'; PAPER='#F1F1EF'; BGD='#0F0F12'
DIRS={'A':well(n=5,s=190,r0=26,W=(420,580),sigma=260,pull=0.42,grow=1.3,core=62),
      'B':hexcomet3(s=112,R=205,L=650),
      'C':flyby2(e=1.05,rperi=150,rmax=430,rot=-150,w0=20,w1=104,sig=0.95)}
def dark(b): return b.replace(INK,INKD).replace(RED,REDD)
def svg(b,vb='0 0 1000 1000',bg=None,rx=0):
    bgel=f'<rect width="1000" height="1000" rx="{rx}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{bgel}{b}</svg>'
def ras(s,w,h=None,bg=None):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(),output_width=w,output_height=h or w,background_color=bg))).convert('RGBA')
def bbox(b):
    a=np.array(ras(svg(b),1000))[...,3]>8; ys,xs=np.nonzero(a); return xs.min(),ys.min(),xs.max()-xs.min(),ys.max()-ys.min()
def icon(b,bg,scale=0.66,rx=0):
    x,y,w,h=bbox(b); s=scale*1000/max(w,h); tx=500-(x+w/2)*s; ty=500-(y+h/2)*s
    return svg(f'<g transform="translate({tx:.1f},{ty:.1f}) scale({s:.4f})">{b}</g>',bg=bg,rx=rx)
def lockup(b,size=120,ink=INK):
    x,y,w,h=bbox(b); asc=0.732*size; H=1.12*asc; s=H/h; gap=0.42*H
    base=H*0.5+0.255*size  # centre on x-height
    d,ww,_=wordmark(size, w*s+gap-33*size/1000, base)
    W=w*s+gap+ww
    body=f'<g transform="translate({-x*s:.1f},{-y*s:.1f}) scale({s:.4f})">{b}</g><path fill="{ink}" d="{d}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {max(H,base+12):.0f}">{body}</svg>', W, max(H,base+12)
def sheet(k, out):
    b=DIRS[k]; S=Image.new('RGB',(1400,560),PAPER); D=ImageDraw.Draw(S)
    S.paste(ras(icon(b,None,0.9),420),(20,40),ras(icon(b,None,0.9),420))
    for i,(bg,bb,rx) in enumerate(((PAPER,b,223),(BGD,dark(b),223))):
        im=ras(icon(bb,bg,0.62,rx),200,bg=None); S.paste(im,(470+i*220,40),im)
    for i,px in enumerate((64,32,16)):
        im=ras(icon(b,PAPER,0.7,223),px); S.paste(im,(470+i*90,270),im)
    im=ras(icon(b,PAPER,0.7,223),32).resize((160,160),Image.NEAREST); S.paste(im,(470,330),im)
    im=ras(icon(b,PAPER,0.7,223),16).resize((160,160),Image.NEAREST); S.paste(im,(650,330),im)
    ls,W,H=lockup(b); im=ras(ls,int(W*1.6),int(H*1.6)); S.paste(im,(880,80),im)
    ls,W,H=lockup(b,size=26); im=ras(ls,int(W),int(H)); S.paste(im,(880,300),im)
    S.save(out)
