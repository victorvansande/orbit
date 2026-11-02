import sys, io; sys.path.insert(0,'tools')
import r7
import cairosvg, numpy as np
from PIL import Image, ImageDraw, ImageFont
PAPER='#F1F1EF'
def ras(b,px,bg=PAPER):
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">{b}</svg>'
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(),output_width=px,output_height=px,background_color=bg))).convert('RGB')
def fit(b):
    im=np.array(ras(b,500,'white').convert('L'))<200; ys,xs=np.nonzero(im)
    if len(xs)==0: return b
    x0,x1,y0,y1=xs.min()*2,xs.max()*2,ys.min()*2,ys.max()*2; w,h=x1-x0,y1-y0; s=0.84*1000/max(w,h)
    return f'<g transform="translate({500-(x0+w/2)*s:.1f},{500-(y0+h/2)*s:.1f}) scale({s:.4f})">{b}</g>'
try: F=ImageFont.truetype('fonts/InstrumentSans[wdth,wght].ttf',15); FB=ImageFont.truetype('fonts/InstrumentSans[wdth,wght].ttf',19)
except: F=FB=None
def tile(code,name,idea,b,word):
    T=Image.new('RGB',(330,330),PAPER); D=ImageDraw.Draw(T)
    fb=fit(b); big=ras(fb,240); T.paste(big,(8,30))
    D.text((10,6),f'{code}  {name}',fill=(27,27,34),font=FB)
    if not word:
        T.paste(ras(fb,32),(262,40)); T.paste(ras(fb,16).resize((64,64),Image.NEAREST),(256,90)); T.paste(ras(fb,16),(286,170))
        D.text((258,192),'32 · 16',fill=(138,138,148),font=F)
    else:
        T.paste(ras(fb,64),(258,40)); D.text((258,110),'woordmerk',fill=(138,138,148),font=F)
    # wrap idea
    words=idea.split(); lines=[];cur=''
    for w in words:
        if len(cur+' '+w)>42: lines.append(cur); cur=w
        else: cur=(cur+' '+w).strip()
    lines.append(cur)
    for i,l in enumerate(lines[:2]): D.text((10,276+i*19),l,fill=(94,94,104),font=F)
    return T
def sheet(out, cols=5):
    n=len(r7.S); rows=(n+cols-1)//cols
    W=Image.new('RGB',(cols*340+10,rows*340+10),'#DCDCD8')
    for k,s in enumerate(r7.S):
        W.paste(tile(*s),(10+(k%cols)*340,10+(k//cols)*340))
    W.save(out); return W
