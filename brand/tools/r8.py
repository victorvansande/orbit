import sys, math; sys.path.insert(0,'tools')
from r7 import *   # helpers: P, rect_d, op, squircle_d, stroke_d, textx, E, C, rrect_poly, fonts
import pathops
S2=[]
def add(code,name,idea,body,word=False): S2.append((code,name,idea,body,word))
FIG='fonts/Figtree[wght].ttf'; DMS='fonts/DMSans[opsz,wght].ttf'; ONE='fonts/Onest[wght].ttf'; SERR='fonts/InstrumentSerif-Regular.ttf'
PAP='#F1F1EF'
# G monogram / O
add('G1','O met horizon','hoofdletter-O, onderste helft vol: de dag die vol loopt',P(op(stroke_d(E(500,500,330,330),110),'M0 0 H1000 V1000 H0 Z','i'))+P(op(E(500,500,275,275),rect_d(0,500,1000,500),'i')))
add('G2','Twee gewichten','een o die schuin overgaat van dik naar dun, zonder taps',P(op(E(500,500,420,420),E(540,460,280,280),'d')))
add('G3','o met punt erboven','kleine o met een punt erboven, als een letter met een accent',textx('o',size=900,y=800)+P(C(500,140,80)))
add('G4','o punt','o gevolgd door een punt: af, klaar',textx('o.',size=820,y=760))
add('G5','Ob','hoofdletter O met een kleine b erin',P(stroke_d(E(500,500,380,380),70))+textx('b',size=430,y=640))
add('G6','Open hoek','o met één rechte hoek, half rond half vierkant',P(op('M 500 80 C 760 80 920 240 920 500 C 920 760 760 920 500 920 L 80 920 L 80 500 C 80 240 240 80 500 80 Z',E(500,500,250,250),'d')))
# H wordmarks
add('H1','Rond en vet','Figtree zwaar, vriendelijk en rond',textx('orbit',font=FIG,axes=(('wght',800),),size=330,y=610,extra={i:-10 for i in range(4)}),True)
add('H2','orbit punt','het woord met een afsluitende punt',textx('orbit.',font=INS,size=300,y=600,extra={i:-8 for i in range(5)}),True)
add('H3','Lijn onder','de t loopt door als een lijn onder het woord, een taak op een regel',textx('orbit',size=290,y=560,extra={i:-8 for i in range(4)})+P(rect_d(140,610,720,34,17)),True)
add('H4','Smal en hoog','DM Sans smal en strak, rustig in de app',textx('orbit',font=DMS,axes=(('wght',600),('opsz',40)),size=330,y=610,extra={i:-14 for i in range(4)}),True)
add('H5','Serif rechtop','Instrument Serif rechtop, klassiek en stil',textx('orbit',font=SERR,axes=(),size=400,y=640),True)
add('H6','Stip vervangt o','het woord met een volle stip in plaats van de o',P(C(205,525,92))+textx('rbit',size=300,y=620,x=310,extra={i:-8 for i in range(3)}),True)
# I shapes without circles
add('I1','Pil met spleet','een pil, een capsule, met één schuine spleet',P(op(rect_d(130,330,740,340,170),rrect_poly(560,500,44,420,25),'d')))
add('I2','Boog','een poortboog, een doorgang naar wat komt',P(op(rect_d(200,150,600,700,300).replace('A300 300','A300 300'),rect_d(330,380,340,470,170),'d')))
add('I3','Twee kwarten','twee kwartcirkels die samen een S vormen, beweging',P(op(C(330,330,330),rect_d(330,0,670,1000),'i').replace('Z','Z',1))+P(op(op(C(330,330,330),rect_d(0,330,1000,670),'d'),rect_d(330,0,670,1000),'d'))[0:0]+P(op(C(670,670,330),rect_d(0,0,670,1000),'d')))
add('I4','Haakje','een hoekig haakje dat iets vasthoudt',P(stroke_d('M 700 180 L 260 180 L 260 820 L 700 820',120,pathops.LineCap.ROUND_CAP)))
add('I5','Kantelvlak','een vierkant dat schuin wegdraait, een vlak in perspectief',P('M 220 300 L 820 180 L 780 760 L 180 820 Z'))
add('I6','Treden','drie treden van klein naar groot, wat dichtbij komt groeit',P(rect_d(150,600,180,250,40))+P(rect_d(410,450,180,400,40))+P(rect_d(670,250,180,600,40)))
# J fluid
add('J1','Penseelstreek','één brede streek met een ruwe start en een zachte uitloop',P('M 120 640 C 260 520 420 470 600 470 C 740 470 840 500 900 560 C 820 540 720 560 600 600 C 440 650 280 690 120 640 Z'))
add('J2','Gegoten druppel','een volle druppel die net loskomt',P('M 500 100 C 560 260 760 420 760 600 C 760 760 640 880 500 880 C 360 880 240 760 240 600 C 240 420 440 260 500 100 Z'))
add('J3','Lusje in de o','een o in één haal met een lusje waar hij sluit',P(stroke_d('M 640 230 C 520 140 300 170 220 360 C 140 560 260 820 500 830 C 740 840 860 600 800 400 C 760 270 640 200 560 260 C 500 310 560 380 640 340',95)))
add('J4','Golfstapel','drie golven onder elkaar, de bovenste het hoogst',''.join(P(stroke_d(f'M 140 {380+i*170} C 300 {380+i*170-(140-40*i)} 420 {380+i*170-(140-40*i)} 500 {380+i*170} C 580 {380+i*170+(140-40*i)} 700 {380+i*170+(140-40*i)} 860 {380+i*170}',70)) for i in range(3)))
add('J5','Spat','een volle vorm met een klein spatje ernaast, iets dat net gebeurd is',P(E(450,540,300,300))+P(C(800,250,70))+P(C(870,390,32)))
# K patterns
add('K1','Eén van negen','raster van negen ringen, één is vol: het ene dat nu telt',''.join(P(stroke_d(E(220+i*280,220+j*280,90,90),34)) if not (i==0 and j==2) else P(C(220,780,107)) for i in range(3) for j in range(3)))
add('K2','Strepen, één vet','vijf lijnen, de onderste vet: wat bovenaan je lijst moet',''.join(P(rect_d(150,190+i*140,700,(110 if i==4 else 26),(55 if i==4 else 13))) for i in range(5)))
add('K3','Rij van punten','punten die groter worden naar rechts, wat nadert',''.join(P(C(130+i*150,500,12+i*16)) for i in range(6)))
add('K4','Schaakbord-o','een o opgebouwd uit vierkante blokjes, pixel en risodruk',''.join(P(rect_d(100+i*100,100+j*100,92,92,10)) for i in range(8) for j in range(8) if 220<math.hypot(150+i*100-500,150+j*100-500)<410))
# L character
add('L1','Twee ogen','alleen twee pilvormige ogen in een tegel, een stil personage',P(rect_d(120,120,760,760,190))+P(rect_d(350,360,90,220,45),fill=PAP)+P(rect_d(560,360,90,220,45),fill=PAP))
add('L2','Bolletje met ogen','een zacht bolletje met twee ogen, speels en klein',P('M 500 160 C 760 160 880 360 880 560 C 880 760 720 860 500 860 C 280 860 120 760 120 560 C 120 360 240 160 500 160 Z')+P(rect_d(370,420,70,150,35),fill=PAP)+P(rect_d(560,420,70,150,35),fill=PAP))
add('L3','Knipoog','twee ogen, één dicht: droog en vriendelijk',P(rect_d(120,120,760,760,190))+P(rect_d(350,360,90,220,45),fill=PAP)+P(rect_d(540,450,130,50,25),fill=PAP))
