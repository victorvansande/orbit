"""Schrijft de icoon-SVG's (icon-*.svg en ../favicon.svg) uit het merk in src/core/mark.js (merk v1, 02/11/2026).
Daarna: node icons/render_icons.mjs (PNG's en favicon.ico)."""
import json, os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PAPER, INK, RED = '#F1F1EF', '#1B1B22', '#E70049'
DARK_BG, DARK_INK, DARK_RED = '#19191D', '#ECECF1', '#F0306A'
# app-icoon transparant (iOS liquid glass, Android 'any'): middengrijs blijft leesbaar op licht en donker, de kop blijft rood
GLASS_INK = '#8A8A94'
src = open(os.path.join(ROOT, 'src/core/mark.js'), encoding='utf8').read()
M = {k: json.loads(v) for k, v in re.findall(r'export const (\w+) = (\{.*\});', src)}

def place(sym, width, ink, head, extra=''):
    """het merk in een vak van 100 x 100, width = breedte in procent, optisch gecentreerd"""
    s = width / sym['w']; ox, oy = sym['oc']
    tx, ty = 50 - ox * s, 50 - oy * s
    hx, hy, hr = sym['head']
    return (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.5f})"{extra}>'
            f'<path {ink} d="{sym["tail"]}"/><circle {head} cx="{hx}" cy="{hy}" r="{hr}"/></g>')

def svg(body, bg=None, rx=0):
    rect = f'<rect width="100" height="100" rx="{rx}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{rect}{body}</svg>\n'

S, SS = M['SYMBOL'], M['SYMBOL_SMALL']
files = {
    'icons/icon-full.svg': svg(place(S, 70, f'fill="{GLASS_INK}"', f'fill="{RED}"')),
    'icons/icon-any.svg': svg(place(S, 66, f'fill="{GLASS_INK}"', f'fill="{RED}"')),
    # maskable: alles binnen de veilige cirkel van 80 %
    'icons/icon-maskable.svg': svg(place(S, 58, f'fill="{INK}"', f'fill="{RED}"'), PAPER),
    # Material You: één kleur op transparant
    'icons/icon-monochrome.svg': svg(place(S, 58, 'fill="#fff"', 'fill="#fff"')),
}
# favicon: de kleine tekening op een papieren tegel, volgt licht en donker
files['favicon.svg'] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>'
    f'.bg{{fill:{PAPER}}}.ink{{fill:{INK}}}.head{{fill:{RED}}}'
    f'@media (prefers-color-scheme: dark){{.bg{{fill:{DARK_BG}}}.ink{{fill:{DARK_INK}}}.head{{fill:{DARK_RED}}}}}'
    '</style><rect class="bg" width="100" height="100" rx="22"/>'
    + place(SS, 80, 'class="ink"', 'class="head"') + '</svg>\n')
for name, content in files.items():
    with open(os.path.join(ROOT, name), 'w') as f: f.write(content)
print('ok')
