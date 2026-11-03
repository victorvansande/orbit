/* ---- Tekens voor prestaties en rang ---- */
// Enkel SVG-tekst, geen DOM: app.js zet ze in de pagina. Alles in een vak van -12 tot 12 (rang: -13,5 tot 13,5, voor de stippen).
// Vierpuntige ster met holle zijden, zoals de sterren in de hemel.
export const starPath = (R, cx = 0, cy = 0, w = 0.2) => {
  const p = a => `${(cx + Math.cos(a) * R).toFixed(2)} ${(cy + Math.sin(a) * R).toFixed(2)}`;
  let d = `M${p(-Math.PI / 2)}`;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 2;
    d += ` Q${(cx + Math.cos(a + Math.PI / 4) * R * w).toFixed(2)} ${(cy + Math.sin(a + Math.PI / 4) * R * w).toFixed(2)} ${p(a + Math.PI / 2)}`;
  }
  return d + 'Z';
};
const STAR4 = starPath(6.6);
const at = (deg, r) => [Math.cos(deg * Math.PI / 180) * r, Math.sin(deg * Math.PI / 180) * r];

// Prestaties, T3 Fonkeling in de ring (Victor, 03/11/2026: "T3 maar dan nog steeds in een cirkel altijd"): elk niveau een
// eigen vorm, niet enkel een eigen kleur. Brons een kleine ster, zilver een volle, goud met vier sterretjes schuin eromheen,
// platina met acht (vier schuin, vier kleinere recht). Altijd binnen de ring.
const SPARK_D = [45, 135, 225, 315].map(a => starPath(1.9, ...at(a, 7.9), 0.25));
const SPARK_A = [0, 90, 180, 270].map(a => starPath(1.15, ...at(a, 8.7), 0.25));
const TIER_STAR = { bronze: starPath(5), silver: STAR4, gold: starPath(5.6), platinum: starPath(5.6) };
export function badgeSvg(secret = false, tier = null) {
  if (secret) return '<circle class="fb-ring" r="10.6"/><text class="fb-q" y="4">?</text>';
  const sparks = tier === 'gold' ? SPARK_D : tier === 'platinum' ? [...SPARK_D, ...SPARK_A] : [];
  return `<circle class="fb-ring" r="10.6"/><path class="fb-star" d="${TIER_STAR[tier] || STAR4}"/>${sparks.map(d => `<path class="fb-spark" d="${d}"/>`).join('')}`;
}

// Rang, N4 Banen en stippen (Victor, 03/11/2026, uit twee rondes: R1 tot R3, daarna N1 tot N4). Het metaal volgt groepen
// van rangen (1 tot 3 brons, 4 tot 6 zilver, 7 en 8 goud, 9 en 10 platina); het aantal banen zegt het metaal (brons één,
// zilver twee, goud drie, platina drie met een komeetje op de buitenste), de stippen op de buitenste baan de stap binnen
// dat metaal (één tot drie). De ster blijft vol en wordt kleiner naarmate er banen bijkomen.
const RANK_METAL = ['bronze', 'bronze', 'bronze', 'silver', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum'];
const RANK_STEP = [1, 2, 3, 1, 2, 3, 1, 2, 1, 2];
export const RANK_BOX = '-13.5 -13.5 27 27';
export const rankMetal = level => RANK_METAL[Math.min(10, Math.max(1, level)) - 1];
export function rankSvg(level) {
  const i = Math.min(10, Math.max(1, level)) - 1, t = ['bronze', 'silver', 'gold', 'platinum'].indexOf(RANK_METAL[i]), k = RANK_STEP[i];
  let s = '<circle class="fb-ring" r="10.6"/>';
  if (t >= 1) s += '<circle class="fb-ring fb-orbit" r="8.4"/>';
  if (t >= 2) s += '<circle class="fb-ring fb-orbit fb-orbit-in" r="6.4"/>';
  s += `<path class="fb-star" d="${starPath([6.6, 5.4, 4.2, 4.2][t])}"/>`;
  if (t === 3) {   // komeetje op de buitenste baan, rechtsboven, met een taps staartje achter zich
    const [x0, y0] = at(-40 - 57, 10.6), [x1, y1] = at(-40, 10.6);
    s += `<path class="fb-trail" d="M${x0.toFixed(2)} ${y0.toFixed(2)} A10.6 10.6 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}"/><circle class="fb-moon fb-comet" cx="${x1.toFixed(2)}" cy="${y1.toFixed(2)}" r="2.3"/>`;
  }
  for (let j = 0; j < k; j++) { const [x, y] = at(-90 + (j - (k - 1) / 2) * 34, 10.6); s += `<circle class="fb-moon" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.75"/>`; }
  return s;
}
