import sys, math, io; sys.path.insert(0,'tools')
from render import *
from lockup import mark_bbox
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageFont
import numpy as np, cairosvg
INK='#1B1B22'; PAPER='#F1F1EF'; RED='#E70049'
def icon_svg(p, bg=PAPER, ink=INK, dotc=RED, scale=0.64, shift=(40,-24), rx=None, size=1000):
    bx,by,bw,bh=mark_bbox(p); s=scale*1000/bw
    tx=500-(bx+bw/2)*s+shift[0]*s; ty=500-(by+bh/2)*s+shift[1]*s
    bgel=f'<rect width="1000" height="1000" rx="{rx or 0}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">{bgel}<g transform="translate({tx:.2f},{ty:.2f}) scale({s:.5f})"><path fill="{ink}" fill-rule="evenodd" d="{ring_d(p)}"/><path fill="{dotc}" d="{dot_d(p)}"/></g></svg>'
def raster(s, px, bg=None):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(),output_width=px,output_height=px,background_color=bg))).convert('RGBA')
def photo(w,h,seed=3):
    rng=np.random.default_rng(seed)
    y=np.linspace(0,1,h)[:,None]; x=np.linspace(0,1,w)[None,:]
    sky=np.stack([150+60*y+0*x, 175+40*y+0*x, 215-30*y+0*x],-1)
    hill=(y> 0.55+0.12*np.sin(x*7+1)+0.05*np.sin(x*23)).astype(float)
    img=sky*(1-hill[...,None])+np.stack([70+40*y+0*x,95+30*y+0*x,60+10*y+0*x],-1)*hill[...,None]
    noise=rng.normal(0,18,(h//8+1,w//8+1,3)); noise=np.kron(noise,np.ones((8,8,1)))[:h,:w]
    im=Image.fromarray(np.clip(img+noise,0,255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))
    return im
def label(im, text, xy):
    ImageDraw.Draw(im).text(xy,text,fill=(90,90,90))
def sheet_sizes(p, small, out):
    S=Image.new('RGB',(1700,900),'white'); x=20
    for px in (256,64,32,16):
        S.paste(png(svg(p,INK),px),(x,30)); label(S,f'master {px}px',(x,10)); x+=px+40
    for px in (32,16):
        S.paste(png(svg(small,INK),px),(x,30)); label(S,f'small {px}',(x,10)); x+=px+40
    x=20
    for nm,pp in (('master',p),('small',small)):
        for px in (32,16):
            S.paste(png(svg(pp,INK),px).resize((px*8,px*8),Image.NEAREST),(x,330)); label(S,f'{nm} {px}px @8x',(x,312)); x+=px*8+24
    big=png(svg(p,INK),1024); crop=big.crop((180,420,380,620)).resize((800//2*1,800//2*1),Image.NEAREST)
    S.paste(crop,(x,330)); label(S,'1024 render, 400% crop (core + thick side)',(x,312))
    S.save(out)
def sheet_context(p, small, out):
    S=Image.new('RGB',(1720,820),'white'); W=200; x=20; y=40
    tiles=[]
    tiles.append(('positive ink/paper', raster(svg(p,INK,PAPER),W)))
    tiles.append(('reversed paper/ink', raster(svg(p,PAPER,INK),W)))
    tiles.append(('single colour red', raster(svg(p,RED,'#ffffff'),W)))
    tiles.append(('greyscale (icon)', ImageOps.grayscale(raster(icon_svg(p),W).convert('RGB')).convert('RGBA')))
    ph=photo(W,W).convert('RGBA'); ph.alpha_composite(raster(svg(p,'#ffffff'),W)); tiles.append(('white on photo*',ph))
    ph=photo(W,W,5).convert('RGBA'); ph.alpha_composite(raster(svg(p,INK),W)); tiles.append(('ink on photo*',ph))
    tiles.append(('light UI #F2F2F7', raster(icon_svg(p,bg='#F2F2F7',dotc=RED),W)))
    tiles.append(('dark UI #1C1C1E', raster(icon_svg(p,bg='#1C1C1E',ink='#ECECF1',dotc='#F0306A'),W)))
    # circular avatar crop
    av=raster(icon_svg(p,scale=0.58),W); m=Image.new('L',(W,W),0); ImageDraw.Draw(m).ellipse((0,0,W-1,W-1),fill=255)
    c=Image.new('RGBA',(W,W),(255,255,255,255)); c.paste(av,(0,0),m); ImageDraw.Draw(c).ellipse((0,0,W-1,W-1),outline=(200,200,200)); tiles.append(('circular avatar',c))
    # rounded square app mask (iOS-like, 22.37%)
    tiles.append(('app icon mask', raster(icon_svg(p,rx=223.7),W,'white')))
    tiles.append(('app icon dark', raster(icon_svg(p,bg=INK,ink='#ECECF1',dotc='#F0306A',rx=223.7),W,'white')))
    tiles.append(('small @32, mask', raster(icon_svg(small,rx=223.7),32,'white').resize((W,W),Image.NEAREST)))
    for i,(t,im) in enumerate(tiles):
        xx=20+(i%6)*280; yy=40+(i//6)*380
        S.paste(im.convert('RGB'),(xx,yy)); label(S,t,(xx,yy-18))
    label(S,'* synthetic photo stand-in (procedural sky/hill + noise), not a real photograph',(20,790))
    S.save(out)
def sheet_blur(p, out):
    S=Image.new('RGB',(1500,620),'white')
    base=png(svg(p,'#000'),256); bx,by,bw,bh=mark_bbox(p); mw=bw/1000*256
    for i,(t,sig) in enumerate((('256px',0),(f'blur 2% ({0.02*mw:.1f}px)',0.02*mw),(f'blur 4% ({0.04*mw:.1f}px)',0.04*mw))):
        im=base.filter(ImageFilter.GaussianBlur(sig)) if sig else base
        S.paste(im,(20+i*290,40)); label(S,t,(20+i*290,20))
    for i,(t,f) in enumerate((('rot 90',lambda im: im.rotate(-90)),('rot 180',lambda im: im.rotate(180)),('mirror',ImageOps.mirror),('inverted',ImageOps.invert))):
        S.paste(f(png(svg(p,'#000'),200)),(20+i*240,360)); label(S,t,(20+i*240,340))
    S.save(out)
