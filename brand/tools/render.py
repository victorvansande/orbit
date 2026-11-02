import sys; sys.path.insert(0,'tools')
from mark import *
import cairosvg, io
from PIL import Image
def svg(p, ink='#000', bg=None, dotc=None, vb='0 0 1000 1000'):
    b=f'<rect x="-5000" y="-5000" width="20000" height="20000" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{b}<path fill="{ink}" fill-rule="evenodd" d="{ring_d(p)}"/><path fill="{dotc or ink}" d="{dot_d(p)}"/></svg>'
def png(s, px, bg='white'):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(),output_width=px,output_height=px,background_color=bg))).convert('RGB')
def sizes_sheet(p, small, out):
    sheet=Image.new('RGB',(1500,620),'white'); x=20
    for px in (256,64,32,16):
        sheet.paste(png(svg(p),px),(x,20)); x+=px+30
    x=20
    for pp in (p, small):
        for px in (32,16):
            sheet.paste(png(svg(pp),px).resize((px*8,px*8),Image.NEAREST),(x,330)); x+=px*8+24
    sheet.save(out)
