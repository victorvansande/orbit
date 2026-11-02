import sys; sys.path.insert(0,'tools')
from concepts import *
from typo import path_d
import cairosvg
def wordmark(x0, y0, size, text='orbit', extra=None):
    d,w,_=path_d(INS,text,AX,size=size,x0=x0,y0=y0,extra=extra); return d,w
def g(d, tx, ty, s): return f'<path transform="translate({tx},{ty}) scale({s})" fill-rule="evenodd" d="{d}"/>'
