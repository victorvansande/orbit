import sys, math; sys.path.insert(0,'tools')
from geom import circle_d, ellipse_d
from r6 import stroke_d, _P, _D
from typo import path_d, load
from word import wordmark
import pathops
K='#1B1B22'
def P(d, fill=K, rule='nonzero'): return f'<path fill="{fill}" fill-rule="{rule}" d="{d}"/>'
def rect_d(x,y,w,h,r=0):
    r=min(r,w/2,h/2)
    return (f'M{x+r} {y} H{x+w-r} A{r} {r} 0 0 1 {x+w} {y+r} V{y+h-r} A{r} {r} 0 0 1 {x+w-r} {y+h} '
            f'H{x+r} A{r} {r} 0 0 1 {x} {y+h-r} V{y+r} A{r} {r} 0 0 1 {x+r} {y} Z')
def rot(d, ang, cx=500, cy=500): return f'<g transform="rotate({ang} {cx} {cy})">{d}</g>'
def squircle_d(cx,cy,r,n=5,N=140,sx=1,sy=1):
    pts=[]
    for i in range(N):
        t=2*math.pi*i/N; c,s=math.cos(t),math.sin(t)
        pts.append((cx+sx*r*math.copysign(abs(c)**(2/n),c), cy+sy*r*math.copysign(abs(s)**(2/n),s)))
    return 'M'+' L'.join('%.1f %.1f'%p for p in pts)+' Z'
def op(a,b,kind):
    return _D(pathops.op(_P(a),_P(b),{'u':pathops.PathOp.UNION,'d':pathops.PathOp.DIFFERENCE,'i':pathops.PathOp.INTERSECTION,'x':pathops.PathOp.XOR}[kind]))
INS='fonts/InstrumentSans[wdth,wght].ttf'; SER='fonts/InstrumentSerif-Italic.ttf'; FRA='fonts/Fraunces-Italic.ttf'; BRI='fonts/BricolageGrotesque[opsz,wdth,wght].ttf'
def text(t, font=INS, axes=(('wdth',100),('wght',500)), size=300, x=None, y=600, track=0):
    extra={i:track for i in range(len(t))} if track else None
    d,w,_=path_d(font,t,axes,size=size,x0=0,y0=0,extra=extra)
    x0=(1000-w)/2 if x is None else x
    return f'<g transform="translate({x0:.1f},{y})"><path fill="{K}" d="{d}"/></g>'
def textx(t, font=INS, axes=(('wdth',100),('wght',500)), size=300, y=600, extra=None, x=None, features=None):
    d,w,_=path_d(font,t,axes,size=size,x0=0,y0=0,extra=extra,features=features)
    x0=(1000-w)/2 if x is None else x
    return f'<g transform="translate({x0:.1f},{y})"><path fill="{K}" d="{d}"/></g>'
S=[]
def add(code,name,idea,body,word=False): S.append((code,name,idea,body,word))
E=ellipse_d; C=circle_d
# A lettermark o
add('A1','Zware o','vette o, gekantelde ovale binnenvorm',P(E(500,500,420,420)+' '+E(450,550,240,140,-32,ccw=True)))
add('A2','Hoekige binnenvorm','ronde o, afgeronde vierkante binnenvorm in een hoek',P(op(E(500,500,420,420),rect_d(300,420,280,280,80),'d')))
add('A3','Verschoven helften','o uit twee halve ringen die verspringen',P(op(stroke_d(E(500,450,300,300),130),rect_d(500,0,500,1000),'d'))+P(op(stroke_d(E(500,550,300,300),130),rect_d(0,0,500,1000),'d')))
add('A4','Kerf','dikke ring met één schuine kerf',P(op(stroke_d(E(500,500,320,320),160),rot(rect_d(470,100,70,300),0)[0:0] or _rot_rect(),'d')) if False else '')
add('A5','Squircle-o','o als zachte rechthoekige ring',P(op(squircle_d(500,500,420),squircle_d(500,500,240,n=4),'d')))
add('A6','Stencil-o','o in twee stukken, twee schuine naden',P(op(stroke_d(E(500,500,320,340),150),rect_d(470,0,60,1000),'d')).replace('<path','<path transform="rotate(-35 500 500)"'))
# B monogram / ligature
add('B1','ob-ligatuur','o en b delen hun buik',textx('ob',size=640,y=780,extra={0:-150}))
add('B2','or raakt','o en r schuiven tegen elkaar',textx('or',size=640,y=760,extra={0:-110}))
add('B3','O met kernstip','hoofdletter O, een stip in de opening',textx('O',size=760,y=780)+P(C(505,505,70)))
add('B4','Blok or/bit','het woord in twee regels, strak blok',textx('or',size=380,y=470,extra={0:-20})+textx('bit',size=380,y=830,extra={0:-20,1:-20}))
# C wordmarks
add('C1','Wegdrijvend woord','letters drijven verder uit elkaar naar het einde',textx('orbit',size=260,y=580,extra={0:-30,1:15,2:70,3:140}),True)
add('C2','Kleiner wordend','elke letter kleiner, alsof hij verder weg staat',''.join([]),True)
add('C3','Cursief serif','Instrument Serif Italic, stijlvol en zacht',textx('orbit',font=SER,axes=(),size=380,y=620),True)
add('C4','Zachte serif','Fraunces cursief, warm en eigenzinnig',textx('orbit',font=FRA,axes=(('wght',500),('opsz',72),('SOFT',100),('WONK',1)),size=330,y=610),True)
add('C5','Grof grotesk','Bricolage, karaktervol en compact',textx('orbit',font=BRI,axes=(('wght',700),('opsz',96),('wdth',80)),size=360,y=620,extra={i:-15 for i in range(4)}),True)
add('C6','Kapitalen gespatieerd','ORBIT in ruime kapitalen, rustig',textx('ORBIT',size=170,y=560,extra={i:90 for i in range(4)}),True)
# D abstract, non-circular
add('D1','Hoekkwart','een kwart schijf genesteld in de hoek van een vierkant: naar de hoek getrokken',P(rect_d(100,100,800,800,120))+P(op(rect_d(100,100,800,800,120),C(100,900,520),'i'),fill='#F1F1EF')+P(op(rect_d(100,100,800,800,120),C(100,900,360),'i')))
add('D2','Twee tegels','twee afgeronde vlakken, het voorste schuift over het achterste',P(rect_d(330,140,520,520,110))+P(rect_d(150,340,520,520,110),fill='#F1F1EF')+P(rect_d(190,380,440,440,80)))
add('D3','Horizon','halve schijf op een lijn: wat opkomt is vandaag',P(op(C(500,640,330),rect_d(0,0,1000,640),'i'))+P(rect_d(120,700,760,70,35)))
add('D4','Druppel','een vorm die naar één hoek wordt getrokken',P('M 640 160 C 860 160 860 420 820 560 C 760 760 520 880 220 880 C 260 640 300 520 380 400 C 460 280 520 160 640 160 Z'))
add('D5','Drie banen','drie strepen die versmallen naar één punt, perspectief',''.join(P(f'M {120} {300+i*170} L {880} {440+i*40} L {880} {470+i*40} L {120} {380+i*170} Z') for i in range(3)))
add('D6','Lens','een smalle gekantelde lens: een baan van opzij gezien',rot(P(op(C(500,200,430),C(500,800,430),'i')),-30))
add('D7','Gat in de hoek','vierkant met een rond gat dicht bij één hoek',P(op(rect_d(130,130,740,740,150),C(330,670,140),'d')))
add('D8','Zeil','een vlak met één gebogen zijde, beweging zonder cirkel',P('M 200 820 L 820 820 C 820 520 640 260 340 160 C 420 420 380 640 200 820 Z'))
# E fluid
add('E1','Lus','één doorlopende lijn die een lus slaat',P(stroke_d('M 120 700 C 300 700 420 600 470 470 C 520 330 460 220 380 240 C 290 260 300 420 420 520 C 560 640 760 640 880 520',90)))
add('E2','Golf','een zachte golf met een verdikking op de top',P(stroke_d('M 100 600 C 260 600 330 380 500 380 C 670 380 740 600 900 600',110)))
add('E3','Inktvlek-o','o met een ongelijke, gegoten rand',P(op('M 500 90 C 760 90 910 260 900 500 C 890 760 720 910 480 905 C 230 900 95 740 100 490 C 105 250 270 90 500 90 Z', E(470,520,230,250,-15),'d')))
add('E4','Lint','een band die over zichzelf heen plooit',P(stroke_d('M 200 760 C 200 420 420 220 640 260 C 860 300 840 560 640 600 C 440 640 360 420 520 300',120,pathops.LineCap.BUTT_CAP)))
# F print / pattern
add('F1','Halftoonvierkant','raster van punten, groot in één hoek, klein in de andere',''.join(P(C(160+i*136,160+j*136,max(6,60-7*math.hypot(i,6-j)))) for i in range(6) for j in range(6)))
add('F2','Overdruk','twee o\'s licht verschoven over elkaar, zoals verschoven risodruk',P(stroke_d(E(460,520,300,300),110))+P(op(stroke_d(E(540,480,300,300),110),stroke_d(E(460,520,300,300),110),'d'),fill='#8A8A94'))
def rrect_poly(cx,cy,w,h,ang):
    a=math.radians(ang); pts=[]
    for dx,dy in ((-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)):
        pts.append((cx+dx*math.cos(a)-dy*math.sin(a), cy+dx*math.sin(a)+dy*math.cos(a)))
    return 'M'+' L'.join('%.1f %.1f'%p for p in pts)+' Z'
def shrinking():
    sizes=[330,280,240,205,175]; x=0; parts=[]
    for ch,sz in zip('orbit',sizes):
        d,w,_=path_d(INS,ch,(('wdth',100),('wght',500)),size=sz,x0=x,y0=0); parts.append(d); x+=w-8
    return f'<g transform="translate({(1000-x)/2:.1f},620)"><path fill="{K}" d="{" ".join(parts)}"/></g>'
for i,s in enumerate(S):
    if s[0]=='A4': S[i]=('A4','Kerf','dikke ring met één schuine kerf, als een afgevinkt moment',P(op(stroke_d(E(500,500,320,320),160),rrect_poly(740,250,70,320,40),'d')),False)
    if s[0]=='C2': S[i]=('C2','Kleiner wordend','elke letter kleiner, alsof hij verder weg staat',shrinking(),True)
