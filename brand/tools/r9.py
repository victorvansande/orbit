import sys, math; sys.path.insert(0,'tools')
from comet import _pt, outline_d
from geom import circle_d
INK='#1B1B22'; RED='#E70049'; PAP='#F1F1EF'
BASE=dict(a=380, b=290, rot=-32, cx=500, cy=500, th0=528, sweep=-356, w0=14, w1=84, k=1.5, head=1.75, knots=10)
def head_xy(p):
    X,Y,DX,DY=_pt(p,p['th0']+p['sweep']); return X,Y
def body(p, headc=RED, halo=0, inset=0, ink=INK):
    tail=outline_d(p); hx,hy=head_xy(p); hr=p['w1']*p['head']/2
    if inset:
        dx,dy=p['cx']-hx,p['cy']-hy; L=math.hypot(dx,dy); hx+=dx/L*inset; hy+=dy/L*inset
    s=f'<path fill="{ink}" d="{tail}"/>'
    if halo: s+=f'<path fill="{PAP}" d="{circle_d(hx,hy,hr+halo)}"/>'
    s+=f'<path fill="{headc}" d="{circle_d(hx,hy,hr)}"/>'
    return s
def V(**kw):
    p=dict(BASE); opts={}
    for k,v in kw.items():
        if k in ('headc','halo','inset'): opts[k]=v
        else: p[k]=v
    if 'head_at' in p:
        h=p.pop('head_at'); p['th0']=h-p['sweep']
    return body(p,**opts)
VARS=[
 ('V01','Ronde 3','het vertrekpunt dat je koos',V()),
 ('V02','Minder kantel','15 graden in plaats van 32',V(rot=-15)),
 ('V03','Meer kantel','45 graden, steiler',V(rot=-45)),
 ('V04','Plat liggend','geen kanteling, horizontale baan',V(rot=0)),
 ('V05','Ronder','baan bijna een cirkel',V(b=345)),
 ('V06','Platter','baan sterker in perspectief',V(b=235)),
 ('V07','Grote kop','kop 2,1 keer de staart',V(head=2.1)),
 ('V08','Kleine kop','kop 1,4 keer de staart',V(head=1.4)),
 ('V09','Zware staart','staart dikker, krachtiger',V(w1=110)),
 ('V10','Lichte staart','staart slanker, fijner',V(w1=60,head=2.0)),
 ('V11','Lang taps','staart blijft lang dun en zwelt laat aan',V(k=2.6)),
 ('V12','Kort taps','staart wordt snel dik',V(k=0.8)),
 ('V13','Stevig begin','dunste punt dikker, beter op klein formaat',V(w0=36)),
 ('V14','Kop onderaan','kop onderaan de baan',V(head_at=120)),
 ('V15','Kop links','kop aan de linkerkant',V(head_at=200)),
 ('V16','Kop linksboven','kop bovenaan links, valt naar beneden',V(head_at=240)),
 ('V17','Andere richting','draait met de klok mee',V(sweep=356,head_at=172)),
 ('V18','Witte rand','een smalle witte rand rond de kop, los van de staart',V(halo=16)),
 ('V19','Kop binnen','kop schuift naar binnen, raakt de baan aan de binnenkant',V(inset=48)),
 ('V20','Kop in inkt','alles in één kleur',V(headc=INK)),
 ('V21','Open baan','de staart sluit niet, er blijft een opening',V(sweep=-325,head_at=172)),
 ('V22','Cirkel','geen perspectief, een ronde baan',V(b=380,rot=0)),
 ('V23','Vet','zware staart en grote kop, sterk op klein formaat',V(w0=34,w1=118,head=1.8)),
 ('V24','Haarfijn','fijne lijn, grote kop, verfijnd',V(w0=8,w1=48,head=2.5)),
]
