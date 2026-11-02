"""Orbit beeldmerk, ronde D (definitief na de testlus): zie comet3.py"""
import sys; sys.path.insert(0,'tools')
from comet3 import inner, bbox, head, head_d, mono_d, tail_d
# hr: straal kop; wj: staartbreedte bij de aanhechting (= kop / 1,3); wmin: dunste staart; joint: graden tussen kopmidden en aanhechting
MASTER=dict(cx=500,cy=500,a=410,b=270,rot=-24,head_at=70,sweep=300,joint=26,hr=82,wj=126,wmin=38,k=1.25,gap=14)
SMALL =dict(cx=500,cy=500,a=420,b=300,rot=-20,head_at=70,sweep=292,joint=24,hr=108,wj=160,wmin=86,k=1.0,gap=0)
