import sys, math; sys.path.insert(0,'tools')
from mark_v4 import *
from comet2 import pt
from geom import ellipse_d
def sheet(p=MASTER, out='merk/constructie/orbit-constructie.svg'):
    INK='#1B1B22'; RED='#E70049'; G='#9A9AA3'; B='#1F78B4'
    x,y,r=head(p); els=[]
    for i in range(1,10): els.append(f'<path d="M{i*100} 0V1000M0 {i*100}H1000" stroke="{G}" stroke-opacity=".25" stroke-width="1"/>')
    els.append(f'<rect x="0" y="0" width="1000" height="1000" fill="none" stroke="{G}" stroke-width="1"/>')
    els.append(f'<g opacity=".2">{inner(p,INK,RED)}</g>')
    els.append(f'<path d="{ellipse_d(p["cx"],p["cy"],p["a"],p["b"],p["rot"])}" fill="none" stroke="{B}" stroke-width="2" stroke-dasharray="8 6"/>')
    a=math.radians(p['rot']); L=p['a']+50
    els.append(f'<path d="M{500-L*math.cos(a):.1f} {500-L*math.sin(a):.1f} L{500+L*math.cos(a):.1f} {500+L*math.sin(a):.1f}" stroke="{B}" stroke-width="1.5"/>')
    els.append(f'<path d="M30 500 H970" stroke="{G}" stroke-dasharray="3 5"/><circle cx="500" cy="500" r="5" fill="{B}"/>')
    els.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="none" stroke="{RED}" stroke-width="2"/>')
    tip=pt(p,p['head_at']+p['sweep'])
    els.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r+p["gap"]:.1f}" fill="none" stroke="{RED}" stroke-width="1" stroke-dasharray="4 4"/>')
    els.append(f'<circle cx="{tip[0]:.1f}" cy="{tip[1]:.1f}" r="7" fill="none" stroke="{B}" stroke-width="2"/>')
    T=lambda X,Y,s,anc="start": els.append(f'<text x="{X:.0f}" y="{Y:.0f}" font-family="Geist Mono, ui-monospace, monospace" font-size="17" fill="{INK}" text-anchor="{anc}">{s}</text>')
    T(30,40,'ORBIT · BEELDMERK · CONSTRUCTIE (vak 1000 × 1000 eenheden, raster 100)')
    T(30,68,f'baan: ellips {p["a"]} × {p["b"]} ({p["a"]/p["b"]:.2f} : 1), gekanteld {p["rot"]}°, middelpunt (500, 500)')
    T(30,94,f'kop: Ø {2*p["hr"]} op {p["head_at"]}° van de baan, witte rand {p["gap"]} · staart: {p["sweep"]}° achter de kop')
    T(30,120,f'breedte staart = {p["wmin"]} + ({p["wmax"]} − {p["wmin"]}) · u^{p["k"]}, u = 0 aan de punt, 1 aan de kop')
    T(x+r+18,y+44,f'kop Ø {2*p["hr"]}')
    T(tip[0]+14,tip[1]-14,'punt')
    T(970,975,f'kanteling {p["rot"]}°',"end")
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><rect width="1000" height="1000" fill="#F1F1EF"/>{"".join(els)}</svg>'
    import os; os.makedirs(os.path.dirname(out),exist_ok=True); open(out,'w').write(svg); return svg
if __name__=='__main__':
    import cairosvg; s=sheet(); cairosvg.svg2png(bytestring=s.encode(),write_to='merk/constructie/orbit-constructie.png'); cairosvg.svg2pdf(bytestring=s.encode(),write_to='merk/constructie/orbit-constructie.pdf')
