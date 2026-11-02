import sys, os, io, math, json, subprocess; sys.path.insert(0,'tools')
from final import *
from lockup3 import horizontal, stacked
from word import wordmark
import cairosvg
from PIL import Image, ImageDraw
OUT='deliverables'
C=dict(ink='#1B1B22', paper='#F1F1EF', red='#E70049', ink_d='#ECECF1', red_d='#F0306A', bg_d='#0F0F12', white='#FFFFFF')
VARIANTS={  # name: (ink, head)
 'fullcolour':(C['ink'],C['red']), 'fullcolour-reversed':(C['ink_d'],C['red_d']),
 'black':(C['ink'],C['ink']), 'white':(C['white'],C['white']), 'red':(C['red'],C['red'])}
for d in ('svg','png','pdf','favicon','construction'): os.makedirs(f'{OUT}/{d}',exist_ok=True)
def wsvg(path, body, vb, w=None, h=None):
    x,y,W,H=vb
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.2f} {y:.2f} {W:.2f} {H:.2f}"><title>Orbit</title>{body}</svg>'
    open(path,'w').write(s); return s
def symbol_body(p, ink, head): return mark_svg_inner(p, ink, head)
files=[]
# symbols
for nm,p in (('symbol',MASTER),('symbol-small',SMALL)):
    bx,by,bw,bh=bbox(p)
    for v,(ink,head) in VARIANTS.items():
        f=f'{OUT}/svg/orbit-{nm}-{v}.svg'; wsvg(f, symbol_body(p,ink,head),(bx,by,bw,bh)); files.append((f,bw/bh))
# wordmark
for v,(ink,head) in VARIANTS.items():
    d,w,m=wordmark(1000,0,0); wd=w-59
    f=f'{OUT}/svg/orbit-wordmark-{v}.svg'; wsvg(f,f'<path fill="{ink}" d="{d}"/>',(33,-742,wd,742+10)); files.append((f,wd/752))
# lockups (size 1000 units font)
for v,(ink,head) in VARIANTS.items():
    frag,W,H,base=horizontal(1000,0,0,ink=ink,headc=head)
    bottom=max(H, base+10)
    f=f'{OUT}/svg/orbit-horizontal-{v}.svg'; wsvg(f,frag,(0,0,W,bottom)); files.append((f,W/bottom))
    frag,W2,H2=stacked(1000,0,0,1.6,0.30,ink=ink,headc=head)
    f=f'{OUT}/svg/orbit-stacked-{v}.svg'; wsvg(f,frag,(-W2/2,0,W2,H2+10)); files.append((f,W2/(H2+10)))
json.dump({'files':[f for f,_ in files]},open(f'{OUT}/manifest.json','w'),indent=1)
print(len(files),'svg written')

# ---- optimise SVGs with svgo
subprocess.run(['npx','--prefix','tools','svgo','-q','-r','-f',f'{OUT}/svg','--multipass','-p','2'],check=True,cwd='.')
# ---- PNG 512/1024/2048 (width), transparent; PDF per lockup
def svg_png(src, dst, width):
    cairosvg.svg2png(url=src, write_to=dst, output_width=width)
for f,ratio in files:
    base=os.path.basename(f)[:-4]
    for w in (512,1024,2048):
        os.makedirs(f'{OUT}/png/{w}',exist_ok=True); svg_png(f, f'{OUT}/png/{w}/{base}.png', w)
    if any(k in base for k in ('horizontal','stacked','symbol','wordmark')) and any(base.endswith(v) for v in ('fullcolour','black','white','red','fullcolour-reversed')):
        cairosvg.svg2pdf(url=f, write_to=f'{OUT}/pdf/{base}.pdf')
# ---- favicons and app icons
from tests3 import icon_svg
def save(s, path): open(path,'w').write(s)
fav=f'{OUT}/favicon'
light=icon_svg(MASTER, bg=C['paper'], ink=C['ink'], headc=C['red'], scale=0.66)
dark=icon_svg(MASTER, bg=C['bg_d'], ink=C['ink_d'], headc=C['red_d'], scale=0.66)
save(light, f'{OUT}/svg/orbit-appicon-light.svg'); save(dark, f'{OUT}/svg/orbit-appicon-dark.svg')
cairosvg.svg2png(bytestring=light.encode(), write_to=f'{fav}/apple-touch-icon.png', output_width=180, output_height=180)
cairosvg.svg2png(bytestring=light.encode(), write_to=f'{fav}/icon-192.png', output_width=192, output_height=192)
cairosvg.svg2png(bytestring=light.encode(), write_to=f'{fav}/icon-512.png', output_width=512, output_height=512)
cairosvg.svg2png(bytestring=dark.encode(), write_to=f'{fav}/icon-512-dark.png', output_width=512, output_height=512)
# maskable: whole mark inside the safe circle (diameter 80%): scale so the mark bbox diagonal <= 0.72 * width
bx,by,bw,bh=bbox(MASTER); diag=math.hypot(bw,bh)
mask=icon_svg(MASTER, bg=C['paper'], ink=C['ink'], headc=C['red'], scale=0.72*bw/diag, comp=0.0)
save(mask, f'{fav}/maskable.svg'); cairosvg.svg2png(bytestring=mask.encode(), write_to=f'{fav}/maskable-512.png', output_width=512, output_height=512)
# favicon.svg: small drawing on a paper tile with rounded corners (readable on light and dark tabs)
fsvg=icon_svg(SMALL, bg=C['paper'], ink=C['ink'], headc=C['red'], scale=0.80, rx=180)
fsvg=fsvg.replace('<svg ','<svg ',1)
save(fsvg, f'{fav}/favicon.svg')
ims=[]
for s in (16,32,48):
    p = SMALL
    png=cairosvg.svg2png(bytestring=icon_svg(p, bg=C['paper'], ink=C['ink'], headc=C['red'], scale=0.80, rx=180).encode(), output_width=s, output_height=s)
    ims.append(Image.open(io.BytesIO(png)).convert('RGBA'))
ims[2].save(f'{fav}/favicon.ico', sizes=[(16,16),(32,32),(48,48)], append_images=ims[:2])
for s,im in zip((16,32,48),ims): im.save(f'{fav}/favicon-{s}.png')
print('done')
