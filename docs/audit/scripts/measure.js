// Draait in de pagina: meet de huidige toestand. Geeft {hscroll, overflow[], overlap[], small[], contrast[], offscreen[]}
() => {
  const vw = innerWidth, vh = innerHeight, out = { hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, overflow: [], overlap: [], small: [], contrast: [], offscreen: [] };
  const dlg = [...document.querySelectorAll('dialog[open]')].pop();
  const menu = document.querySelector('.hud-menu.is-open');
  const scope = dlg || menu || document.body;
  const name = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; else if (e.classList.length) s += '.' + [...e.classList].slice(0, 2).join('.'); const t = (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 18); return t ? `${s}"${t}"` : s; };
  const visible = e => {
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; if (n.hidden) return false; }
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
    return true;
  };
  const textRects = e => { const rects = []; for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 0.5) rects.push(r); } return rects; };
  const els = [...scope.querySelectorAll('*')].filter(e => !e.closest('svg') && !['SCRIPT', 'STYLE', 'CANVAS', 'svg'].includes(e.tagName));
  const textEls = els.filter(e => textRects(e).length && visible(e));
  // afgekapt: tekst buiten een afknippende voorouder zonder bedoeld vervagen
  for (const e of textEls) {
    for (let a = e; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const intended = cs.textOverflow === 'ellipsis' || cs.maskImage !== 'none' || cs.webkitMaskImage && cs.webkitMaskImage !== 'none' || /scroll|auto/.test(cs.overflowX + cs.overflowY);
      if (intended) break;
      const ar = a.getBoundingClientRect();
      const bad = textRects(e).some(r => r.right > ar.right + 1.5 || r.left < ar.left - 1.5 || r.bottom > ar.bottom + 2 || r.top < ar.top - 2);
      if (bad) out.overflow.push(name(e) + ' in ' + name(a));
      break;
    }
    const tr = textRects(e);
    if (tr.some(r => r.right > vw + 1 || r.left < -1)) out.offscreen.push(name(e));
  }
  // overlap tussen teksten
  const boxes = textEls.map(e => ({ e, rs: textRects(e) }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
    for (const a of A.rs) for (const b of B.rs) {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 3) { out.overlap.push(name(A.e) + ' x ' + name(B.e) + ` (${w.toFixed(0)}x${h.toFixed(0)})`); break; }
    }
  }
  // trefzones (enkel touch-maten)
  if (matchMedia('(hover: none)').matches || vw <= 820) {
    const inter = els.filter(e => e.matches('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=radio], [role=checkbox], summary') && visible(e) && !e.disabled);
    for (const e of inter) {
      const r = e.getBoundingClientRect(); let w = r.width, h = r.height;
      const af = getComputedStyle(e, '::after');
      if (af.content !== 'none' && af.position === 'absolute' && af.pointerEvents !== 'none') {
        const px = v => (v === 'auto' ? null : parseFloat(v));
        const l = px(af.left), rr = px(af.right), t = px(af.top), b = px(af.bottom);
        if (l !== null && rr !== null) w = Math.max(w, r.width - l - rr); else if (af.width !== 'auto') w = Math.max(w, parseFloat(af.width));
        if (t !== null && b !== null) h = Math.max(h, r.height - t - b); else if (af.height !== 'auto') h = Math.max(h, parseFloat(af.height));
      }
      if (w < 35.5 || h < 35.5) out.small.push(`${name(e)} ${w.toFixed(0)}x${h.toFixed(0)}`);
    }
  }
  // contrast
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) { const n = c.match(/color\(srgb ([^)]+)\)/); if (!n) return null; const p = n[1].split(/[\s/]+/).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; } const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const bgOf = e => { const stack = []; for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); const c = parse(cs.backgroundColor); if (cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return null; if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.99) break; } if (n.tagName === 'DIALOG' && c && c[3] > 0.5) break; } let base = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]; for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base); return base; };
  for (const e of textEls) {
    if (e.closest('[disabled], [aria-disabled=true]')) continue;
    const cs = getComputedStyle(e); let fg = parse(cs.color); if (!fg) continue;
    let op = 1; for (let n = e; n; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    const bg = bgOf(e); if (!bg) continue;
    fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight;
    const big = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = big ? 3 : 4.5;
    if (ratio < need - 0.05) out.contrast.push(`${name(e)} ${ratio.toFixed(2)}${op < 1 ? ' op' + op.toFixed(2) : ''} ${size}px`);
  }
  return out;
}
