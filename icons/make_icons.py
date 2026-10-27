import math, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PAPER, INK, RED = '#F1F1EF', '#1B1B22', '#FF3B30'
DARK_BG, DARK_INK = '#0F0F12', '#ECECF1'
# App-icoon is transparant (liquid glass): middengrijs blijft leesbaar op lichte én donkere achtergronden
GLASS_INK = '#8A8A94'

def comet(cx, cy, R, head, head_deg, span_deg, steps=40):
    """Taps bolletje: polygoon langs de baan + ronde kop (draaizin met de klok mee, kop vooraan)."""
    left, right = [], []
    for k in range(steps + 1):
        p = k / steps
        a = math.radians(head_deg - p * span_deg)
        w = head * (1 - p * 0.86)
        left.append((cx + math.cos(a) * (R + w), cy + math.sin(a) * (R + w)))
        right.append((cx + math.cos(a) * (R - w), cy + math.sin(a) * (R - w)))
    pts = left + right[::-1]
    d = 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + ' Z'
    a = math.radians(head_deg)
    hx, hy = cx + math.cos(a) * R, cy + math.sin(a) * R
    return d, (hx, hy)

def mark(scale=1.0, ring=True, ink=INK, red=RED, ring_ink=None, bold=False, ring_opacity=.28):
    """Merkteken in een 100x100-vak, geschaald rond het midden."""
    c = 50
    R = 29 * scale
    head = (6.4 if bold else 4.6) * scale
    d, (hx, hy) = comet(c, c, R, head, -38, 165)
    parts = []
    if ring:
        parts.append(f'<circle cx="{c}" cy="{c}" r="{R:.2f}" fill="none" stroke="{ring_ink or ink}" stroke-opacity="{ring_opacity}" stroke-width="{1.5*scale:.2f}" stroke-linecap="round" stroke-dasharray="0 {4.6*scale:.2f}"/>')
    parts.append(f'<circle cx="{c}" cy="{c}" r="{15*scale:.2f}" fill="{red}" fill-opacity=".16"/>')
    parts.append(f'<circle cx="{c}" cy="{c}" r="{(9.5 if bold else 8.5)*scale:.2f}" fill="{red}"/>')
    parts.append(f'<path d="{d}" fill="{ink}"/>')
    parts.append(f'<circle cx="{hx:.2f}" cy="{hy:.2f}" r="{head:.2f}" fill="{ink}"/>')
    return '\n  '.join(parts)

def svg(body, bg=None, rx=0):
    rect = f'<rect width="100" height="100" rx="{rx}" fill="{bg}"/>\n  ' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n  {rect}{body}\n</svg>\n'

files = {
    # app-iconen: volledig transparant buiten de orbit-elementen (iOS liquid glass, Android 'any')
    'icons/icon-full.svg': svg(mark(1.0, ink=GLASS_INK, ring_opacity=.55)),
    'icons/icon-any.svg': svg(mark(0.92, ink=GLASS_INK, ring_opacity=.55)),
    # Android 'maskable': inhoud binnen de veilige cirkel (80 %)
    'icons/icon-maskable.svg': svg(mark(0.72), PAPER),
    # Material You thema-icoon: één kleur op transparant
    'icons/icon-monochrome.svg': svg(mark(0.72, ring=False, ink='#fff', red='#fff')),
}
# favicon: vetter, zonder stippelring, past zich aan licht en donker aan
fav_body = mark(1.28, ring=False, bold=True).replace(f'fill="{INK}"', 'class="ink"')
files['favicon.svg'] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    .bg {{ fill: {PAPER}; }} .ink {{ fill: {INK}; }}
    @media (prefers-color-scheme: dark) {{ .bg {{ fill: #19191D; }} .ink {{ fill: {DARK_INK}; }} }}
  </style>
  <rect class="bg" width="100" height="100" rx="24"/>
  {fav_body}
</svg>
'''
for name, content in files.items():
    with open(os.path.join(OUT, name), 'w') as f: f.write(content)
print('ok')
