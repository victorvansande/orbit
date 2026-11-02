"""Exporteert de merkvormen naar de app: src/core/mark.js (padgegevens) en een inline-SVG voor de kop."""
import sys, json; sys.path.insert(0,'tools')
from mark_v4 import MASTER, SMALL, tail_d, head, bbox
from word import wordmark
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
def xf(d, a, b, c, dd, e, f):
    pen=SVGPathPen(None); parse_path(d, TransformPen(pen,(a,b,c,dd,e,f))); out=pen.getCommands()
    # rond af op 1 decimaal
    import re
    return re.sub(r'-?\d+\.\d+', lambda m: ('%.1f' % float(m.group())).rstrip('0').rstrip('.'), out)
def optical(p):
    """optisch midden: het midden van het vak, 45 % opgeschoven naar het zwaartepunt van de inkt"""
    import io, cairosvg, numpy as np
    from PIL import Image
    from mark_v4 import inner
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">{inner(p,"#000","#000")}</svg>'
    a=np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=1000,output_height=1000))))[...,3]>128
    ys,xs=np.nonzero(a); bx,by,bw,bh=bbox(p); cx,cy=bx+bw/2,by+bh/2
    return cx+0.45*(xs.mean()-cx), cy+0.45*(ys.mean()-cy)
def symbol(p, H=100):
    bx,by,bw,bh=bbox(p); s=H/bh
    hx,hy,hr=head(p); ox,oy=optical(p)
    return dict(w=round(bw*s,2), h=H, tail=xf(tail_d(p),s,0,0,s,-bx*s,-by*s), head=[round((hx-bx)*s,2),round((hy-by)*s,2),round(hr*s,2)],
                oc=[round((ox-bx)*s,2),round((oy-by)*s,2)])
def lockup(p, size=100):
    asc=0.732*size; h=1.04*asc
    bx,by,bw,bh=bbox(p); s=h/bh; mw=bw*s; D=2*p['hr']*s
    base=h-0.015*size
    hx,hy,hr=head(p)
    gx=mw+1.6*D
    d,w,_=wordmark(size,gx-33*size/1000,base)
    word=xf(d,1,0,0,1,0,0)
    W=gx+w-(33+26)*size/1000
    return dict(w=round(W,2), h=round(max(h,base+0.012*size),2), tail=xf(tail_d(p),s,0,0,s,-bx*s,-by*s),
                head=[round((hx-bx)*s,2),round((hy-by)*s,2),round(hr*s,2)], word=word, base=round(base,2))
data=dict(SYMBOL=symbol(MASTER), SYMBOL_SMALL=symbol(SMALL), LOCKUP_SMALL=lockup(SMALL))
js='''// Beeldmerk en woordmerk van Orbit (merk v1, 02/11/2026), uit brand/tools/export_app.py. Niet met de hand aanpassen.
// SYMBOL: master (vanaf 48 px), SYMBOL_SMALL: kleine tekening (16 tot 47 px), LOCKUP_SMALL: kleine tekening met woordmerk.
// oc: optisch midden (om het merk in een icoon te centreren). Elk: w, h (vak), tail (pad van de baan met staart), head [cx, cy, r] (de kop, in --core); LOCKUP_SMALL ook word (pad) en base (basislijn).
'''
for k,v in data.items(): js+=f'export const {k} = {json.dumps(v, separators=(",",":"))};\n'
open(sys.argv[1] if len(sys.argv)>1 else 'mark.js','w').write(js)
L=data['LOCKUP_SMALL']
svg=(f'<svg class="brand-mark" viewBox="0 0 {L["w"]} {L["h"]}" role="img" aria-label="Orbit">'
     f'<path class="bm-ink" d="{L["tail"]}"/><circle class="bm-head" cx="{L["head"][0]}" cy="{L["head"][1]}" r="{L["head"][2]}"/>'
     f'<path class="bm-ink" d="{L["word"]}"/></svg>')
open('header_lockup.svg','w').write(svg)
S=data['SYMBOL']
sym=(f'<svg class="intro-mark" viewBox="0 0 {S["w"]} {S["h"]}" aria-hidden="true">'
     f'<path class="bm-ink" d="{S["tail"]}"/><circle class="bm-head" cx="{S["head"][0]}" cy="{S["head"][1]}" r="{S["head"][2]}"/></svg>')
open('intro_symbol.svg','w').write(sym)
print({k:(v['w'],v['h']) for k,v in data.items()}, len(svg), len(sym))
