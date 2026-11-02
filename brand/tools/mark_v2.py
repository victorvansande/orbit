"""Orbit beeldmerk, ronde C: echte komeet op een gekantelde baan (zie comet2.py)."""
import sys; sys.path.insert(0,'tools')
from comet2 import inner, bbox, head, head_d, mono_d, tail_d, outline
MASTER=dict(cx=500,cy=500,a=410,b=270,rot=-24,head_at=45,sweep=328,hr=80,tail0=0.9,floor=0.06,k=1.4)
SMALL =dict(cx=500,cy=500,a=420,b=300,rot=-20,head_at=45,sweep=318,hr=105,tail0=0.8,floor=0.32,k=1.0)
