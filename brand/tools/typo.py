import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import io, functools

@functools.lru_cache(None)
def load(path, axes):
    f = TTFont(path)
    if 'fvar' in f and axes:
        f = instancer.instantiateVariableFont(f, dict(axes), inplace=False)
    buf = io.BytesIO(); f.save(buf); data = buf.getvalue()
    return TTFont(io.BytesIO(data)), data

def shape(path, text, axes=(), features=None, extra=None):
    """Return list of (glyphname, x_offset_units, advance) with HB kerning; extra = {index: delta units} added after glyph i."""
    f, data = load(path, tuple(sorted(axes)))
    face = hb.Face(data); font = hb.Font(face)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, features or {"kern": True, "liga": True})
    order = f.getGlyphOrder()
    out=[]; x=0
    for i,(info,pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        out.append((order[info.codepoint], x + pos.x_offset, pos.x_advance))
        x += pos.x_advance + (extra or {}).get(i, 0)
    return f, out, x

def path_d(path, text, axes=(), size=100, x0=0, y0=0, extra=None):
    """SVG path data, baseline at y0, font size in px (units scaled by size/upm)."""
    f, glyphs, width = shape(path, text, axes, extra=extra)
    upm = f['head'].unitsPerEm; s = size/upm
    gs = f.getGlyphSet(); pen = SVGPathPen(gs)
    for name, x, adv in glyphs:
        tp = TransformPen(pen, (s, 0, 0, -s, x0 + x*s, y0))
        gs[name].draw(tp)
    return pen.getCommands(), width*s, f

def metrics(path, axes=()):
    f,_ = load(path, tuple(sorted(axes)))
    os2=f['OS/2']; upm=f['head'].unitsPerEm
    return dict(upm=upm, xh=os2.sxHeight, cap=os2.sCapHeight)
