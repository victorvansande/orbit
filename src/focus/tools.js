/* ---- Gereedschap naast het bakje ---- */
// Victor (12/11/2026): "zet gewoon links van het window (buiten het bakje) alle opties voor wat ik kan doen: een
// vernevelaar voor de mist, een schaartje voor de gele bladeren, een sponsje voor het raam; heel minimalistisch".
// Een soort die `tools` heeft (lijst van { id, toggle }), `tool` (het gekozen gereedschap), `lit` (stand van een
// schakelaar) en `pick(id)`, krijgt een smalle rij lijnicoontjes links buiten het bakje (op gsm erboven). Eén
// gereedschap is altijd gekozen; een schakelaar (lamp, lantaarn) staat los onderaan en gaat aan of uit.

const ICON = {
  mist: '<path d="M7 8.6h5v6.2a1.6 1.6 0 0 1-1.6 1.6H8.6A1.6 1.6 0 0 1 7 14.8z"/><path d="M8.2 8.6V6h2.6v2.6"/><path d="M8.2 6.5H6.3"/><path d="M10.8 6.4l2.2 1.7"/><path class="dot" d="M4 4.2v.01M2.9 6.5v.01M4 8.8v.01"/>',
  cut: '<circle cx="5.4" cy="13.6" r="2"/><circle cx="12.6" cy="13.6" r="2"/><path d="M6.6 12 12.4 2.8"/><path d="M11.4 12 5.6 2.8"/>',
  sponge: '<rect x="2.8" y="5.6" width="12.4" height="7.8" rx="2.4"/><path class="dot" d="M6.2 8.6v.01M9.4 10.6v.01M11.9 8.2v.01"/>',
  feed: '<path d="M2.8 9c2.2-3.3 6.6-3.7 9.2 0-2.6 3.7-7 3.3-9.2 0z"/><path d="M12 9l3.2-2.5v5z"/><path class="dot" d="M5.6 8.5v.01"/>',
  wind: '<path d="M2.8 6.4h7.4a2 2 0 1 0-2-2"/><path d="M2.8 9.6h10.4a2 2 0 1 1-2 2"/><path d="M2.8 12.8h4.2"/>',
  rake: '<path d="M14.6 3.4 7.2 10.8"/><path d="M4.4 9.4l4.2 4.2"/><path d="M4.4 9.4 3 10.8M5.8 10.8l-1.4 1.4M7.2 12.2l-1.4 1.4M8.6 13.6l-1.4 1.4"/>',
  lamp: '<path d="M5.9 7.8a3.1 3.1 0 1 1 6.2 0c0 1.5-1 2.1-1.4 3.2H7.3C6.9 9.9 5.9 9.3 5.9 7.8z"/><path d="M7.6 13.2h2.8M8.3 15.2h1.4"/>',
  lantern: '<path d="M3.6 7.6 9 3.6l5.4 4z"/><path d="M6.4 7.6v4.6h5.2V7.6"/><path d="M9 12.2v2.4M6.4 15h5.2"/>',
};

export function createTools(box, { label }) {
  const rail = document.createElement('div');
  rail.className = 'fidget-tools'; rail.hidden = true; rail.setAttribute('role', 'toolbar');
  box.after(rail);
  let mode = null;
  rail.addEventListener('click', e => { const b = e.target.closest('button[data-tool]'); if (b && mode) { mode.pick(b.dataset.tool); paint(); } });
  function paint() { for (const b of rail.children) b.setAttribute('aria-pressed', String(b.dataset.toggle ? Boolean(mode.lit) : mode.tool === b.dataset.tool)); }
  return {
    el: rail,
    // toon het gereedschap van deze soort, of niets
    sync(m) {
      mode = m?.tools?.length ? m : null;
      rail.hidden = !mode;
      if (!mode) { rail.replaceChildren(); rail.dataset.sig = ''; return; }   // anders bleef de rij leeg als hetzelfde gereedschap terugkwam
      const sig = mode.tools.map(t => t.id).join(' ');
      if (rail.dataset.sig !== sig) {
        rail.dataset.sig = sig;
        rail.replaceChildren(...mode.tools.map(t => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'fidget-tool'; b.dataset.tool = t.id; if (t.toggle) b.dataset.toggle = '1';
          b.title = label(`tool.${t.id}`); b.setAttribute('aria-label', b.title);
          b.innerHTML = `<svg viewBox="0 0 18 18" aria-hidden="true">${ICON[t.id] || ''}</svg>`;
          return b;
        }));
      }
      paint();
    },
  };
}
