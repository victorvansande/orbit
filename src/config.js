/* ---- Config (enige bron van waarheid) ---- */
// ring: straal van de gestippelde ring, orbit: baanstraal van de bollen (eenheden in de 390-stage)
// color: tint op licht papier, dark: gedempte tint voor de donkere modus (minder verzadigd, geen kleurboek-effect)
export const LEVELS = [
  { id: 1, name: 'Nu',      ring: 38,  orbit: 38,  period: 1.1, color: '#E70049', dark: '#F0306A', size: 7,   tail: 3 },
  { id: 2, name: 'Vandaag', ring: 72,  orbit: 72,  period: 2.8, color: '#E08600', dark: '#F5A623', size: 6,   tail: 2 },
  { id: 3, name: 'Week',    ring: 106, orbit: 106, period: 7,   color: '#0FAE69', dark: '#20E08A', size: 5.5, tail: 2 },
  { id: 4, name: 'Maand',   ring: 140, orbit: 140, period: 16,  color: '#1F78B4', dark: '#38A0F0', size: 5,   tail: 1 },
  { id: 5, name: 'Ooit',    ring: 174, orbit: 174, period: 38,  color: '#08415C', dark: '#B3B9D6', size: 5,   tail: 1 },
];
export const LEVEL_BY_ID = new Map(LEVELS.map(l => [l.id, l]));

// Geeft een element beide tinten; CSS kiest via [data-tone] de juiste voor het thema
export function toneNode(node, lv) {
  node.dataset.tone = '';
  node.style.setProperty('--c-l', lv.color);
  node.style.setProperty('--c-d', lv.dark);
}
export const URGENT_LEVEL = 1;
export const DEFAULT_LEVEL = 3;

// Diepteprofiel van de trechter [straal, z]
const PROFILE = [[0, -300], [38, -200], [72, -125], [106, -70], [140, -30], [174, 0]];
export const RIM = PROFILE[PROFILE.length - 1][0];
export const TIP_Z = PROFILE[0][1];

export function depthAt(r) {
  if (r <= PROFILE[0][0]) return PROFILE[0][1];
  for (let i = 1; i < PROFILE.length; i++) {
    const [r1, z1] = PROFILE[i];
    if (r <= r1) {
      const [r0, z0] = PROFILE[i - 1];
      return z0 + (r - r0) / (r1 - r0) * (z1 - z0);
    }
  }
  return 0;
}

/* ---- Kleur ---- */
export function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = ([r, g, b], a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

/* ---- Iconen voor het wiel (24x24, lijn): set "Afstand", gekozen door Victor ---- */
// Hoe ver iets weg is: doelwit (nu), zonsopgang (vandaag), pad (week), berg (maand), oneindig (ooit).
const ICONS = {
  1: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  2: '<path d="M3 17.5h18M7 17.5a5 5 0 0 1 10 0M12 7v2.5M5.8 10.8l1.6 1.4M18.2 10.8l-1.6 1.4M7 21h10"/>',
  3: '<circle cx="5" cy="18" r="1.6"/><circle cx="19" cy="6" r="1.6"/><path d="M6.6 17.3c5-1.5 2-6.8 6.3-8.4 1.6-.6 3.6-.9 4.6-1.6" stroke-dasharray="2 2.6"/>',
  4: '<path d="M2.5 19.5l6.5-10 4 6 2.5-3.5 6 7.5z"/><circle cx="17" cy="6" r="1.7"/>',
  5: '<path d="M8.2 8.5C5.6 8.5 3.5 10 3.5 12s2.1 3.5 4.7 3.5c3.9 0 3.7-7 7.6-7 2.6 0 4.7 1.5 4.7 3.5s-2.1 3.5-4.7 3.5c-3.9 0-3.7-7-7.6-7z"/>',
};

export const iconSvg = (level, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[level]}</svg>`;
