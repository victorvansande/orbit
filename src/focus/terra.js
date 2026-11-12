/* ---- Paludarium in het bakje van de focusmodus ---- */
// Natuurvenster (Victor, 12/11/2026): geschilderd in de geest van Ghibli, stijl S1 Penseel (src/focus/brush.js), over het
// hele bakje zonder kader, recht vooruit, in volle natuurkleur (enkel hier). Verfijnd op 12/11/2026 (Victor: "gezelliger,
// realistischer, een levendige achtergrond zoals een mosmuur, alle acties als gereedschap links van het bakje"):
// - achterwand: kurk met moskussens, klimvijg, wortels, varentjes; links gestapelde rots met een waterval in twee
//   trappen; rechts een oever met mos en een stuk kienhout met een bromelia; onder water zand, kiezels, vallisneria
//   en een schooltje neontetra's; in de hoeken donker blad dat het beeld omlijst.
// - licht (src/focus/light.js): overdag de lamp van boven met bladschaduw, na zonsondergang een warme avondlamp die
//   het midden verlicht en de hoeken donker laat, 's nachts maanlicht, vuurvliegjes die hun omgeving echt verlichten
//   en paddenstoeltjes die zacht gloeien. De lamp volgt de zon en de klok (uit van 23 tot 6.30 uur), niet het thema.
// - gereedschap (links van het bakje): nevelen (tik of ingedrukt houden), snoeien (tik op een geel blad), spons
//   (slepen veegt het glas), voeren (tik: vlokken, de visjes komen), lamp aan of uit.
// Zorg: na drie dagen zonder nevelen is het glas droog en hangen de varens wat, nooit meer dan dat.
// Stand (Victor, 12/11/2026: "laat de stand volledig behouden blijven, in elke window size, op elk gesyncd device, na
// elke sluiting"): de scène blijft bestaan als het bakje van maat verandert (`rezoom`), en alles wat ertoe doet gaat
// naar scores.game('terra') als { run, at } (mee in sync, export en import): wanneer geneveld, de lamp, gele bladeren
// en wanneer het volgende komt, waar de kikker en de slak zitten, de aanslag en de druppels op het glas (dew.pack).
// Geluid enkel bij acties. Minder beweging: één beeld.

import { createBrush, layer, rng, smooth, clamp } from './brush.js';
import { createLight, daylight } from './light.js';
import { createFall } from './falls.js';
import { createDew } from './dew.js';
import { frogSprite, drawFrog, drawTetra, drawSnail } from './fauna.js';
import { playTerra } from '../scene/sound.js';

const W = 325.6, H = 226.8, TAU = Math.PI * 2, PAD = 10, WATER = 165, SURF = 160.5;
const DRY_MS = 3 * 86400e3;          // zo lang na het nevelen is het glas helemaal droog
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// plekken waar de kikker graag zit (voeten), de oever, het pad van de slak, paddenstoeltjes
const along = P => x => { for (let i = 0; i < P.length - 1; i++) { const [x0, y0] = P[i], [x1, y1] = P[i + 1]; if (x <= x1) return y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0), 0, 1); } return P[P.length - 1][1]; };
const BANK = [[152, 162], [164, 157.5], [180, 152], [200, 147.5], [224, 143.5], [252, 139.5], [282, 134.5], [312, 130], [348, 126]];
const HILL = [[172, 162], [196, 144], [232, 130], [272, 121], [316, 113], [348, 109]];
const SAND = [[-12, 206], [40, 203.5], [90, 206.5], [140, 203], [190, 198.5], [240, 190.5], [290, 182.5], [348, 176]];
const bankY = along(BANK), hillY = along(HILL), sandY = along(SAND);
const PERCH = [[214, 143.6], [70, 101.4], [180, 58.5], [300, 130.4], [24, 121]];
const stoneF = (b, x, y, r) => b.rock([[x - r, y + r * 0.5], [x - r * 0.6, y - r * 0.6], [x + r * 0.6, y - r * 0.6], [x + r, y + r * 0.5], [x, y + r]], '#55534c', { wet: 0.6, cracks: 0 });
const SNAIL = [[0, 123], [12, 120.5], [30, 121.5], [46, 127]];
const SHROOM = [[248, 137.4], [253, 136.6], [244, 138.4]];
const VINES = [[150, 44], [196, 54], [262, 40], [306, 62]];
const FERN = [[-2.55, 38], [-2.15, 50], [-1.8, 58], [-1.45, 60], [-1.1, 56], [-0.78, 48], [-0.5, 38]];
export const TERRA_TOOLS = [{ id: 'mist' }, { id: 'cut' }, { id: 'sponge' }, { id: 'feed' }, { id: 'lamp', toggle: true }];

export function createTerra({ reducedMotion, store, zoom = 1, now = () => new Date(), onTool = () => {} }) {
  let cv = null, g = null, scale = 1, built = null, dew = null, light = null, started = false, dirty = false, seenAt = 0, pending = null, nextYellowAt = Date.now() + 40e3;
  let t = 0, lastNow = 0, px = 0, py = 0, hover = { x: W / 2, y: H / 2, at: -99 }, ptr = null;
  let tool = 'mist', userLamp = null, lampLv = 1, dayLv = 1, day = daylight(now()), dayAt = -99, mistAt = 0, savedAt = 0, sprayAt = -9, damp = 0;
  let spray = [], haze = [], glints = [], rings = [], flies = [], springs = [], fish = [], bubbles = [], flakes = [], yellows = [], fallen = [];
  let frog = null, snail = null;
  const ferns = FERN.map(([a0, len], i) => ({ x: 40 + i * 1.2, y: 52, len, a0, a: 0, v: 0, k: i * 2.1 }));
  const vines = VINES.map(([x, len], i) => ({ x, y: -3, len, a: 0, v: 0, k: i * 1.7 }));
  const weeds = [172, 186, 205, 224, 246, 281, 300, 314].map((x, i) => ({ x, base: sandY(x) + 2, top: 170 + (i * 13 % 9), k: i * 1.3, w: 1.5 + (i % 3) * 0.4 }));
  const fallA = createFall({ x0: 80, x1: 89, y0: 76, x2: 79, x3: 91, y1: 108.5, time: 0.42, seed: 3, strands: 14, veils: 5, mist: 0.3 });
  const fallB = createFall({ x0: 109, x1: 129, y0: 113, x2: 105.5, x3: 133, y1: 162.5, time: 0.56, seed: 5, strands: 34, veils: 11, split: { u: 0.43, k: 0.5, w: 0.28 } });

  /* ---- zorg en stand ---- */
  const moist = () => clamp(1 - (Date.now() - mistAt) / DRY_MS, 0, 1);
  const clockLamp = () => day.h >= 6.5 && day.h < 23;
  const lampOn = () => userLamp ?? clockLamp();
  // alles wat de stand uitmaakt; het glas enkel als het er staat (anders blijft wat bewaard was)
  function snapshot() {
    const glass = dew ? dew.pack() : pending ? { fog: pending.fog, drops: pending.drops } : {};
    return { mist: mistAt, lamp: userLamp, yellow: yellows.map(y => y.vine), nextY: Math.round(nextYellowAt), frog: frog.hop ? frog.hop.to : frog.p, snail: [Math.round(snail.u * 1000) / 1000, snail.dir], ...glass, fogAt: Date.now() };
  }
  // bewaren: meteen na een daad (force), anders hooguit om de 15 s
  function save(force) {
    const n = Date.now();
    if (!force && n - savedAt < 15000) { dirty = true; return; }
    savedAt = n; dirty = false; seenAt = n;
    store?.save?.({ run: snapshot(), at: n });
  }
  // de bewaarde stand overnemen (bij het laden, of als een ander toestel iets deed)
  function restore() {
    const v = store?.load?.(), r = v?.run;
    if (!r || !(v.at > seenAt)) return;
    seenAt = v.at;
    if (Number.isFinite(r.mist)) mistAt = r.mist;
    if ('lamp' in r) userLamp = typeof r.lamp === 'boolean' ? r.lamp : null;
    if (Array.isArray(r.yellow)) yellows = [...new Set(r.yellow)].filter(i => Number.isInteger(i) && i >= 0 && i < VINES.length).slice(0, 3).map(vine => ({ vine }));
    if (Number.isFinite(r.nextY)) nextYellowAt = r.nextY;
    if (Number.isInteger(r.frog) && PERCH[r.frog] && frog && !frog.hop && r.frog !== frog.p) { frog.p = r.frog; [frog.x, frog.y] = PERCH[r.frog]; }
    if (Array.isArray(r.snail) && snail) { snail.u = clamp(+r.snail[0] || 0, 0, 1); snail.dir = r.snail[1] < 0 ? -1 : 1; }
    if (typeof r.fog === 'string') { pending = { fog: r.fog, drops: r.drops, at: r.fogAt }; if (dew) glassFrom(); }
  }
  // het glas zoals het bewaard was, met de aanslag van de tijd ertussen
  function glassFrom() { if (pending && dew.unpack(pending, (Date.now() - (pending.at || Date.now())) / 1000, moist())) started = true; pending = null; }
  const flush = () => { if (document.hidden && dirty) save(true); };

  /* ---- schilderen: één keer per opbouw ---- */
  function build() {
    const full = () => layer(W + PAD * 2, H, scale, PAD, 0);
    const back = full(), mid = full(), fore = full(), near = full();
    const X0 = -PAD - 2, X1 = W + PAD + 2;

    // achterwand: kurk, moskussens, klimvijg, wortels, varentjes; onder water donker
    let b = createBrush(back.c, 41);
    b.wash(X0, 0, X1, H, '#40382a', '#1c1a14');
    b.area([[X0, -2, 1], [X1, -2, 1], [X1, H, 1], [X0, H, 1]], '#3a3324', { shade: 1, dab: 1.2, size: 1.5, max: 5200, dir: (x, y) => 1.45 + (b.nz(x * 0.02, y * 0.02, 2) - 0.5) * 1.4, lum: (u, v, x, y) => (b.nz(x * 0.035, y * 0.05, 3) - 0.5) * 1.5 - v * 0.25 });
    for (let i = 0; i < 26; i++) { const x = X0 + b.q() * (X1 - X0), y = b.q() * 160; b.dab(x, y, '#0e0d0a', 0.3, 5 + b.q() * 12, 2 + b.q() * 5, 1.2 + b.q() * 0.8); }
    const MOSS = ['#4f8530', '#5f9434', '#3f7030', '#6ea33a', '#56883a', '#7a9c3c'];
    for (let i = 0, n = 0; i < 900 && n < 64; i++) {
      const x = X0 + b.q() * (X1 - X0), y = b.q() * 158, f = b.nz(x * 0.021 + 3, y * 0.027, 2);
      if (f < 0.47 + (y / 160) * 0.08) continue;
      n++;
      const s = 0.6 + (f - 0.47) * 5 + b.q() * 0.5, l0 = 0.22 - Math.hypot(x - 150, y + 20) / 420 - (y / 160) * 0.12;
      b.moss(x, y, 7 * s + b.q() * 5, 3.6 * s + b.q() * 2.4, MOSS[(i + Math.floor(f * 9)) % MOSS.length], { l0, dense: 0.9, fringe: s > 1 });
    }
    for (const pts of [[[58, -4], [70, 40], [64, 92], [80, 158]], [[150, -4], [141, 52], [160, 108], [152, 162]], [[252, -4], [264, 58], [245, 118], [258, 160]], [[322, -4], [312, 70], [330, 140]]]) b.branch(pts, '#4c3a28', 2.6, 1.3);
    for (const pts of [[[104, -4], [100, 30], [108, 64]], [[206, -4], [212, 36], [204, 80], [210, 112]], [[288, -4], [282, 44], [290, 88]]]) b.stem(pts, '#5a4630', 0.8, 0.4);
    for (let i = 0; i < 7; i++) {
      let x = 10 + i * 48 + b.q() * 26, y = -4 + b.q() * 30, a = 1.3 + b.q() * 0.6; const pts = [[x, y]];
      for (let k = 0; k < 9 + b.q() * 6; k++) { a += (b.q() - 0.5) * 0.9; a = clamp(a, 0.5, 2.6); x += Math.cos(a) * 9; y += Math.sin(a) * 9; pts.push([x, y]); }
      b.vine(pts, i % 2 ? '#3f6e34' : '#4a7a38', { leaf: 3.6, wd: 1.7, kind: 'round', every: 3.4, hang: 0.15, l: 0.05 - i * 0.02 });
    }
    for (const [x, y, n, len] of [[104, 44, 5, 17], [178, 98, 5, 15], [232, 56, 6, 19], [292, 102, 5, 16], [128, 132, 4, 13], [16, 30, 5, 18]]) for (let k = 0; k < n; k++) b.frond(x, y, len * (0.75 + b.q() * 0.4), -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.5, k % 2 ? '#4a8236' : '#57923c', { pin: 3.6, wd: 0.9, bend: 0.05, droop: 0.03, l: -0.05 });
    for (const [x, y] of [[126, 72], [208, 28], [300, 60]]) for (let k = 0; k < 4; k++) { const fx = x + (b.q() - 0.5) * 9, fy = y + (b.q() - 0.5) * 6; for (let p = 0; p < 5; p++) b.dab(fx + Math.cos(p * 1.26) * 0.9, fy + Math.sin(p * 1.26) * 0.9, p % 2 ? '#f4e8ee' : '#ecd0dc', 0.9, 0.8, 0.5, p * 1.26); b.dab(fx, fy, '#e8c24a', 1, 0.35, 0.35, 0); }
    // onder water: de wand loopt donker door
    b.wash(X0, SURF, X1, H, '#2c544c', '#153236');
    for (let i = 0; i < 9; i++) b.rock([[X0 + i * 42 + b.q() * 16, 176 + b.q() * 14], [X0 + i * 42 + 22, 168 + b.q() * 8], [X0 + i * 42 + 46, 180 + b.q() * 12], [X0 + i * 42 + 40, 214], [X0 + i * 42 + 4, 212]], '#2c4a46', { shade: 0.6 });
    // de wand wijkt: lager contrast en donkerder naar onder dan wat ervoor staat
    back.c.fillStyle = 'rgba(14,22,22,.26)'; back.c.fillRect(X0, 0, X1 - X0, SURF);
    { const gr = back.c.createLinearGradient(0, 60, 0, SURF); gr.addColorStop(0, 'rgba(8,12,12,0)'); gr.addColorStop(1, 'rgba(8,12,12,.42)'); back.c.fillStyle = gr; back.c.fillRect(X0, 60, X1 - X0, SURF - 60); }
    b.canvas(X0, 0, X1, H, 2600);

    // middenplan: gestapelde keien, oever met een heuvel erachter, kienhout; onder water keien, zand en kiezels
    b = createBrush(mid.c, 43);
    const R = ['#63615a', '#5a5852', '#6b685f', '#54524c'];
    const stone = (x, y, r, col, o) => b.rock([[x - r, y + r * 0.3], [x - r * 0.55, y - r * 0.62], [x + r * 0.6, y - r * 0.56], [x + r, y + r * 0.25], [x + r * 0.1, y + r * 0.62]], col, { cracks: 0, ...o });
    b.area([[172, SURF + 2, 1], ...HILL.slice(1, -1), [X1, 109, 1], [X1, SURF + 2, 1]], '#2c2318', { shade: 0.7, dab: 1.2 });
    for (let i = 0; i < 16; i++) { const x = 196 + b.q() * 150, y = hillY(x) + 6 + b.q() * 16; b.moss(x, y, 6 + b.q() * 7, 2.6 + b.q() * 2.4, MOSS[i % 5], { l0: -0.2, fringe: false }); }
    for (let x = 186; x < X1; x += 7 + b.q() * 6) b.moss(x, hillY(x) + b.q() * 2, 7 + b.q() * 6, 2.8 + b.q() * 2, MOSS[Math.floor(b.q() * 5)], { l0: -0.08 });
    for (let k = 0; k < 6; k++) b.frond(304, 115, 15 + b.q() * 8, -Math.PI / 2 + (k / 5 - 0.5) * 2.5, k % 2 ? '#467a34' : '#52883a', { pin: 4, wd: 1, bend: 0.045, droop: 0.03, l: -0.12 });
    b.tuft(238, 129, 9, 6, 2.3, '#3f7a40', { kind: 'round', spread: 2.8, l: -0.1 }); stone(262, 123, 5, '#5a5850');
    for (const [pts, col, o] of [
      [[[X0, 60, 1], [6, 51], [38, 49], [64, 56], [80, 70], [80, 94], [40, 100], [X0, 98, 1]], R[0]],
      [[[60, 72], [76, 66], [92, 73], [99, 90], [95, 106], [70, 106], [58, 92]], R[2]],
      [[[X0, 96, 1], [20, 92], [52, 97], [68, 110], [72, 138], [62, SURF + 2, 1], [X0, SURF + 2, 1]], R[1], { wet: 0.5 }],
      [[[58, 130], [92, 126], [138, 130], [152, 148], [150, SURF + 2, 1], [60, SURF + 2, 1]], R[3], { wet: 0.8 }],
      [[[56, 106], [76, 101], [100, 107], [132, 108], [147, 114], [152, 128], [138, 138], [90, 139], [60, 131]], R[0]],
      [[[58, 178], [98, 168], [138, 170], [155, 184], [152, 208], [112, 215], [70, 210]], '#38433e'],
    ]) b.rock(pts, col, o);
    // natte, donkere goot achter het water
    for (const pts of [[[78, 73], [84, 71.5], [91, 74], [93, 86], [91.5, 98], [95, 109], [84, 111], [76, 108], [79, 96], [77, 84]], [[108, 111], [118, 110], [130, 112], [132, 126], [131, 142], [134, SURF + 1], [120, SURF + 3], [105, SURF + 1], [108, 146], [107, 128]]]) {
      mid.c.fillStyle = 'rgba(8,14,16,.34)'; mid.c.beginPath(); smooth(mid.c, pts); mid.c.fill();
      mid.c.save(); mid.c.clip(); mid.c.lineCap = 'round';
      for (let i = 0; i < 60; i++) { const x = pts[0][0] - 4 + b.q() * 36, y = pts[0][1] + b.q() * 56; mid.c.strokeStyle = `rgba(190,214,214,${0.05 + b.q() * 0.12})`; mid.c.lineWidth = 0.3 + b.q() * 0.5; mid.c.beginPath(); mid.c.moveTo(x, y); mid.c.lineTo(x + (b.q() - 0.5), y + 3 + b.q() * 7); mid.c.stroke(); }
      mid.c.restore();
    }
    // bron van de bovenste val (Victor, 12/11/2026: "lijkt uit het nergens te ontspringen"): een donkere spleet tussen
    // de keien waar het water uit opwelt; de dekkei erboven staat in de voorgrondlaag, zodat de val eronder vandaan komt
    mid.c.fillStyle = '#0b1113'; mid.c.beginPath(); smooth(mid.c, [[72, 73.5], [77, 68], [86, 66.5], [94, 68.5], [97, 74], [92, 78.4], [77, 78.6]]); mid.c.fill();
    mid.c.strokeStyle = 'rgba(176,214,210,.4)'; mid.c.lineWidth = 0.4; mid.c.lineCap = 'round'; for (const [x, y, w] of [[80, 75.2, 4], [86, 74.4, 5], [84, 76.6, 6.5], [89, 76, 3]]) { mid.c.beginPath(); mid.c.moveTo(x - w / 2, y); mid.c.lineTo(x + w / 2, y); mid.c.stroke(); }
    mid.c.fillStyle = '#2a4442'; mid.c.beginPath(); mid.c.ellipse(106, 110.4, 23, 3.2, 0, 0, TAU); mid.c.fill();
    // bodem: zand dat naar de oever oploopt, kiezels, een paar stenen
    b.area([[X0, SAND[0][1], 1], ...SAND.slice(1, -1), [X1, 176, 1], [X1, H + 2, 1], [X0, H + 2, 1]], '#a8946a', { shade: 0.5, dab: 1.5, size: 0.6, lum: (u, v, x, y) => 0.25 - (y - sandY(x)) * 0.03 });
    for (let i = 0; i < 54; i++) { const x = X0 + b.q() * (X1 - X0), y = sandY(x) + 0.5 + b.q() * b.q() * 22; stone(x, y, 1 + b.q() * 2.6, ['#8a8273', '#b0a690', '#6a6458', '#7a6a58', '#9a9486'][i % 5]); }
    for (let i = 0; i < 900; i++) { const x = X0 + b.q() * (X1 - X0), y = sandY(x) + 1 + b.q() * 26, l = b.q(); b.dab(x, y, l < 0.4 ? '#6e6048' : l < 0.75 ? '#d2c39a' : '#8c8470', 0.6, 0.25 + b.q() * 0.45, 0.2 + b.q() * 0.25, b.q() * 3); }   // korrel
    mid.c.lineCap = 'round'; for (let i = 0; i < 26; i++) { const x = X0 + b.q() * (X1 - X0), y = sandY(x) + 5 + b.q() * 18, w = 7 + b.q() * 12, sl = (sandY(x + 10) - sandY(x)) / 10; for (const [o, col] of [[0, 'rgba(60,50,34,.26)'], [0.7, 'rgba(244,232,196,.2)']]) { mid.c.strokeStyle = col; mid.c.lineWidth = 0.45; mid.c.beginPath(); mid.c.moveTo(x, y + o); mid.c.quadraticCurveTo(x + w / 2, y + o - 1 + sl * w / 2, x + w, y + o + sl * w); mid.c.stroke(); } }   // ribbels in het zand
    stone(190, 199, 8, '#4a524b', { cracks: 1 }); stone(150, 203, 6, '#434c46');
    for (const [x, y, rx, ry] of [[84, 171.5, 9, 2.4], [124, 171, 10, 2.6], [144, 178, 6, 2.2], [108, 190, 7, 2]]) b.moss(x, y, rx, ry, '#3a6a40', { l0: -0.12, fringe: false });
    b.tuft(128, 172, 7, 11, 3.4, '#2f6240', { kind: 'round', spread: 2.3, l: -0.08 });
    for (const [x, r] of [[66, 3.4], [84, 2.2], [100, 4], [118, 2.6], [136, 3.2], [158, 2.4]]) stone(x, sandY(x) + 2 + b.q() * 4, r, ['#5a5e56', '#6f6a5c', '#4a504a'][Math.floor(b.q() * 3)]);
    for (const [x, y, rx, ry] of [[96, 170, 13, 3], [188, 192.5, 6, 2]]) b.moss(x, y, rx, ry, '#3f7040', { l0: -0.1, fringe: false });
    b.tuft(104, 170, 6, 10, 3.6, '#2f5e3c', { kind: 'round', spread: 2.2, l: -0.1 });
    // kienhout: poten in het water, stam, twee vorken, twijgen
    const WOOD = '#735338';
    b.branch([[258, WATER + 1], [251, 184], [244, sandY(244) + 2]], '#4a3828', 4.6, 2); b.branch([[278, WATER + 1], [288, 178], [295, sandY(295) + 2]], '#4a3828', 4, 1.6); b.branch([[268, WATER + 1], [270, 176], [266, sandY(266) + 2]], '#40301f', 3, 1.4);
    b.area([[152, SURF + 2, 1], ...BANK.slice(1, -1), [X1, 126, 1], [X1, SURF + 2, 1]], '#3a2b1d', { shade: 0.8, dab: 1.3 });
    b.branch([[226, 94], [238, 70], [262, 46], [294, 24], [324, 0]], WOOD, 7, 4.4);
    b.branch([[262, 46], [251, 31], [253, 17]], WOOD, 2.2, 0.8);
    b.branch([[272, 148], [264, 128], [248, 110], [226, 94]], WOOD, 10.5, 7.4);
    b.branch([[226, 94], [204, 76], [180, 62], [156, 54], [138, 52]], WOOD, 6.4, 1.8);
    b.branch([[204, 76], [198, 58], [200, 43]], WOOD, 2.2, 0.8);
    for (const [x, y, rx, ry] of [[188, 64.5, 7, 2.2], [162, 53.5, 6, 1.9], [250, 55, 6, 2.2], [284, 29, 7, 2.3], [256, 122, 4, 2]]) b.moss(x, y, rx, ry, '#6a9c38', { l0: 0.1 });
    // tillandsia aan de bovenste vork, klein varentje, orchidee
    for (let i = 0; i < 9; i++) { const x = 266 + b.q() * 10, y = 42 - (x - 266) * 0.9; b.stem([[x, y], [x + (b.q() - 0.5) * 3, y + 8 + b.q() * 6], [x + (b.q() - 0.5) * 5, y + 15 + b.q() * 12]], '#8fa08a', 0.55, 0.25); }
    for (let k = 0; k < 4; k++) b.frond(174, 60, 10 + b.q() * 4, -Math.PI / 2 + (k / 3 - 0.5) * 2.2, '#5a983e', { pin: 2.8, wd: 0.8, bend: 0.06, droop: 0.04 });
    b.stem([[150, 53], [144, 44], [137, 42]], '#5a7a3a', 0.5, 0.3); for (const [x, y] of [[143, 44], [139.5, 42.4], [136.5, 42.6]]) { for (let p = 0; p < 5; p++) b.dab(x + Math.cos(p * 1.26) * 1, y + Math.sin(p * 1.26) * 1, '#f6eef2', 0.95, 0.9, 0.55, p * 1.26); b.dab(x, y, '#d86a8a', 1, 0.4, 0.4, 0); }
    // bromelia in de vork: rozet van riembladeren, rood hart
    for (let i = 0; i < 13; i++) { const u = i / 12, a = -Math.PI / 2 + (u - 0.5) * 2.9, far = i % 2; b.leaf(227 + Math.cos(a) * 1.5, 90, (far ? 15 : 19) - Math.abs(u - 0.5) * 9, 2.5, a + (u - 0.5) * 0.25, far ? '#3f7a45' : '#52944e', { kind: 'strap', l: far ? -0.25 : 0.1 - Math.abs(u - 0.5) * 0.3 }); }
    for (let i = 0; i < 5; i++) b.leaf(227, 89, 8.5, 2.2, -Math.PI / 2 + (i - 2) * 0.42, i % 2 ? '#d8433c' : '#e2605a', { kind: 'strap', l: 0.05 });
    // oever: wortels en steentjes in de aarden wand, mos erover, klein groen, gevallen blad
    for (let i = 0; i < 12; i++) { const x = 172 + b.q() * 160, y = bankY(x) + 2; b.stem([[x, y], [x + (b.q() - 0.5) * 5, y + 4 + b.q() * 5], [x + (b.q() - 0.5) * 8, Math.min(SURF, y + 9 + b.q() * 12)]], '#5a4630', 0.6, 0.25); }
    for (let i = 0; i < 12; i++) { const x = 160 + b.q() * 176; stone(x, bankY(x) + 4 + b.q() * (SURF - bankY(x) - 4), 1 + b.q() * 2, '#6a665c'); }
    for (let x = 158; x < X1; x += 5 + b.q() * 5) { const big = b.q() < 0.3; b.moss(x, bankY(x) + (big ? 1 : 0.4) + b.q() * 2.4, (big ? 9 : 5.5) + b.q() * 4, (big ? 3.8 : 2.2) + b.q() * 1.4, MOSS[Math.floor(b.q() * 5)], { l0: 0.14 }); }
    for (const [x, r] of [[156, 2.6], [165, 2], [173, 1.6], [150, 2]]) stone(x, bankY(Math.max(153, x)) + 0.6, r, '#7a766c');
    for (const [x, a] of [[222, 0.2], [262, -0.3], [190, 0.5], [308, 0.1]]) b.leaf(x, bankY(x) - 1.6, 6.5, 2.2, a, '#8a6234', { l: -0.05 });
    b.tuft(198, bankY(198) - 1, 9, 5, 2, '#5c9a44', { kind: 'round', spread: 3, l: 0.1 });
    b.tuft(236, bankY(236) - 1, 10, 6.5, 2.6, '#4f8f4a', { kind: 'round', spread: 2.9, l: 0.05 });
    b.tuft(176, bankY(176) - 0.6, 4, 4.5, 1.4, '#6aa64a', { spread: 1.6, l: 0.15 });
    // fittonia: donker blad met roze nerven
    for (let i = 0; i < 12; i++) { const x = 282 + b.q() * 30, y = bankY(x) - 1 - b.q() * 5, a = -Math.PI / 2 + (b.q() - 0.5) * 2.4, len = 6 + b.q() * 2.5; b.leaf(x, y, len, 3.1, a, '#2f5c3c', { kind: 'round', l: (b.q() - 0.5) * 0.4, vein: false }); mid.c.save(); mid.c.translate(x, y); mid.c.rotate(a); mid.c.strokeStyle = 'rgba(236,150,170,.85)'; mid.c.lineWidth = 0.3; mid.c.beginPath(); mid.c.moveTo(0.4, 0); mid.c.lineTo(len * 0.92, 0); for (let k = 1; k < 4; k++) { const u = k / 4 * len; mid.c.moveTo(u, 0); mid.c.lineTo(u + len * 0.16, -1.5); mid.c.moveTo(u, 0); mid.c.lineTo(u + len * 0.16, 1.5); } mid.c.stroke(); mid.c.restore(); }
    for (let k = 0; k < 6; k++) b.frond(328, bankY(328), 16 + b.q() * 8, -Math.PI / 2 + (k / 5 - 0.5) * 2.4, k % 2 ? '#4f8a3a' : '#5c9a42', { pin: 4, wd: 1, bend: 0.045, droop: 0.03 });
    // paddenstoeltjes bij de voet van het hout
    for (const [x, y] of SHROOM) { mid.c.strokeStyle = '#d6d0bc'; mid.c.lineWidth = 0.55; mid.c.lineCap = 'round'; mid.c.beginPath(); mid.c.moveTo(x, y + 2.6); mid.c.lineTo(x + 0.2, y); mid.c.stroke(); mid.c.fillStyle = '#e4dcc0'; mid.c.beginPath(); mid.c.ellipse(x + 0.2, y, 1.7, 1.1, 0, Math.PI, TAU); mid.c.fill(); mid.c.fillStyle = 'rgba(120,100,70,.5)'; mid.c.fillRect(x - 1.4, y - 0.1, 3.2, 0.3); }
    // cryptocoryne op de bodem
    for (const [x, n, len, col] of [[214, 7, 15, '#3f6a3a'], [262, 8, 18, '#4a6a34'], [234, 5, 10, '#5a4a34'], [306, 6, 12, '#3f6a3a']]) b.tuft(x, sandY(x) + 1, n, len, 2.6, col, { spread: 2.2, l: -0.1 });
    // hangend groen langs de bovenrand, waar de ranken uit komen
    for (let x = 126; x < X1; x += 10 + b.q() * 8) b.tuft(x, -3, 6, 9 + b.q() * 5, 3.6, b.q() < 0.5 ? '#3f7236' : '#4a7e3a', { kind: 'heart', a0: Math.PI / 2, spread: 2.5, l: -0.15 });

    // voorgrond op dezelfde diepte: stenen en groen vóór het water, zodat de val in de rots zit en er niet op ligt
    b = createBrush(fore.c, 47);
    b.rock([[72, 110], [80, 105.5], [92, 107], [99, 111.5], [96, 117], [80, 118]], '#6a675f', { cracks: 0 });
    b.rock([[111.5, 141.5], [113.5, 137.6], [118, 136.4], [122, 138.6], [122.6, 143.6], [116.5, 145.6]], '#4a4a46', { cracks: 0, wet: 1 });
    b.rock([[131, 112], [140, 108.5], [150, 114], [155, 132], [153, 152], [156, SURF + 2, 1], [140, SURF + 2, 1], [135.5, 146], [136.5, 126]], '#716e65', { wet: 0.25 });
    b.moss(84, 106.5, 7, 2.4, '#6ea33a', { l0: 0.15 }); b.moss(136, 110, 7, 2.8, '#5f9434', { l0: 0.1 });
    b.rock([[68.5, 71.5], [72, 64], [80, 60.6], [90, 61.4], [97.5, 65.5], [100, 72], [93, 73.6], [77, 73.4]], '#69665e', { cracks: 0, wet: 0.3 });
    b.moss(82, 61.6, 9, 2.6, '#6ea33a', { l0: 0.16 }); b.moss(95, 66.4, 4.6, 2, '#5f9434', { l0: 0.1 });
    b.moss(73, 73.4, 5.4, 2.4, '#6ea33a', { l0: 0.12 }); b.moss(96, 75.6, 4.4, 2.2, '#5f9434', { l0: 0.1 });
    b.tuft(96, 77, 7, 8, 1.8, '#5a9a40', { spread: 2.2, a0: -1.1, l: 0.1 });
    b.tuft(102, 113, 6, 6, 1.5, '#4f8f3a', { spread: 2, a0: -1.9, l: 0 }); b.tuft(137, 111, 6, 7, 1.6, '#5a9a40', { spread: 2, a0: -1.2, l: 0.1 });
    for (const [x, y, rx, ry] of [[14, 53, 14, 4.6], [44, 51, 15, 4.4], [70, 60, 9, 3.6], [22, 94, 12, 3.4], [50, 99, 8, 2.8], [66, 103.5, 7, 2.4], [146, 114.5, 5, 2.4]]) b.moss(x, y, rx, ry, MOSS[Math.floor(b.q() * 4)], { l0: 0.14 });
    b.tuft(36, 95, 6, 7, 1.6, '#4f8f3a', { spread: 2.2, l: 0 });
    b.vine([[20, 54], [24, 64], [20, 76], [26, 88]], '#4a7e3a', { leaf: 3.8, wd: 1.8, kind: 'round', every: 3.2, hang: 0.3 }); b.vine([[52, 53], [56, 66], [52, 80]], '#56883a', { leaf: 3.6, wd: 1.7, kind: 'round', every: 3.2, hang: 0.3 });
    b.vine([[10, 96], [14, 108], [10, 118]], '#4a7e3a', { leaf: 3.4, wd: 1.6, kind: 'round', every: 3.2, hang: 0.3 });
    for (const [x, y, n, len] of [[62, 58, 4, 12], [6, 94, 4, 11]]) for (let k = 0; k < n; k++) b.frond(x, y, len * (0.8 + b.q() * 0.4), -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.3, '#52903a', { pin: 3.2, wd: 0.9, bend: 0.05, droop: 0.035 });
    b.rock([[X0, 128, 1], [8, 121], [34, 122.5], [54, 133], [63, 150], [71, 168], [85, 185], [80, 204], [50, 212], [X0, 210, 1]], '#636058', { wet: 0.5 });
    for (const [x, y, rx, ry] of [[6, 122, 12, 3.8], [32, 123.5, 12, 3.6], [53, 135, 6, 3]]) b.moss(x, y, rx, ry, MOSS[Math.floor(b.q() * 4)], { l0: 0.16 });
    for (const [x, y, r] of [[95, 161.5, 4.4], [141, 162, 3.4], [100, 164, 2.4], [68, 163, 3]]) stoneF(b, x, y, r);
    b.tuft(60, 122, 7, 9, 2, '#4f8f3a', { spread: 2.4, l: 0 });
    // de grote kei onder water: mos in de plooien, een anubias aan de voet, kiezels ertegen
    for (const [x, y, rx, ry] of [[30, 172, 12, 3.2], [62, 188, 8, 2.6], [20, 196, 10, 2.8], [72, 200, 6, 2.2]]) b.moss(x, y, rx, ry, '#3f7040', { l0: -0.1, fringe: false });
    b.tuft(44, 207, 7, 12, 4, '#2f6a3c', { kind: 'round', spread: 2.4, l: -0.05 });
    for (const [x, y, r] of [[14, 211.5, 3.6], [30, 213, 2.4], [62, 212.5, 3], [78, 209, 2.2], [90, 207.5, 3.2]]) stoneF(b, x, y, r);

    // omlijsting dichtbij: groot donker blad in de hoeken (boven land, onder water)
    b = createBrush(near.c, 53);
    for (const [x, y, len, wd, a, col] of [[-8, -6, 40, 15, 0.62, '#1f4028'], [-10, 6, 34, 13, 1.12, '#254a2c'], [6, -10, 30, 12, 0.22, '#1b3a26'], [X1 - 2, -8, 34, 13, 2.5, '#1f4028'], [X1, 10, 28, 11, 2.05, '#254a2c']]) { b.stem([[x, y], [x + Math.cos(a) * 4, y + Math.sin(a) * 4]], '#2a4a2c', 1.6, 1.2); b.leaf(x + Math.cos(a) * 3, y + Math.sin(a) * 3, len, wd, a, col, { kind: 'heart', l: -0.25 }); }
    for (const [x, y, len, wd, a, col] of [[-6, H + 4, 36, 9, -1.05, '#2f6248'], [-10, H - 6, 28, 8, -0.55, '#386e50'], [4, H + 6, 26, 7, -1.5, '#2a5842'], [X1 - 4, H + 4, 34, 6, -2.0, '#2f6248'], [X1, H - 2, 30, 5.4, -2.5, '#386e50'], [X1 - 12, H + 6, 28, 5, -1.65, '#2a5842']]) b.leaf(x, y, len, wd, a, col, { kind: 'lance', l: 0.05 });
    for (const [x0, dir] of [[2, 1], [X1 - 6, -1]]) for (let i = 0; i < 8; i++) b.leaf(x0 + dir * i * 2.6, H + 4, 14 + b.q() * 16, 0.9 + b.q() * 0.5, -Math.PI / 2 + dir * (0.1 + b.q() * 0.6), i % 2 ? '#3f7a52' : '#4a8a58', { vein: false, l: 0 });

    // sprites: varenbladen op de rots, ranken van boven, geel blad, kikker
    const fernS = ferns.map((f, i) => { const s = layer(140, 96, scale, 70, 74); createBrush(s.c, 60 + i).frond(0, 0, f.len, f.a0, ['#4f9038', '#5aa040', '#468432'][i % 3], { pin: 9.5, wd: 1.7, bend: 0.03, droop: 0.02, l: i % 2 ? 0.08 : -0.06 }); return s; });
    const vineS = vines.map((v, i) => { const s = layer(60, v.len + 16, scale, 30, 4), vb = createBrush(s.c, 80 + i); const pts = []; for (let y = 0; y <= v.len; y += 6) pts.push([Math.sin(y * 0.07 + i * 2) * 3.4, y]); vb.vine(pts, i % 2 ? '#4f8a3e' : '#5a9644', { leaf: 8.5, wd: 3.8, kind: 'heart', every: 6.5, hang: 0.75, stem: 0.8, l: 0.08 }); return s; });
    const yel = layer(18, 18, scale, 3, 3); createBrush(yel.c, 90).leaf(0, 0, 11, 4.4, Math.PI / 2 - 0.2, '#d9b43c', { kind: 'heart', l: 0.1 });
    yel.c.fillStyle = 'rgba(120,80,30,.55)'; [[1.5, 5], [-0.5, 7.5], [1, 9]].forEach(([x, y]) => { yel.c.beginPath(); yel.c.arc(x, y, 0.7, 0, TAU); yel.c.fill(); });
    built = { back, mid, fore, near, fernS, vineS, yel, frogSit: frogSprite(scale * 1.25, 'sit'), frogLeap: frogSprite(scale * 1.25, 'leap') };
  }

  /* ---- leven ---- */
  function seed() {
    const q = rng(7);
    frog = { p: 0, x: PERCH[0][0], y: PERCH[0][1], face: -1, hop: null, air: 0, tilt: 0, blink: 2, next: 50 + q() * 60, squash: 0 };
    snail = { u: 0.3, dir: 1 };
    springs = Array.from({ length: 7 }, () => ({ x: 176 + q() * 140, hop: null }));
    fish = Array.from({ length: 7 }, (_, i) => ({ x: 180 + q() * 90, y: 176 + q() * 14, dir: q() < 0.5 ? -1 : 1, side: 1, vy: 0, sp: 7 + q() * 3, ph: q() * TAU, k: i * 3.7, flee: 0, s: 0.92 + q() * 0.22 }));
    fish.forEach(f => { f.side = f.dir; });
    flies = Array.from({ length: 7 }, () => ({ x: 60 + q() * 220, y: 30 + q() * 100, a: q() * TAU, ph: q() * 9, per: 3.2 + q() * 2.6 }));
    spray = []; haze = []; glints = []; rings = []; bubbles = []; flakes = []; fallen = [];
  }
  function mist(x, y, burst = 1) {
    for (let i = 0; i < 34 * burst; i++) { const a = Math.random() * TAU, v = 14 + Math.random() * 44; spray.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8 - 8, life: 0.7 + Math.random() * 0.6, r: 0.3 + Math.random() * 0.5 }); }
    for (let i = 0; i < (burst < 1 ? 1 : 3); i++) haze.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 20, r: 16 + Math.random() * 14, at: t, life: 2.6 + Math.random() * 1.6, vx: (Math.random() - 0.5) * 3 });
    for (let i = 0; i < 12 * burst; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 42; glints.push({ x: x + Math.cos(a) * d, y: Math.min(SURF - 2, y + Math.sin(a) * d * 0.8), at: t + Math.random() * 0.8, life: 2.5 + Math.random() * 2.5 }); }
    dew.mist(x, y, 34, Math.round(14 * burst), burst < 1 ? 0.05 : 0.14);
    for (const fe of ferns) fe.v += (Math.random() - 0.5) * 0.4;
    springs.forEach(s => { s.lively = t + 4; });
    if (Math.random() < 0.2 * burst) hopFrog();
    damp = Math.min(1, damp + 0.22 * burst);
    mistAt = Date.now(); save();
    if (t - sprayAt > 0.22) { sprayAt = t; playTerra('mist', { x: x / W * 2 - 1 }); }
  }
  function hopFrog(away) {
    if (frog.hop) return;
    let to = (frog.p + 1 + Math.floor(Math.random() * (PERCH.length - 1))) % PERCH.length;
    if (away) { const far = PERCH.map((p, i) => [Math.hypot(p[0] - away.x, p[1] - away.y), i]).filter(([, i]) => i !== frog.p).sort((a, b) => b[0] - a[0]); to = far[Math.random() < 0.7 ? 0 : 1][1]; }
    const [x, y] = PERCH[to], d = Math.hypot(x - frog.x, y - frog.y);
    frog.hop = { x0: frog.x, y0: frog.y, x1: x, y1: y, at: t + 0.14, dur: 0.42 + d / 380, h: 14 + d * 0.2, to, user: Boolean(away) };
    frog.face = x >= frog.x ? 1 : -1; frog.squash = 1;                                           // eerst door de knieën
  }
  function feed(x) {
    const fx = clamp(x, 160, 316);
    for (let i = 0; i < 8; i++) flakes.push({ x: fx + (Math.random() - 0.5) * 22, y: Math.min(120, SURF - 30) - Math.random() * 14, vy: 0, k: Math.random() * 9, st: 0, at: t, col: ['#c8793a', '#a85a2c', '#d8a04a'][i % 3], fy: SURF + 1 + Math.random() * 3.2 });
    playTerra('plop', { x: fx / W * 2 - 1 });
  }
  const vineTip = (i, u = 0.84) => { const v = vines[i], a = v.a + 0.04 * Math.sin(t * 0.5 + v.k); return { x: v.x - Math.sin(a) * v.len * u, y: v.y + Math.cos(a) * v.len * u, a }; };
  function cut(p) {
    for (const yl of yellows) { const tp = vineTip(yl.vine); if (Math.hypot(p.x - tp.x, p.y - tp.y - 5) < 13) { yellows = yellows.filter(o => o !== yl); fallen.push({ x: tp.x, y: tp.y + 4, vy: 0, a: tp.a, k: Math.random() * 9, fy: SURF + 1 + Math.random() * 3 }); nextYellowAt = Date.now() + (240 + Math.random() * 240) * 1000; save(true); playTerra('snip', { x: p.x / W * 2 - 1 }); return true; } }
    return false;
  }

  function step(dt) {
    t += dt;
    const m = moist();
    if (t - dayAt > 20) { dayAt = t; day = daylight(now()); if (userLamp !== null && userLamp === clockLamp()) userLamp = null; }   // de klok haalt je keuze in: weer vanzelf
    if (dirty && Date.now() - savedAt > 15000) save();
    const live = t - hover.at < 2.5;
    const tx = live ? clamp(hover.x / W - 0.5, -0.5, 0.5) * 2 : 0.35 * Math.sin(t * 0.05), ty = live ? clamp(hover.y / H - 0.5, -0.5, 0.5) * 2 : 0.2 * Math.sin(t * 0.037);
    const k = 1 - Math.exp(-dt * 2.2); px += (tx - px) * k; py += (ty - py) * k;
    lampLv += ((lampOn() ? 1 : 0) - lampLv) * (1 - Math.exp(-dt * 2.2));
    dayLv += (day.light - dayLv) * (1 - Math.exp(-dt * 1.5));
    dew.step(dt, t, m);
    fallA.step(dt, t); fallB.step(dt, t);
    // nevelen zolang de vernevelaar ingedrukt blijft
    if (ptr && ptr.tool === 'mist' && ptr.held && t - ptr.sprayed > 0.16) { ptr.sprayed = t; mist(ptr.x, ptr.y, 0.45); }
    for (const s of spray) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 26 * dt; s.vx *= 1 - dt * 2.4; s.vy *= 1 - dt * 1.2; s.life -= dt; }
    spray = spray.filter(s => s.life > 0); haze = haze.filter(h => t - h.at < h.life); damp *= Math.exp(-dt / 30);
    glints = glints.filter(s => t - s.at < s.life); rings = rings.filter(r => t - r.at < 1.8);
    // planten: veer terug, de aanwijzer duwt
    const push = (o, x, y, r) => { if (ptr && Math.hypot(ptr.x - x, ptr.y - y) < r) o.v += ptr.dx * 0.02; else if (live && Math.hypot(hover.x - x, hover.y - y) < r) o.v += (hover.dx || 0) * 0.008; };
    for (const fe of ferns) { push(fe, fe.x + Math.cos(fe.a0) * fe.len * 0.6, fe.y + Math.sin(fe.a0) * fe.len * 0.6, 24); fe.v += (-fe.a * 8 - fe.v * 2.2) * dt; fe.a += fe.v * dt; }
    for (const v of vines) { push(v, v.x, v.y + v.len * 0.7, 18); v.v += (-v.a * 6 - v.v * 1.8) * dt; v.a += v.v * dt; }
    if (ptr) { ptr.dx = 0; ptr.dy = 0; } hover.dx = 0;
    // kikker: knipperen, door de knieën, sprong in een boog, landen
    frog.blink -= dt; if (frog.blink < -0.12) frog.blink = 2.5 + Math.random() * 5;
    if (frog.hop) {
      const u = (t - frog.hop.at) / frog.hop.dur;
      if (u < 0) frog.squash = 1 + u / 0.14 * 0.2;
      else if (u >= 1) { frog.x = frog.hop.x1; frog.y = frog.hop.y1; frog.p = frog.hop.to; if (frog.hop.user) dirty = true; frog.hop = null; frog.air = 0; frog.squash = 1; }
      else { const h = frog.hop, vy = (h.y1 - h.y0) - Math.cos(u * Math.PI) * Math.PI * h.h; frog.x = h.x0 + (h.x1 - h.x0) * u; frog.y = h.y0 + (h.y1 - h.y0) * u - Math.sin(u * Math.PI) * h.h; frog.air = 1; frog.squash = 0; frog.tilt = Math.atan2(vy, Math.abs(h.x1 - h.x0) + 1) * 0.8; }
    } else { frog.squash = Math.max(0, frog.squash - dt * 4); if ((frog.next -= dt) < 0) { frog.next = 45 + Math.random() * 75; hopFrog(); } }
    snail.u += snail.dir * dt * 0.005; if (snail.u > 1 || snail.u < 0) { snail.dir *= -1; snail.u = clamp(snail.u, 0, 1); }
    for (const s of springs) {
      if (s.hop) { if (t - s.hop.at > 0.3) { s.x = s.hop.x1; s.hop = null; } }
      else if (Math.random() < dt * (t < (s.lively || 0) ? 0.6 : 0.04)) s.hop = { x0: s.x, x1: clamp(s.x + (Math.random() - 0.5) * 14, 170, 322), at: t };
    }
    // vlokken: vallen, drijven, zinken traag
    for (const f of flakes) {
      if (f.st === 0) { f.vy = Math.min(f.vy + dt * 60, 46); f.y += f.vy * dt; f.x += Math.sin(t * 5 + f.k) * dt * 5; if (f.y >= f.fy) { f.y = f.fy; f.st = 1; f.at = t; rings.push({ x: f.x, y: f.fy, at: t, s: 0.35 }); } }
      else if (f.st === 1) { f.x += Math.sin(t * 0.7 + f.k) * dt * 0.8; if (t - f.at > 5 + f.k) { f.st = 2; f.y = WATER + 0.6; } }
      else { f.y += dt * 2.2; f.x += Math.sin(t * 1.3 + f.k) * dt * 1.6; if (f.y > sandY(f.x)) f.gone = true; }
    }
    flakes = flakes.filter(f => !f.gone);
    // visjes: zwemmen heen en weer als school, draaien door smal te worden, komen naar het voer, schieten weg
    let cx = 0, cy = 0; for (const f of fish) { cx += f.x; cy += f.y; } cx /= fish.length; cy /= fish.length;
    for (const f of fish) {
      const food = flakes.length ? flakes.filter(o => o.st > 0).sort((a, b2) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b2.x - f.x, b2.y - f.y))[0] : null;
      f.flee *= Math.exp(-dt * 1.8);
      let wantY = cy + Math.sin(t * 0.3 + f.k) * 9, sp = f.sp + f.flee * 60;
      if (food) { const fy = Math.max(food.y, WATER + 3), d = Math.hypot(food.x - f.x, fy - f.y); if (Math.abs(food.x - f.x) > 2) f.dir = food.x > f.x ? 1 : -1; wantY = fy; sp = d < 3 ? 2 : 17; if (d < 3 && Math.random() < dt * 2.2) { food.gone = true; rings.push({ x: food.x, y: Math.min(food.y, WATER - 0.6), at: t, s: 0.3 }); } }
      else {
        if (f.x < 164) f.dir = 1; else if (f.x > 316) f.dir = -1;
        else if (Math.random() < dt * 0.05) f.dir *= -1;
        else if (Math.abs(f.x - cx) > 34 && Math.random() < dt * 0.8) f.dir = cx > f.x ? 1 : -1;
      }
      f.side += (f.dir - f.side) * (1 - Math.exp(-dt * (4 + f.flee * 8)));
      const floor = sandY(f.x) - 5;
      f.vy += ((clamp(wantY, 173, floor) - f.y) * 0.9 - f.vy * 1.6) * dt;
      f.x = clamp(f.x + f.side * sp * dt, 158, 322); f.y = clamp(f.y + f.vy * dt, 170, floor + 2); f.ph += dt * (5 + sp * 0.9);
    }
    // belletjes onder de val: mee de diepte in, dan wiebelend omhoog
    if (bubbles.length < 34 && Math.random() < dt * 30) bubbles.push({ x: 108 + Math.random() * 24, y: WATER + 1, vy: 14 + Math.random() * 22, r: 0.35 + Math.random() * 0.9, k: Math.random() * 9 });
    for (const bb of bubbles) { bb.vy -= (26 + bb.r * 18) * dt; bb.y += bb.vy * dt; bb.x += Math.sin(t * 6 + bb.k) * dt * 4; if (bb.y < WATER + 0.5 && bb.vy < 0) bb.dead = true; }
    bubbles = bubbles.filter(bb => !bb.dead);
    // vuurvliegjes: lichten af en toe op, stijgen dan even
    for (const fl of flies) { fl.a += (Math.random() - 0.5) * dt * 3; const on = Math.max(0, Math.sin((t + fl.ph) / fl.per * TAU)) ** 1.6; fl.on = on; fl.x += Math.cos(fl.a) * dt * 6; fl.y += Math.sin(fl.a) * dt * 4 - on * dt * 5; if (fl.x < 20 || fl.x > W - 20 || fl.y < 22 || fl.y > 150) fl.a += Math.PI * dt * 2; fl.y = clamp(fl.y, 14, 154); }
    // snoeien: af en toe wordt een blad aan een rank geel
    if (Date.now() > nextYellowAt && yellows.length < 3) { const free = vines.map((_, i) => i).filter(i => !yellows.some(y => y.vine === i)); yellows.push({ vine: free[Math.floor(Math.random() * free.length)] }); nextYellowAt = Math.max(nextYellowAt, Date.now() - 600e3) + (240 + Math.random() * 360) * 1000; dirty = true; }
    else if (yellows.length >= 3 && Date.now() > nextYellowAt) nextYellowAt = Date.now() + 300e3;
    for (const f of fallen) {
      if (!f.float) { f.vy = Math.min(f.vy + dt * 30, 20); f.x += Math.sin(t * 3 + f.k) * dt * 14; f.y += f.vy * dt; f.a = Math.sin(t * 3 + f.k) * 0.8; if (f.y >= f.fy) { f.y = f.fy; f.float = true; rings.push({ x: f.x, y: f.fy, at: t, s: 0.6 }); playTerra('plop', { x: f.x / W * 2 - 1 }); } }
      else { f.x += dt * 2.5; f.a += (1.5 - f.a) * dt; f.fade = (f.fade || 0) + dt / 50; if (f.x > W + 12 || f.fade >= 1) f.gone = true; }
    }
    fallen = fallen.filter(f => !f.gone);
  }

  /* ---- licht ---- */
  function lighting() {
    const L = lampLv, D = dayLv;
    // schemer (gouden uur): het omgevingslicht zakt en koelt, de lamp kleurt amber, zo verschilt de schemer van de middag.
    // Avond: geen bruine waas over alles maar een lamp als bron, warm waar ze schijnt, koel en donker in de hoeken.
    const G = day.warm * D, amb = lerp3([0.26, 0.33, 0.48], lerp3([0.23, 0.25, 0.34], lerp3([0.76, 0.8, 0.78], [0.46, 0.45, 0.54], G), D), L);
    light.begin(amb);
    if (L > 0.01) {
      const key = lerp3(lerp3([1, 0.78, 0.5], [0.6, 0.54, 0.4], D), [0.86, 0.56, 0.26], G);
      light.spot(lerp(150, 140, D) - px * 6, lerp(-4, -34, D), lerp(205, 330, D), key, L, 300);
      light.spot(124, 150, 70, lerp3([0.34, 0.2, 0.08], [0.1, 0.1, 0.08], D), L, 30);        // de val vangt licht
      if (D > 0.02) light.dapple(0, 0, W, SURF, t * 1.1 + px * 4, Math.sin(t * 0.21) * 5, 0.3 * D * L, 190);
    }
    if (L < 0.99) {
      const N = 1 - L;
      light.spot(262, -30, 260, [0.3, 0.4, 0.56], N, 210);                                       // maan
      for (const [x, y] of SHROOM) light.spot(x - px * 5, y - 1, 9, [0.12, 0.36, 0.3], N * 0.7, 7);
    }
    const fa = clamp(1.15 - D * 1.6, 0, 1) * (0.45 + 0.55 * (1 - L));
    if (fa > 0.01) for (const fl of flies) if (fl.on > 0.02) light.spot(fl.x, fl.y, 34, [0.9, 0.88, 0.4], fa * fl.on);
    if (L > 0.01) light.dapple(0, 186, W, H, t * 2.2, Math.sin(t * 0.4) * 3, 0.24 * L * (0.5 + 0.5 * D), 150, 52);                 // lichtspel op de bodem
    if (!frog.hop) light.shadow(frog.x - px * 5, frog.y - py * 1.6 + 0.4, 10, 2.2, 0.5);                                       // de kikker staat op zijn steen, niet erop geplakt
    light.shade(0, WATER, W, H, 'rgba(0,14,18,0)', 'rgba(0,14,18,.3)');
    return fa;
  }
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---- tekenen ---- */
  function draw() {
    const { back, mid, fore, near, fernS, vineS, yel } = built, m = moist(), L = lampLv, D = dayLv;
    g.setTransform(scale, 0, 0, scale, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const mx = -PAD - px * 5, my = -py * 1.6;
    g.drawImage(back.cv, -PAD - px * 2, -py * 0.7, W + PAD * 2, H);
    g.drawImage(mid.cv, mx, my, W + PAD * 2, H);
    g.save(); g.translate(mx + PAD, my);
    // wateroppervlak: de strook tussen de overkant en het glas
    { const gr = g.createLinearGradient(0, SURF, 0, WATER); gr.addColorStop(0, 'rgba(58,104,98,.9)'); gr.addColorStop(1, 'rgba(86,140,132,.92)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-PAD, WATER); for (let x = -PAD; x <= W + PAD; x += 8) g.lineTo(x, SURF + Math.sin(x * 0.13) * 0.5 + (x < 150 ? 0.4 : 0)); g.lineTo(W + PAD, WATER); g.closePath(); g.fill(); }
    // de oever en het hout spiegelen in de strook, in elkaar gedrukt (je kijkt er bijna vlak over)
    g.save(); g.beginPath(); g.rect(-PAD, SURF + 0.4, W + PAD * 2, WATER - SURF - 0.4); g.clip(); g.globalAlpha = 0.3; g.transform(1, 0, 0, -0.32, 0, SURF * 1.32); g.drawImage(mid.cv, -PAD, 0, W + PAD * 2, H); g.restore();
    g.lineWidth = 0.4;
    for (let i = 0; i < 5; i++) { const u = (t * 0.42 + i / 5) % 1; g.strokeStyle = `rgba(232,248,244,${0.5 * (1 - u)})`; g.beginPath(); g.ellipse(119, 162.6, 12 + u * 62, 0.9 + u * 2.4, 0, 0, TAU); g.stroke(); }
    for (const r of rings) { const u = (t - r.at) / 1.8, s = r.s || 1; g.strokeStyle = `rgba(232,248,244,${0.55 * (1 - u)})`; g.beginPath(); g.ellipse(r.x, r.y, (2 + u * 30) * s, (0.4 + u * 2.2) * s + 0.3, 0, 0, TAU); g.stroke(); }
    // kom op de richel: rimpels van de bovenste val
    g.save(); g.beginPath(); g.ellipse(106, 110.4, 23, 3.2, 0, 0, TAU); g.clip();
    g.fillStyle = 'rgba(140,186,182,.22)'; g.fillRect(80, 106, 54, 9);
    g.strokeStyle = 'rgba(236,250,248,.5)'; g.lineWidth = 0.45; for (let i = 0; i < 4; i++) { const u = (t * 0.55 + i / 4) % 1; g.globalAlpha = 1 - u; g.beginPath(); g.ellipse(85, 109.6, 3 + u * 34, 0.7 + u * 3, 0, 0, TAU); g.stroke(); } g.globalAlpha = 1;
    g.restore();
    fallA.draw(g, t); fallB.draw(g, t);
    g.restore();
    g.drawImage(fore.cv, mx, my, W + PAD * 2, H);
    g.save(); g.translate(mx + PAD, my);
    // varens op de rots: wiegen, hangen wat als het glas droog is
    ferns.forEach((fe, i) => { const droop = (1 - m) * 0.2 * (fe.a0 < -Math.PI / 2 ? -1 : 1); g.save(); g.translate(fe.x, fe.y); g.rotate(fe.a + droop + 0.028 * Math.sin(t * 0.7 + fe.k) + 0.012 * Math.sin(t * 1.9 + fe.k * 2)); g.drawImage(fernS[i].cv, -70, -74, 140, 96); g.restore(); });
    drawSnail(g, ...(() => { const u = snail.u * (SNAIL.length - 1), i = Math.min(SNAIL.length - 2, Math.floor(u)), f = u - i, [x0, y0] = SNAIL[i], [x1, y1] = SNAIL[i + 1]; return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f - 0.2, snail.dir, t * 0.35, Math.atan2(y1 - y0, x1 - x0)]; })());
    g.fillStyle = '#ece6d2'; for (const s of springs) { let x = s.x, y = bankY(s.x) - 2.4; if (s.hop) { const u = (t - s.hop.at) / 0.3; x = s.hop.x0 + (s.hop.x1 - s.hop.x0) * u; y = bankY(x) - 2.4 - Math.sin(u * Math.PI) * 4; } g.fillRect(x - 0.5, y - 0.4, 1, 0.8); }
    drawFrog(g, built.frogSit, built.frogLeap, frog, t);
    for (const f of flakes) if (f.st < 2) { g.fillStyle = f.col; g.fillRect(f.x - 0.7, f.y - 0.3, 1.4, 0.6); }
    for (const f of fallen) { g.save(); g.globalAlpha = 1 - (f.fade || 0); g.translate(f.x, f.y); g.rotate(f.a); g.scale(1, f.float ? 0.4 : 1); g.drawImage(yel.cv, -3, -3, 18, 18); g.restore(); }
    // onder water: kleur van het water, planten, belletjes, vissen
    { const gr = g.createLinearGradient(0, WATER, 0, H); gr.addColorStop(0, 'rgba(70,150,134,.16)'); gr.addColorStop(1, 'rgba(14,62,66,.32)'); g.fillStyle = gr; g.fillRect(-PAD, WATER, W + PAD * 2, H - WATER + 4); }
    for (const w of weeds) {
      const P = []; for (let y = w.base; y >= w.top; y -= 3) { const u = (w.base - y) / (w.base - w.top); P.push([w.x + Math.sin(t * 0.6 + y * 0.09 + w.k) * 3.4 * u + Math.sin(t * 0.23 + w.k) * 2 * u * u, y, w.w * (1 - u * 0.75)]); }
      g.fillStyle = '#3a7a3c'; g.beginPath(); P.forEach(([x, y, wd], i) => (i ? g.lineTo(x - wd, y) : g.moveTo(x - wd, y))); for (let i = P.length - 1; i >= 0; i--) g.lineTo(P[i][0] + P[i][2], P[i][1]); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(140,200,110,.55)'; g.lineWidth = 0.45; g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
    for (const f of flakes) if (f.st === 2) { g.fillStyle = f.col; g.fillRect(f.x - 0.6, f.y - 0.3, 1.2, 0.6); }
    g.lineWidth = 0.3; for (const bb of bubbles) { g.strokeStyle = 'rgba(226,246,244,.7)'; g.fillStyle = 'rgba(226,246,244,.16)'; g.beginPath(); g.arc(bb.x, bb.y, bb.r, 0, TAU); g.fill(); g.stroke(); }
    for (const f of fish) drawTetra(g, f.x, f.y, f.side, clamp(f.vy * 0.03, -0.4, 0.4), f.ph, 0.5 + 0.5 * Math.sin(t * 1.7 + f.k), f.s * 1.05);
    // waterlijn tegen het glas: lichte rand, deint, onrustiger bij de val
    { const gr = g.createLinearGradient(0, WATER, 0, WATER + 5); gr.addColorStop(0, 'rgba(206,240,232,.32)'); gr.addColorStop(1, 'rgba(206,240,232,0)'); g.fillStyle = gr; g.fillRect(-PAD, WATER, W + PAD * 2, 5); }
    // meniscus: een lichte rand die deint, eronder de donkere onderkant van het oppervlak, en het water kruipt op in de hoeken
    const wl = x => WATER + Math.sin(x * 0.21 - t * 2.1) * (0.28 + Math.exp(-(((x - 119) / 46) ** 2)) * 0.5) + Math.sin(x * 0.07 + t * 0.8) * 0.3 - 2.2 * (Math.exp(-(x + 1) / 5) + Math.exp(-(W + 1 - x) / 5));
    for (const [o, col, lw] of [[1.1, 'rgba(6,34,36,.34)', 1.3], [0, 'rgba(236,250,246,.78)', 0.7], [-0.8, 'rgba(236,250,246,.22)', 0.4]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let x = -PAD; x <= W + PAD; x += 2) { const y = wl(x) + o; x === -PAD ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
    g.restore();
    // omlijsting en ranken dichtbij
    g.save(); g.translate(-px * 7.5, -py * 2.4);
    vines.forEach((v, i) => { g.save(); g.translate(v.x, v.y); g.rotate(v.a + 0.04 * Math.sin(t * 0.5 + v.k)); g.drawImage(vineS[i].cv, -30, -4, 60, v.len + 16); g.restore(); });
    for (const yl of yellows) { const tp = vineTip(yl.vine); g.save(); g.translate(tp.x, tp.y); g.rotate(tp.a + 0.1 * Math.sin(t * 0.8 + yl.vine)); g.drawImage(yel.cv, -3, -3, 18, 18); g.restore(); }
    g.restore();
    g.drawImage(near.cv, -PAD - px * 9, -py * 3, W + PAD * 2, H);
    // licht over het geschilderde beeld
    const fa = lighting();
    light.apply(g);
    g.globalCompositeOperation = 'lighter';
    if (L > 0.01) {
      const gr = g.createRadialGradient(140, -40, 0, 140, -40, 210); gr.addColorStop(0, `rgba(255,${lerp(196, 232, D) | 0},${lerp(120, 190, D) | 0},${lerp(0.18, 0.26, D) * L})`); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 150);
      // glinstering op het water en lichtspel op de bodem
      g.strokeStyle = `rgba(255,${lerp(214, 244, D) | 0},${lerp(160, 226, D) | 0},${0.34 * L})`; g.lineWidth = 0.45; g.lineCap = 'round';
      for (let i = 0; i < 12; i++) { const x = 20 + ((i * 53 + t * (1.5 + i % 3)) % 290), y = SURF + 1 + (i * 1.37 % 3.6), wl = (2 + (i % 4) * 2.2) * (0.6 + 0.4 * Math.sin(t * 1.4 + i)); g.beginPath(); g.moveTo(x - wl, y); g.lineTo(x + wl, y); g.stroke(); }
    }
    if (L < 0.99) for (const [x, y] of SHROOM) { const sx = x + mx + PAD + 0.2, sy = y + my - 0.3, gr = g.createRadialGradient(sx, sy, 0, sx, sy, 2.6); gr.addColorStop(0, `rgba(150,255,210,${0.3 * (1 - L)})`); gr.addColorStop(1, 'rgba(120,255,200,0)'); g.fillStyle = gr; g.fillRect(sx - 2.6, sy - 2.6, 5.2, 5.2); }
    if (fa > 0.01) for (const fl of flies) { if (fl.on < 0.02) continue; const a = fa * fl.on, gr = g.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, 10); gr.addColorStop(0, `rgba(240,255,150,${a})`); gr.addColorStop(0.16, `rgba(225,250,120,${0.6 * a})`); gr.addColorStop(1, 'rgba(200,240,110,0)'); g.fillStyle = gr; g.fillRect(fl.x - 10, fl.y - 10, 20, 20); g.fillStyle = `rgba(250,255,200,${a})`; g.beginPath(); g.arc(fl.x, fl.y, 0.8, 0, TAU); g.fill(); }
    // glinstering op nat blad na het nevelen
    for (const s of glints) { const u = (t - s.at) / s.life; if (u < 0) continue; const a = Math.sin(Math.min(1, u * 5) * Math.PI / 2) * (1 - u) * (0.5 + 0.5 * Math.sin(t * 5 + s.x)); g.fillStyle = `rgba(255,250,235,${0.7 * a})`; g.beginPath(); g.arc(s.x, s.y, 0.55, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    // nevel van de vernevelaar: wolkjes waar je spuit, en de lucht boven het water blijft een halve minuut vochtig
    if (damp > 0.01) { const a = damp * (0.05 + 0.1 * (L * (0.45 + 0.55 * D))), gr = g.createLinearGradient(0, 0, 0, SURF); gr.addColorStop(0, `rgba(232,240,236,${a})`); gr.addColorStop(0.6, `rgba(232,240,236,${a * 0.8})`); gr.addColorStop(1, 'rgba(232,240,236,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, SURF); }
    for (const h of haze) { const u = (t - h.at) / h.life, x = h.x + h.vx * (t - h.at), y = h.y + u * 5, r = h.r * (1 + u * 0.8), a = (0.05 + 0.08 * (L * (0.45 + 0.55 * D))) * Math.sin(Math.min(1, u * 4) * Math.PI / 2) * (1 - u), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(232,240,236,${a})`); gr.addColorStop(1, 'rgba(232,240,236,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.fillStyle = `rgba(244,250,248,${0.25 + 0.35 * L})`; for (const s of spray) { g.globalAlpha = Math.min(1, s.life * 2.5); g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill(); } g.globalAlpha = 1;
    dew.draw(g, L * (0.45 + 0.55 * D) + (1 - L) * 0.12);
    // de spons zolang je veegt
    if (ptr && ptr.tool === 'sponge' && ptr.wipe) { g.save(); g.translate(ptr.x, ptr.y); g.rotate(-0.12); g.fillStyle = '#e9c95c'; g.beginPath(); g.roundRect(-9, -6, 18, 12, 3); g.fill(); g.fillStyle = 'rgba(150,110,30,.35)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-6.5 + (i * 4.7 % 13), -3.5 + (i * 3.1 % 7), 0.55 + (i % 3) * 0.25, 0, TAU); g.fill(); } g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-8, -5.4, 16, 1.4); g.restore(); }
  }

  return {
    own: true,
    onDark: true,
    tools: TERRA_TOOLS,
    get tool() { return tool; },
    get lit() { return lampOn(); },
    pick(id) { if (id === 'lamp') { const want = !lampOn(); userLamp = want === clockLamp() ? null : want; save(true); playTerra('lamp', { x: 0 }); } else tool = id; onTool(); },
    get busy() { return false; },
    init() { seed(); mistAt = Date.now(); restore(); },
    reload() { restore(); onTool(); },
    rezoom(z) { zoom = z; },
    mount(el) {
      if (cv) return;
      scale = Math.min(2, window.devicePixelRatio || 1) * zoom;
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
      cv.style.width = `${W * zoom}px`; cv.style.height = `${H * zoom}px`;
      el.append(cv);
      g = cv.getContext('2d');
      day = daylight(now()); dayAt = t; dayLv = day.light; lampLv = lampOn() ? 1 : 0;
      build(); light = createLight(W, H);
      // het glas: zoals het was (andere maat), zoals het bewaard was, of voor het eerst al wat beslagen
      dew = createDew(W, H, scale, { floor: WATER - 1, prev: dew, onDrip: (x, r) => rings.push({ x, y: WATER - 0.9, at: t, s: 0.12 + r * 0.06 }) });
      glassFrom();
      lastNow = 0;
      if (!started) { started = true; dew.prime(moist()); const pre = reducedMotion.matches ? 300 : 160; for (let i = 0; i < pre; i++) step(1 / 30); }
      document.addEventListener('visibilitychange', flush);
      if (reducedMotion.matches) draw();
    },
    // het glas blijft bestaan (dew), zodat een nieuwe maat of opnieuw openen verdergaat waar het was
    unmount() { if (cv && dirty) save(true); document.removeEventListener('visibilitychange', flush); cv?.remove(); cv = null; g = null; built = null; light = null; ptr = null; },
    frame(n) {
      if (!cv || reducedMotion.matches) return;
      const dt = lastNow ? clamp((n - lastNow) / 1000, 0, 0.05) : 1 / 60;   // nooit negatief: na een nieuwe maat kan een beeld een ouder tijdstip hebben
      lastNow = n;
      step(dt);
      draw();
    },
    move(p) { hover = { x: p.x, y: p.y, at: t, dx: (hover.dx || 0) + (t - hover.at < 1 ? p.x - hover.x : 0) }; if (ptr) { ptr.dx += p.x - ptr.x; ptr.dy += p.y - ptr.y; ptr.x = p.x; ptr.y = p.y; } },
    down(p) { ptr = { x: p.x, y: p.y, dx: 0, dy: 0, wipe: null, tool, held: false, sprayed: t, at: t }; if (tool === 'mist' && p.y < WATER) { ptr.held = true; ptr.sprayed = t; mist(p.x, p.y); ptr.did = true; } },
    drag(p) {
      if (!ptr || !dew) return;
      if (ptr.tool === 'sponge') { if (ptr.wipe) dew.wipe(ptr.wipe.x, ptr.wipe.y, p.x, p.y); ptr.wipe = { x: p.x, y: p.y }; }
      if (!frog.hop && Math.hypot(p.x - frog.x, p.y - frog.y + 5) < 18) hopFrog(p);
    },
    up() { if (ptr?.wipe) save(); ptr = null; dew?.lift(); },
    tap(p) {
      if (!frog.hop && Math.hypot(p.x - frog.x, p.y - frog.y + 5) < 15) { hopFrog(p); playTerra('hop', { x: p.x / W * 2 - 1 }); return; }
      if (tool === 'cut') { cut(p); return; }
      if (tool === 'feed') { feed(p.x); return; }
      if (tool === 'sponge') { dew.wipe(p.x - 3, p.y, p.x + 3, p.y); save(); return; }
      if (p.y > WATER + 2) { rings.push({ x: p.x, y: WATER - 1.6, at: t }); fish.forEach(f => { if (Math.hypot(f.x - p.x, f.y - p.y) < 70) { f.flee = 1; f.dir = f.x > p.x ? 1 : -1; } }); playTerra('plop', { x: p.x / W * 2 - 1 }); }
    },
    leave() { ptr = null; hover.at = -99; },
    recolor() {},
  };
}
