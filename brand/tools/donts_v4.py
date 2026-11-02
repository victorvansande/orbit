import sys, io; sys.path.insert(0,'tools')
from mark_v4 import *
from tv4 import icon_svg, INK, PAPER, RED
import cairosvg
from PIL import Image, ImageDraw, ImageFont
def m(extra_g='', body=None, bg=PAPER):
    b=body or inner(MASTER,INK,RED)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="{bg}"/><g {extra_g}>{b}</g></svg>'
CASES=[('Goed: zoals getekend',m()),
 ('Niet uitrekken',m('transform="translate(500 500) scale(1.35 0.8) translate(-500 -500)"')),
 ('Niet draaien',m('transform="rotate(50 500 500)"')),
 ('Geen andere kleuren',m(body=inner(MASTER,'#1F78B4','#E08600'))),
 ('Geen schaduw of gloed',m('filter="url(#s)"').replace('<rect','<defs><filter id="s"><feDropShadow dx="0" dy="18" stdDeviation="14" flood-opacity=".45"/></filter></defs><rect')),
 ('Geen omtrek',m('fill="none"',body=f'<path fill="none" stroke="{INK}" stroke-width="10" d="{mono_d(MASTER)}"/>')),
 ('Kop niet los of verplaatst',m(body=f'<path fill="{INK}" d="{tail_d(MASTER)}"/><path fill="{RED}" transform="translate(-220 -330)" d="{head_d(MASTER)}"/>')),
 ('Niet op een drukke achtergrond zonder vlak',m(bg='#7d6b74'))]
def sheet(out):
    try: F=ImageFont.truetype('fonts/InstrumentSans[wdth,wght].ttf',16)
    except: F=None
    S=Image.new('RGB',(4*250+20,2*290+20),'#E6E4DF'); D=ImageDraw.Draw(S)
    for i,(t,s) in enumerate(CASES):
        im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(),output_width=220,output_height=220))).convert('RGB')
        x=20+(i%4)*250; y=20+(i//4)*290; S.paste(im,(x,y))
        if i>0: D.line((x+12,y+12,x+208,y+208),fill=(231,0,73),width=3)
        D.text((x,y+228),t,fill=(27,27,34),font=F)
    S.save(out)
