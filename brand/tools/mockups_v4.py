import sys, os, base64; sys.path.insert(0,'tools')
from mark_v4 import *
from tv4 import icon_svg, INK, PAPER, RED, INK_D, RED_D, BG_D
from lockup_v4 import horizontal, stacked
OUT='merk/mockups'; os.makedirs(OUT,exist_ok=True)
def uri(svg): return 'data:image/svg+xml;base64,'+base64.b64encode(svg.encode()).decode()
ICON=icon_svg(MASTER,bg=PAPER,ink=INK,headc=RED,scale=0.66)
ICON_D=icon_svg(MASTER,bg=BG_D,ink=INK_D,headc=RED_D,scale=0.66)
FAV=icon_svg(SMALL,bg=PAPER,ink=INK,headc=RED,scale=0.80,rx=180)
def lock(size, ink=INK, headc=RED, p=MASTER):
    frag,W,H,base=horizontal(size,0,0,ink=ink,headc=headc,p=p)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {max(H,base+0.02*size):.1f}">{frag}</svg>', W, max(H,base+0.02*size)
FONT="font-family:'Instrument Sans',system-ui,sans-serif"
placeholder=['#C9CCD6','#D8CFC4','#BFD3CC','#D6C7D2','#CFD6C2','#C7CFDA','#DCD2BE','#C4CCD2','#D3C4C4','#C8D6D6','#D9D3CB','#CBC7DA']
def homescreen():
    tiles=''
    for i in range(20):
        if i==6:
            tiles+=f'<div class="app"><img src="{uri(ICON)}"><span>Orbit</span></div>'
        else:
            c=placeholder[i%len(placeholder)]
            tiles+=f'<div class="app"><div class="ph" style="background:{c}"></div><span>&nbsp;</span></div>'
    return f'''<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@500&display=swap"><style>
body{{margin:0;background:#E6E4DF;display:grid;place-items:center;height:100vh;{FONT}}}
.phone{{width:390px;height:780px;border-radius:54px;background:linear-gradient(160deg,#3a3f52,#7d6b74 60%,#c9a38f);padding:70px 24px;box-sizing:border-box;box-shadow:0 0 0 10px #111,0 30px 60px rgba(0,0,0,.25)}}
.grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:26px 18px}}
.app{{display:grid;justify-items:center;gap:6px}}
.app img,.ph{{width:62px;height:62px;border-radius:14px}}
.ph{{opacity:.85}}
.app span{{font-size:11.5px;color:#fff}}
</style></head><body><div class="phone"><div class="grid">{tiles}</div></div></body></html>'''
def browser():
    return f'''<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&display=swap"><style>
body{{margin:0;background:#E6E4DF;display:grid;place-items:center;height:100vh;{FONT}}}
.win{{width:900px;border-radius:12px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.18);background:#fff}}
.tabs{{background:#DEDDD8;padding:10px 12px 0;display:flex;gap:6px}}
.tab{{background:#ECEBE7;border-radius:9px 9px 0 0;padding:9px 14px;display:flex;gap:9px;align-items:center;font-size:13px;color:#555;width:200px}}
.tab.on{{background:#fff;color:#1B1B22}}
.tab img{{width:16px;height:16px}}
.dot{{width:16px;height:16px;border-radius:4px;background:#C9CCD6}}
.bar{{padding:10px 14px;border-bottom:1px solid #eee;font-size:13px;color:#666}}
.bar span{{background:#F2F2F0;border-radius:999px;padding:6px 14px;display:inline-block;width:60%}}
.page{{height:300px;background:#F1F1EF;display:grid;place-items:center}}
.page img{{height:56px}}
</style></head><body><div class="win"><div class="tabs"><div class="tab"><div class="dot"></div>Nieuw tabblad</div><div class="tab on"><img src="{uri(FAV)}">Orbit</div><div class="tab"><div class="dot"></div>Agenda</div></div>
<div class="bar"><span>victorvansande.github.io/orbit</span></div><div class="page"><img src="{uri(lock(120)[0])}"></div></div></body></html>'''
def inapp():
    l,W,H=lock(26); ld,_,_=lock(26,ink=INK_D,headc=RED_D)
    return f'''<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&family=Geist+Mono:wght@400&display=swap"><style>
body{{margin:0;background:#E6E4DF;display:flex;gap:40px;justify-content:center;align-items:center;height:100vh;{FONT}}}
.phone{{width:330px;height:660px;border-radius:44px;box-shadow:0 0 0 9px #111,0 24px 50px rgba(0,0,0,.22);overflow:hidden;position:relative}}
.light{{background:#F1F1EF;color:#1B1B22}} .dark{{background:#0F0F12;color:#ECECF1}}
.top{{display:flex;justify-content:space-between;align-items:center;padding:58px 22px 0}}
.top img{{height:24px}}
.meta{{font:400 10.5px 'Geist Mono',monospace;letter-spacing:.14em;text-transform:uppercase;opacity:.6;padding:8px 22px}}
.scene{{margin:40px auto 0;width:250px;height:250px;border-radius:50%;border:1px dashed currentColor;opacity:.25}}
.foot{{position:absolute;bottom:34px;left:0;right:0;text-align:center;font:400 10px 'Geist Mono',monospace;letter-spacing:.16em;opacity:.55}}
</style></head><body>
<div class="phone light"><div class="top"><img src="{uri(l)}"></div><div class="meta">Niets dringend · 12 taken</div><div class="scene"></div><div class="foot">ORBIT · NOVEMBER 2026</div></div>
<div class="phone dark"><div class="top"><img src="{uri(ld)}"></div><div class="meta">2 dringend · 9 taken</div><div class="scene"></div><div class="foot">ORBIT · NOVEMBER 2026</div></div>
</body></html>'''
pages={'homescreen':homescreen(),'browser':browser(),'inapp':inapp()}
for k,v in pages.items(): open(f'{OUT}/{k}.html','w').write(v)
print('ok')
