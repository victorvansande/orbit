import sys; sys.path.insert(0,'tools')
from typo import load
from geom import circle_d
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
INS='fonts/InstrumentSans[wdth,wght].ttf'; AX=(('wdth',100),('wght',500))
# spacing in font units (upm 1000): base tracking -10, pair corrections
TRACK=-10
PAIRS={('r','b'):-16, ('i','t'):-10}
TITTLE=dict(cx=125, cy=668, r=60)   # replaces square 115x117 tittle
def wordmark(size=1000, x0=0, y0=0, text='orbit'):
    """Returns (svg path d, width px, metrics). Baseline at y0."""
    f,_=load(INS,AX); gs=f.getGlyphSet(); s=size/1000
    pen=SVGPathPen(gs); x=0; extra=''
    for k,ch in enumerate(text):
        name={'i':'dotlessi'}.get(ch,ch)
        gs[name].draw(TransformPen(pen,(s,0,0,-s,x0+x*s,y0)))
        if ch=='i':
            extra+=' '+circle_d(x0+(x+TITTLE['cx'])*s, y0-TITTLE['cy']*s, TITTLE['r']*s)
        adv=f['hmtx'][name][0]
        x+=adv
        if k<len(text)-1:
            x+=TRACK+PAIRS.get((ch,text[k+1]),0)
    # visual width: from o's lsb to t's right ink edge
    width=(x - 26 - 33)*s   # minus t rsb and o lsb
    return pen.getCommands()+extra, x*s, dict(lsb=33*s, xh=510*s, asc=732*s, overshoot=10*s)
