import sys, math, io; sys.path.insert(0,'tools')
from mark_v2 import *
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import numpy as np, cairosvg
from tests import photo, label
INK='#1B1B22'; PAPER='#F1F1EF'; RED='#E70049'; INK_D='#ECECF1'; RED_D='#F0306A'; BG_D='#0F0F12'
def msvg(p, ink=INK, headc=None, bg=None):
    b=f'<rect x="-2000" y="-2000" width="5000" height="5000" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">{b}{inner(p,ink,headc)}</svg>'
def centroid(p):
    im=np.array(ras(msvg(p),1000,'white').convert('L'))<128; ys,xs=np.nonzero(im); return xs.mean(),ys.mean()
def icon_svg(p, bg=PAPER, ink=INK, headc=RED, scale=0.64, comp=0.45, rx=None):
    bx,by,bw,bh=bbox(p); cx,cy=centroid(p); s=scale*1000/bw
    ox=(bx+bw/2)+comp*(cx-(bx+bw/2)); oy=(by+bh/2)+comp*(cy-(by+bh/2))
    tx=500-ox*s; ty=500-oy*s
    bgel=f'<rect width="1000" height="1000" rx="{rx or 0}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">{bgel}<g transform="translate({tx:.2f},{ty:.2f}) scale({s:.5f})">{inner(p,ink,headc)}</g></svg>'
def ras(s, px, bg=None):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(),output_width=px,output_height=px,background_color=bg))).convert('RGBA')
def rgb(s,px,bg='white'): return ras(s,px,bg).convert('RGB')
def sheet_sizes(out):
    S=Image.new('RGB',(1720,900),'white'); x=20
    for px in (256,64,32,16):
        S.paste(rgb(msvg(MASTER,headc=RED),px),(x,30)); label(S,f'master {px}',(x,10)); x+=px+40
    for px in (32,16):
        S.paste(rgb(msvg(SMALL,headc=RED),px),(x,30)); label(S,f'small {px}',(x,10)); x+=px+40
    S.paste(rgb(msvg(MASTER,headc=RED),1024).resize((256,256),Image.LANCZOS),(x,30)); label(S,'1024 (shown at 256)',(x,10))
    x=20
    for nm,pp in (('master',MASTER),('small',SMALL)):
        for px in (32,16):
            S.paste(rgb(msvg(pp,headc=RED),px).resize((px*8,px*8),Image.NEAREST),(x,330)); label(S,f'{nm} {px}px @8x',(x,312)); x+=px*8+24
    big=rgb(msvg(MASTER,headc=RED),1024); hx,hy,hr=head(MASTER); hx,hy=int(hx*1.024),int(hy*1.024)
    S.paste(big.crop((hx-100,hy-100,hx+100,hy+100)).resize((400,400),Image.NEAREST),(x,330)); label(S,'1024, 400% crop: head/tail joint',(x,312))
    S.save(out)
def sheet_context(out):
    S=Image.new('RGB',(1720,820),'white'); W=200; tiles=[]
    tiles.append(('full colour on paper', ras(msvg(MASTER,INK,RED,PAPER),W)))
    tiles.append(('reversed on ink', ras(msvg(MASTER,INK_D,RED_D,BG_D),W)))
    tiles.append(('one colour black', ras(msvg(MASTER,'#000',None,'#fff'),W)))
    tiles.append(('one colour red', ras(msvg(MASTER,RED,None,'#fff'),W)))
    tiles.append(('greyscale of colour icon', ImageOps.grayscale(rgb(icon_svg(MASTER),W)).convert('RGBA')))
    ph=photo(W,W).convert('RGBA'); ph.alpha_composite(ras(msvg(MASTER,'#ffffff'),W)); tiles.append(('white on photo*',ph))
    tiles.append(('light UI #F2F2F7', ras(icon_svg(MASTER,bg='#F2F2F7'),W)))
    tiles.append(('dark UI #1C1C1E', ras(icon_svg(MASTER,bg='#1C1C1E',ink=INK_D,headc=RED_D),W)))
    av=ras(icon_svg(MASTER,scale=0.6),W); m=Image.new('L',(W,W),0); ImageDraw.Draw(m).ellipse((0,0,W-1,W-1),fill=255)
    c=Image.new('RGBA',(W,W),(255,255,255,255)); c.paste(av,(0,0),m); ImageDraw.Draw(c).ellipse((0,0,W-1,W-1),outline=(200,200,200)); tiles.append(('circular avatar',c))
    tiles.append(('app icon mask', ras(icon_svg(MASTER,rx=223.7),W,'white')))
    tiles.append(('app icon dark', ras(icon_svg(MASTER,bg=BG_D,ink=INK_D,headc=RED_D,rx=223.7),W,'white')))
    tiles.append(('small @32 in mask, x8', ras(icon_svg(SMALL,rx=223.7,scale=0.7),32,'white').resize((W,W),Image.NEAREST)))
    for i,(t,im) in enumerate(tiles):
        xx=20+(i%6)*280; yy=40+(i//6)*380
        S.paste(im.convert('RGB'),(xx,yy)); label(S,t,(xx,yy-18))
    label(S,'* synthetic photo stand-in, not a real photograph',(20,790)); S.save(out)
def sheet_blur(out):
    S=Image.new('RGB',(1500,620),'white')
    base=rgb(msvg(MASTER,'#000'),256); mw=bbox(MASTER)[2]/1000*256
    for i,(t,sig) in enumerate((('256px',0),(f'blur 2% ({0.02*mw:.1f}px)',0.02*mw),(f'blur 4% ({0.04*mw:.1f}px)',0.04*mw))):
        im=base.filter(ImageFilter.GaussianBlur(sig)) if sig else base; S.paste(im,(20+i*290,40)); label(S,t,(20+i*290,20))
    for i,(t,f) in enumerate((('rot 90',lambda im: im.rotate(-90)),('rot 180',lambda im: im.rotate(180)),('mirror',ImageOps.mirror),('inverted',ImageOps.invert))):
        S.paste(f(rgb(msvg(MASTER,'#000'),200)),(20+i*240,360)); label(S,t,(20+i*240,340))
    S.save(out)
