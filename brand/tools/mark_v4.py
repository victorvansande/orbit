"""Orbit beeldmerk, ronde D (definitief na de testlus).
Komeet op een gekantelde ellipsbaan. Staart: breedte wmin aan de (ronde) punt, groeit met u^k tot wmax aan de kop.
Kop: cirkel met straal hr op de baan; in de master gescheiden van de staart door een witte rand (gap), in de kleine versie
vergroeid (de staart loopt onder de rode kop door)."""
import sys, math; sys.path.insert(0,'tools')
from comet2 import pt, outline
from geom import circle_d
from final import _P, _D, _clean
import pathops
MASTER=dict(cx=500,cy=500,a=410,b=270,rot=-24,head_at=70,sweep=322,hr=100,wmax=112,wmin=4,k=2.3,gap=20,cap=False)
SMALL =dict(cx=500,cy=500,a=420,b=300,rot=-20,head_at=70,sweep=316,hr=128,wmax=150,wmin=56,k=1.5,gap=0,cap=True)
def _c(p):  # map to comet2 parameters
    q=dict(p); q['tail0']=p['wmax']/(2*p['hr']); q['floor']=p['wmin']/p['wmax']; return q
def head(p): X,Y,_,_=pt(p,p['head_at']); return X,Y,p['hr']
def head_d(p): x,y,r=head(p); return circle_d(x,y,r)
def _tail_body(p):
    q=_c(p); P=_P(outline(q,knots=14))
    tx,ty,_,_=pt(p,p['head_at']+p['sweep'])
    if p.get('cap',True): P=pathops.op(P,_P(circle_d(tx,ty,p['wmin']/2)),pathops.PathOp.UNION)   # ronde punt (kleine versie)
    return P
def mono_d(p):
    P=_tail_body(p); x,y,r=head(p)
    if p['gap']:
        P=pathops.op(P,_P(circle_d(x,y,r+p['gap'])),pathops.PathOp.DIFFERENCE)
    P=pathops.op(P,_P(circle_d(x,y,r)),pathops.PathOp.UNION)
    return _clean(_D(P))
def tail_d(p):
    """staart zonder kop: met witte rand in de master, zonder rand (wordt overlapt) in de kleine versie"""
    P=_tail_body(p); x,y,r=head(p)
    if p['gap']: P=pathops.op(P,_P(circle_d(x,y,r+p['gap'])),pathops.PathOp.DIFFERENCE)
    return _clean(_D(P))
def inner(p, ink, headc=None):
    if p['gap']:
        return f'<path fill="{ink}" d="{tail_d(p)}"/><path fill="{headc or ink}" d="{head_d(p)}"/>'
    if headc and headc!=ink:
        return f'<path fill="{ink}" d="{tail_d(p)}"/><path fill="{headc}" d="{head_d(p)}"/>'
    return f'<path fill="{ink}" d="{mono_d(p)}"/>'
def bbox(p):
    u=_P(mono_d(p)).bounds; return u[0],u[1],u[2]-u[0],u[3]-u[1]
