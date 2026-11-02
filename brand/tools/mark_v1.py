"""Orbit mark v1 (gekozen 02/11/2026): komeet van ronde 3 + stevig begin (V13) + witte rand rond de kop (V18).
Constructie in een vak van 1000 eenheden. Centrale lijn: ellips a x b, gekanteld rot graden; de staart loopt tegen de klok in
(op het scherm) van th0 over sweep graden; breedte w(u) = w0 + (w1 - w0) * u^k; kopdiameter = head * w1; witte rand = gap."""
import sys, math; sys.path.insert(0,'tools')
from comet import _pt, outline_d
from geom import circle_d
from final import _P, _D, _clean
import pathops
MASTER = dict(a=380, b=290, rot=-32, cx=500, cy=500, th0=528, sweep=-356, w0=36, w1=84, k=1.5, head=1.75, gap=16, knots=10)
SMALL  = dict(a=400, b=306, rot=-32, cx=500, cy=500, th0=526, sweep=-352, w0=70, w1=118, k=1.0, head=1.62, gap=30, knots=8)
def head(p):
    X,Y,_,_=_pt(p,p['th0']+p['sweep']); return X,Y,p['w1']*p['head']/2
def head_d(p): x,y,r=head(p); return circle_d(x,y,r)
def halo_d(p): x,y,r=head(p); return circle_d(x,y,r+p['gap'])
def tail_d(p):
    """staart met de kop en de witte rand eruit gesneden: geen overlap, ook niet in de tweekleurige versie"""
    return _clean(_D(pathops.op(_P(outline_d(p)),_P(halo_d(p)),pathops.PathOp.DIFFERENCE)))
def bbox(p):
    a=_P(tail_d(p)); b=_P(head_d(p)); u=pathops.op(a,b,pathops.PathOp.UNION).bounds
    return u[0],u[1],u[2]-u[0],u[3]-u[1]
def inner(p, ink, headc=None):
    return f'<path fill="{ink}" d="{tail_d(p)}"/><path fill="{headc or ink}" d="{head_d(p)}"/>'

# ---- ronde B: kop vergroeid met het dikke eind, dunne begin loopt uit tot een punt
def tail_fused_d(p):
    """staart verenigd met de kop; enkel de dunne start krijgt een witte rand (gap) als ze de kop nadert"""
    t=_P(outline_d(p)); h=_P(head_d(p))
    if p.get('gap',0):
        x,y,r=head(p)
        # snij alleen de dunne start weg rond de kop: het eerste stuk van de staart
        from comet import _edge
        cut=_P(circle_d(x,y,r+p['gap']))
        first=dict(p); first['sweep']=p['sweep']*0.25
        start=pathops.op(_P(outline_d(first)),cut,pathops.PathOp.INTERSECTION)
        t=pathops.op(t,start,pathops.PathOp.DIFFERENCE)
    return _clean(_D(pathops.op(t,h,pathops.PathOp.UNION)))
def tail_only_fused_d(p):
    """voor tweekleurig: staart zonder kop (kop apart in rood), zonder overlap"""
    return _clean(_D(pathops.op(_P(tail_fused_d(p)),_P(head_d(p)),pathops.PathOp.DIFFERENCE)))
def inner_fused(p, ink, headc=None):
    if headc and headc!=ink:
        return f'<path fill="{ink}" d="{tail_only_fused_d(p)}"/><path fill="{headc}" d="{head_d(p)}"/>'
    return f'<path fill="{ink}" d="{tail_fused_d(p)}"/>'

# ---- definitieve parameters na ronde B
MASTER = dict(a=380, b=290, rot=-32, cx=500, cy=500, th0=530, sweep=-358, w0=6, w1=92, k=1.3, head=2.0, gap=22, knots=12)
SMALL  = dict(a=410, b=320, rot=-24, cx=500, cy=500, th0=172+328, sweep=-328, w0=72, w1=128, k=1.0, head=1.78, gap=0, knots=8)
inner = inner_fused
def bbox(p):
    u=_P(tail_fused_d(p)).bounds; return u[0],u[1],u[2]-u[0],u[3]-u[1]

def _drop_specks(d, min_area=400):
    """verwijder losse snippers die bij het snijden overblijven"""
    p=_P(d); out=pathops.Path(); pen=out.getPen()
    for c in p.contours:
        if abs(c.area) >= min_area:
            c.draw(pen)
    return _clean(_D(out))
_tail_fused_raw = tail_fused_d
def tail_fused_d(p): return _drop_specks(_tail_fused_raw(p))
def tail_only_fused_d(p):
    return _clean(_D(pathops.op(_P(tail_fused_d(p)),_P(head_d(p)),pathops.PathOp.DIFFERENCE)))
def tail_only_fused_d(p):
    return _drop_specks(_D(pathops.op(_P(tail_fused_d(p)),_P(head_d(p)),pathops.PathOp.DIFFERENCE)))
