/* ---- Config (enige bron van waarheid) ---- */
// ring: straal van de gestippelde ring, orbit: baanstraal van de bollen (eenheden in de 390-stage)
// tones: kleuren voor het verloop van de bol (basis, diep, licht)
export const LEVELS = [
  { id: 1, name: 'Nu',      ring: 38,  orbit: 24,  period: 1.1, color: '#FF3B30', tones: ['#FF3B30', '#FF2D92', '#FFA51F'], size: 7,   tail: 3 },
  { id: 2, name: 'Vandaag', ring: 72,  orbit: 72,  period: 2.8, color: '#FF8A00', tones: ['#FF8A00', '#FF3B6B', '#FFD84D'], size: 6,   tail: 2 },
  { id: 3, name: 'Week',    ring: 106, orbit: 106, period: 7,   color: '#E5B21A', tones: ['#EDB21E', '#F28C28', '#FFE07A'], size: 5.5, tail: 2 },
  { id: 4, name: 'Maand',   ring: 140, orbit: 140, period: 16,  color: '#22AFC6', tones: ['#22AFC6', '#4F6BFF', '#9BEBC8'], size: 5,   tail: 1 },
  { id: 5, name: 'Ooit',    ring: 174, orbit: 174, period: 38,  color: '#6A6CF6', tones: ['#6A6CF6', '#D06BFA', '#8FC2FF'], size: 5,   tail: 1 },
];
export const LEVEL_BY_ID = new Map(LEVELS.map(l => [l.id, l]));
export const URGENT_LEVEL = 1;
export const DEFAULT_LEVEL = 3;

// Kern zonder dringende taken: rustige, bleke bol
export const CALM_TONES = ['#CFCFDB', '#E9D9F2', '#BFD3EC'];

// Diepteprofiel van de trechter [straal, z]
export const PROFILE = [[0, -300], [38, -200], [72, -125], [106, -70], [140, -30], [174, 0]];
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
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ---- Iconen voor het wiel (24x24, lijn) ---- */
export const ICONS = {
  1: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6l1-8z"/>',
  2: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  3: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7 13.5h10M7 16.5h6"/>',
  4: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="8" cy="13.5" r=".6"/><circle cx="12" cy="13.5" r=".6"/><circle cx="16" cy="13.5" r=".6"/><circle cx="8" cy="16.8" r=".6"/><circle cx="12" cy="16.8" r=".6"/>',
  5: '<path d="M8.2 8.5C5.6 8.5 3.5 10 3.5 12s2.1 3.5 4.7 3.5c3.9 0 3.7-7 7.6-7 2.6 0 4.7 1.5 4.7 3.5s-2.1 3.5-4.7 3.5c-3.9 0-3.7-7-7.6-7z"/>',
};

export const iconSvg = (level, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[level]}</svg>`;
