/* ---- Japanse tuin in het bakje van de focusmodus ---- */
// Tweede natuurvenster (Victor, 12/11/2026), zelfde handschrift als het paludarium: S1 Penseel (src/focus/brush.js),
// over het hele bakje, recht vooruit, volle natuurkleur. Herschilderd op 12/11/2026 (Victor: "gezelliger, realistischer,
// het gevoel dat ik in een hoekje natuur zit dat ik op vakantie zou kunnen tegenkomen"): de tuin van een herberg.
// - beeld: een esdoorn die van linksboven in beeld hangt (blad per blad), heuvels en ceders in nevel, een bamboeschutting
//   met gesnoeide struiken, een den met kussens, rechts de hoek van een theehuis met pannendak, veranda en shoji,
//   mos met een vijver, oeverstenen, een sneeuwkijklantaarn aan het water, een waterbekken met bamboegoot, stapstenen,
//   geharkt grind met een steen, irissen, waterlelieblad.
// - seizoenen volgens de datum, alle vier even belangrijk: lente (fris blad, kersenbloesem, azalea's), zomer (diep
//   groen, irissen, libel, 's nachts vuurvliegjes), herfst (rode esdoorn, gele ginkgo, drijvend blad), winter (sneeuw).
// - licht (src/focus/light.js): zon op en onder volgens de dag van het jaar, bladschaduw onder de esdoorn; in het
//   donker schijnt de lantaarn op het mos en in de vijver en gloeien de shoji van het theehuis warm over de tuin.
//   Het weer volgt de echte stand (currentSky): wolken, regen met kringen, sneeuw, mist, een verre flits.
// - gereedschap (links van het bakje): voeren (tik in de vijver, de koi komen), wind (slepen = een vlaag, in de
//   esdoorn = schudden), harken (slepen over het grind trekt voren), lantaarns aan of uit. Tik op het vogeltje: weg.
// - stand: de lantaarns en de voren in het grind gaan naar scores.game('garden') (mee in sync, export, import), en de
//   scène blijft bestaan als het bakje van maat verandert (rezoom).
// Geluid enkel bij acties. Geen blur, geen lichtstralen. Minder beweging: één beeld.

import { createBrush, layer, mix, rng, smooth, clamp, tone } from './brush.js';
import { createLight, daylight } from './light.js';
import { createFall } from './falls.js';
import { drawKoi, drawBird } from './fauna.js';
import { playTerra } from '../scene/sound.js';
import { currentSky } from './weather.js';

const W = 325.6, H = 226.8, TAU = Math.PI * 2, PAD = 10, X0 = -PAD - 2, X1 = W + PAD + 2;
const POND = [[104, 169], [128, 158.5], [168, 154.5], [214, 153.5], [258, 156], [292, 163], [304, 174], [286, 186], [240, 193], [186, 194], [136, 190], [108, 181]];
const inPond = (x, y, m = 1) => ((x - 204) / (98 * m)) ** 2 + ((y - 173.5) / (19.5 * m)) ** 2 < 1;
const GRAVEL = [[170, 208, 1], [212, 201.5], [268, 199.5], [X1, 197.5, 1], [X1, H + 4, 1], [160, H + 4, 1]];
const gravelY = x => (x < 212 ? 208 - (x - 170) / 42 * 6.5 : 201.5 - (x - 212) / 130 * 4);
const LX = 116, ROOF = [116, 128.4], SHOJI = [[209, 99, 51, 21], [266, 99, 51, 21]];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const GARDEN_TOOLS = [{ id: 'feed' }, { id: 'wind' }, { id: 'rake' }, { id: 'lantern', toggle: true }];

function season(d) { const m = d.getMonth(); return m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3; }
// esdoornblad: zeven puntige lobben vanuit de steel
function mapleLeaf(c, x, y, r, a, col) {
  const L = [[-2.3, 0.46], [-1.42, 0.78], [-0.66, 0.95], [0, 1], [0.66, 0.95], [1.42, 0.78], [2.3, 0.46]];
  c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(0, 0);
  L.forEach(([an, len], i) => { if (i) { const m = (an + L[i - 1][0]) / 2; c.lineTo(Math.cos(m) * r * 0.34, Math.sin(m) * r * 0.34); } c.lineTo(Math.cos(an) * r * len, Math.sin(an) * r * len); });
  c.closePath(); c.fill(); c.restore();
}

export function createGarden({ reducedMotion, store, zoom = 1, now = () => new Date(), sky: skyOf = null, onTool = () => {} }) {
  let cv = null, g = null, scale = 1, built = null, light = null, started = false, sz = season(now()), sky = null, skyAt = -99, seenAt = 0;
  let t = 0, lastNow = 0, px = 0, py = 0, hover = { x: W / 2, y: H / 2, at: -99 }, ptr = null;
  let tool = 'feed', wind = 0, maple = { a: 0, v: 0 }, userLamp = null, lampLv = 0, day = daylight(now()), rustleAt = -9;
  let koi = [], food = [], ripples = [], falls = [], rain = [], flakes = [], flies = [], bird = null, nextBird = 40, butterfly = null, nextFly = 20, dragon = null, flash = 0;
  let strokes = [];                                                                               // voren die je zelf trok: [x0, y0, x1, y1]
  const spout = createFall({ x0: 183.2, x1: 184.4, y0: 137.4, x2: 183.8, x3: 185, y1: 141.4, time: 0.2, seed: 11, strands: 3, veils: 1, foam: false });

  /* ---- stand ---- */
  const autoLamp = () => day.light < 0.4;
  const lampOn = () => userLamp ?? autoLamp();
  function save() { const n = Date.now(); seenAt = n; store?.save?.({ run: { lamp: userLamp, rake: strokes.flat().map(v => Math.round(v)) }, at: n }); }
  function restore() {
    const v = store?.load?.(), r = v?.run;
    if (!r || !(v.at > seenAt)) return;
    seenAt = v.at;
    userLamp = typeof r.lamp === 'boolean' ? r.lamp : null;
    if (Array.isArray(r.rake)) { strokes = []; for (let i = 0; i + 3 < r.rake.length && strokes.length < 160; i += 4) strokes.push(r.rake.slice(i, i + 4).map(Number)); if (built) rakeAll(); }
  }

  /* ---- schilderen: één keer per seizoen en maat ---- */
  function groove(c, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l * 0.5;
    c.lineCap = 'round';
    c.strokeStyle = built.gravelCol; c.lineWidth = 12; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    for (let k = -2; k <= 2; k++) for (const [oy, col, lw] of [[0, built.snow ? 'rgba(120,140,160,.5)' : 'rgba(96,88,74,.5)', 0.7], [0.55, 'rgba(255,255,255,.5)', 0.45]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x0 + nx * k * 2.3, y0 + ny * k * 2.3 + oy); c.lineTo(x1 + nx * k * 2.3, y1 + ny * k * 2.3 + oy); c.stroke(); }
  }
  // het grind zoals de tuinman het achterliet, daarover je eigen voren; de steen blijft vrij
  function rakeAll() {
    const c = built.rake.c;
    c.clearRect(X0, 190, X1 - X0, H);
    c.strokeStyle = built.snow ? 'rgba(120,140,160,.4)' : 'rgba(96,88,74,.4)'; c.lineWidth = 0.6;
    for (let y = 203; y < H + 6; y += 2.5) { c.beginPath(); for (let x = 158; x <= X1; x += 6) { const yy = y - (x - 158) * 0.035 + Math.sin(x * 0.03 + y * 0.1) * 0.7; x === 158 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); }
    for (const s of strokes) groove(c, ...s);
    clearRock();
  }
  function clearRock() { const c = built.rake.c; c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.ellipse(272, 213.5, 19, 7.5, 0, 0, TAU); c.fill(); c.restore(); }
  function build() {
    const snow = sz === 3, full = () => layer(W + PAD * 2, H, scale, PAD, 0);
    const far = full(), midL = full(), near = full(), rake = full(), frame = full();
    const mossCol = snow ? '#e3e9ed' : ['#6a9a42', '#4f8a38', '#5f8a3c'][sz], hedge = snow ? '#4a6a52' : ['#4f8a44', '#3a7438', '#55803e'][sz], lit = snow ? '#ffffff' : '#c8d24a';
    const mapleCols = [['#a8d468', '#c6e486', '#8cc458'], ['#3f8a3a', '#57a044', '#2f7434'], ['#c8322a', '#e8662c', '#e0902e', '#a82424'], null][sz];
    const haze = '#dfe6e2', white = '#eef2f5';
    const cap = (b, x, y, rx, ry) => b.area([[x - rx, y + ry * 0.3], [x - rx * 0.6, y - ry * 0.6], [x, y - ry], [x + rx * 0.6, y - ry * 0.6], [x + rx, y + ry * 0.3], [x, y + ry * 0.05]], white, { shade: 0.22, warm: 0 });
    const stone = (b, x, y, rx, ry, col = '#8d8a82', o = {}) => { b.rock([[x - rx, y + ry * 0.35], [x - rx * 0.6, y - ry * 0.8], [x + rx * 0.5, y - ry * 0.9], [x + rx, y + ry * 0.2], [x + rx * 0.3, y + ry]], col, { cracks: 0, ...o }); if (snow) cap(b, x, y - ry * 0.55, rx * 0.8, ry * 0.5); };

    // ver: heuvels in nevel, een rij ceders, in de lente kersenbloesem, in de herfst een ginkgo
    let b = createBrush(far.c, 71);
    b.area([[X0, 92, 1], [50, 72], [110, 84], [170, 64], [240, 80], [X1, 66, 1], [X1, 150, 1], [X0, 150, 1]], mix('#7f9fa8', haze, snow ? 0.62 : 0.5), { shade: 0.2, dab: 0.6 });
    b.area([[X0, 104, 1], [60, 90], [140, 100], [220, 88], [X1, 98, 1], [X1, 150, 1], [X0, 150, 1]], mix('#5f8a80', haze, snow ? 0.5 : 0.32), { shade: 0.25, dab: 0.7 });
    for (let i = 0; i < 20; i++) {
      // bomen achter de schutting: kruinen in lagen, hoe verder hoe neveliger
      const x = X0 + i * 18 + b.q() * 14, h = 26 + b.q() * 26, wd = 7 + b.q() * 5, col = mix(snow ? '#5a7468' : sz === 2 && b.q() < 0.3 ? '#8a7a3a' : '#2f5a44', haze, 0.3 + b.q() * 0.22), tall = b.q() < 0.6;
      for (let k = 0; k < (tall ? 4 : 2); k++) { const u = k / (tall ? 4 : 2); b.moss(x + (b.q() - 0.5) * 3, 130 - h * (tall ? u : u * 0.5) - 4, wd * (1 - u * (tall ? 0.6 : 0.2)), h * (tall ? 0.2 : 0.3), col, { fringe: false, depth: 0.55, lit: snow ? '#ffffff' : '#c8d6b0' }); }
    }
    if (sz === 0) for (const [x, y, rx, ry] of [[56, 104, 22, 12], [78, 110, 14, 8], [150, 108, 16, 9]]) b.moss(x, y, rx, ry, '#eeb6c8', { fringe: false, lit: '#fff0f4' });
    if (sz === 2) for (const [x, y, rx, ry] of [[92, 100, 16, 13], [100, 110, 12, 8]]) b.moss(x, y, rx, ry, '#e2b23a', { fringe: false, lit: '#ffe9a0' });

    // midden: bamboeschutting, theehuis, gesnoeide struiken, den
    b = createBrush(midL.c, 73);
    const c = midL.c;
    for (let x = X0 + 4; x < 204; x += 13) b.stem([[x, 105 + b.q()], [x + (b.q() - 0.5), 131]], '#a8925c', 1.7, 1.7);
    for (const y of [108.5, 116, 123.5]) b.stem([[X0, y], [100, y + 0.4], [204, y]], '#b09a62', 1.35, 1.35);
    c.fillStyle = 'rgba(40,30,20,.7)'; for (let x = X0 + 4; x < 204; x += 13) for (const y of [108.5, 116, 123.5]) c.fillRect(x - 0.9, y - 0.5, 1.8, 1);
    if (snow) { c.fillStyle = white; c.fillRect(X0, 104.2, 220, 0.9); }
    // theehuis: pannendak, balken, shoji, veranda
    b.area([[188, 95.5, 1], [198, 87], [216, 75], [X1, 67, 1], [X1, 93.5, 1]], '#454b55', { shade: 0.5, dab: 1.3, dir: -0.1 });
    c.strokeStyle = 'rgba(16,18,24,.34)'; c.lineWidth = 0.5; for (let x = 196; x < X1; x += 4.4) { const top = x < 216 ? 87 - (x - 198) / 18 * 12 : 75 - (x - 216) / 122 * 8; c.beginPath(); c.moveTo(x, 94.6); c.lineTo(x + 1.6, Math.max(67, top) + 0.6); c.stroke(); }
    c.strokeStyle = '#25272c'; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(188, 95.4); c.lineTo(X1, 93.6); c.stroke();
    c.fillStyle = 'rgba(150,156,166,.6)'; for (let x = 191; x < X1; x += 4.4) { c.beginPath(); c.arc(x, 95.3 - (x - 188) * 0.012, 0.75, 0, TAU); c.fill(); }
    if (snow) b.area([[195, 89, 1], [216, 75.4], [X1, 67.4, 1], [X1, 85, 1], [206, 91]], white, { shade: 0.22, warm: 0 });
    c.fillStyle = '#241d18'; c.fillRect(200, 96.4, X1 - 200, 3.2);
    c.fillStyle = '#b7a888'; c.fillRect(204, 99, X1 - 204, 25);                                                              // muur achter de schermen
    for (const [x, y, w, h] of SHOJI) {
      c.fillStyle = '#f1e8d0'; c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(86,66,46,.75)'; c.lineWidth = 0.42; c.beginPath();
      for (let i = 0; i <= 8; i++) { c.moveTo(x + w * i / 8, y); c.lineTo(x + w * i / 8, y + h); } for (let j = 0; j <= 3; j++) { c.moveTo(x, y + h * j / 3); c.lineTo(x + w, y + h * j / 3); }
      c.stroke();
      c.fillStyle = '#6e5238'; c.fillRect(x, y + h, w, 4);
    }
    c.fillStyle = '#3a2b20'; for (const x of [206, 263, 320]) c.fillRect(x - 1.6, 96, 3.2, 28.5);
    c.fillStyle = 'rgba(255,230,190,.2)'; for (const x of [206, 263, 320]) c.fillRect(x - 1.6, 96, 0.7, 28.5);
    c.fillStyle = '#806044'; c.fillRect(199, 124, X1 - 199, 3.4); c.fillStyle = 'rgba(255,236,200,.3)'; c.fillRect(199, 124, X1 - 199, 0.7);
    c.fillStyle = '#1f1914'; c.fillRect(201, 127.4, X1 - 201, 4.6); c.fillStyle = '#4a382a'; for (const x of [212, 248, 284, 320]) c.fillRect(x - 1, 127.4, 2, 4.6);
    if (snow) { c.fillStyle = white; c.fillRect(199, 123.4, X1 - 199, 0.9); }
    // gesnoeide struiken voor de schutting, in de lente azalea's in bloei
    for (const [x, y, rx, ry] of [[26, 126, 24, 10], [74, 128, 18, 8], [112, 127, 14, 7], [-2, 130, 14, 7], [196, 129, 10, 5.5]]) {
      b.moss(x, y, rx, ry, hedge, { dense: 1.25, fringe: false, lit: sz === 2 ? '#d8b24a' : '#b8d05a' });
      if (sz === 0) for (let i = 0; i < rx * 2.2; i++) { const a = b.q() * TAU, d = Math.sqrt(b.q()) * 0.85; b.dab(x + Math.cos(a) * d * rx, y + Math.sin(a) * d * ry - ry * 0.15, b.q() < 0.6 ? '#ec7fa0' : '#f6b4c8', 0.9, 0.8, 0.6, a); }
      if (snow) cap(b, x, y - ry * 0.55, rx * 0.82, ry * 0.5);
    }
    // den: schuine stam, takken met kussens van naalden
    b.branch([[172, 132], [168, 112], [160, 96], [164, 78], [158, 62]], '#5e4636', 6, 2.6);
    for (const pts of [[[166, 104], [146, 98], [132, 100]], [[162, 88], [184, 80], [196, 82]], [[162, 72], [142, 66]]]) b.branch(pts, '#5e4636', 2.4, 1.1);
    for (const [x, y, rx, ry] of [[132, 97.5, 14, 5], [196, 80, 13, 4.6], [140, 64, 13, 5], [160, 55.5, 15, 5.6], [177, 66, 10, 4], [150, 83, 9, 3.6]]) { b.moss(x, y, rx, ry, snow ? '#3a6250' : '#2f6240', { dense: 1.3, lit: '#9ac07a' }); if (snow) cap(b, x, y - ry * 0.5, rx * 0.85, ry * 0.55); }

    // dichtbij: mos met glooiing, vijver, oeverstenen, lantaarn, bekken met goot, stapstenen, grind
    b = createBrush(near.c, 77);
    const nc = near.c;
    b.area([[X0, 130, 1], [60, 128], [140, 131], [220, 132.5], [X1, 131, 1], [X1, H + 4, 1], [X0, H + 4, 1]], mossCol, { shade: 0.55, dab: 1.3, size: 0.8, max: 5200, warm: snow ? 0 : 0.07, lum: (u, v, x, y) => (b.nz(x * 0.03, y * 0.06, 3) - 0.5) * 1.3 + 0.12 - v * 0.3 });
    for (let i = 0, n = 0; i < 500 && n < 38; i++) { const x = X0 + b.q() * (X1 - X0), y = 136 + b.q() * 88; if (inPond(x, y, 1.18) || (x > 160 && y > gravelY(x) - 5)) continue; n++; const k = 0.45 + (y - 136) / 88 * 1.1; b.moss(x, y, (9 + b.q() * 12) * k, (2.4 + b.q() * 2.4) * k, mix(mossCol, snow ? '#c8d2da' : '#3f6a2c', 0.05 + b.q() * 0.15), { fringe: false, lit, l0: 0.12, dense: 0.9, depth: 0.4 }); }
    b.area(GRAVEL, snow ? '#eaeef1' : '#d6d0c0', { shade: 0.3, dab: 1.6, size: 0.5, warm: 0.04 });
    for (let x = 174; x < X1; x += 5 + b.q() * 5) b.moss(x, gravelY(x) + 0.4, 5 + b.q() * 4, 1.5 + b.q(), mix(mossCol, '#3f6a2c', snow ? 0 : 0.2), { fringe: !snow, lit });
    nc.fillStyle = '#2f5458'; nc.beginPath(); smooth(nc, POND); nc.fill();
    nc.save(); nc.clip(); for (let i = 0; i < 120; i++) { const x = 100 + b.q() * 210, y = 152 + b.q() * 44; b.dab(x, y, b.q() < 0.5 ? '#26464a' : '#3f666a', 0.4, 3 + b.q() * 6, 0.8 + b.q() * 1.4, 0); } nc.restore();
    nc.strokeStyle = 'rgba(30,24,18,.5)'; nc.lineWidth = 1.2; nc.beginPath(); smooth(nc, POND); nc.stroke();
    for (const [x, y, rx, ry] of [[101, 172, 9, 6], [140, 156.5, 7, 4.2], [214, 151.6, 6, 3.4], [270, 155, 7, 4], [301, 169, 9, 6], [264, 192.5, 11, 5], [150, 193, 9, 4.4], [206, 196, 7, 3.4]]) stone(b, x, y, rx, ry, ['#8d8a82', '#7e7b74', '#99958b'][Math.floor(b.q() * 3)]);
    for (const [x, y] of [[126, 163], [240, 155], [288, 181], [170, 195], [112, 187]]) b.tuft(x, y, 6, 6 + b.q() * 4, 0.9, snow ? '#9aa890' : '#5c9440', { spread: 1.6, vein: false });
    // irissen aan de rechteroever
    b.tuft(297, 163.5, 10, 17, 1.4, snow ? '#7f8f78' : '#4f8f4c', { kind: 'strap', spread: 1.25, vein: false, l: 0.05 });
    if (sz < 2) for (const [x, y] of [[293, 148.5], [299, 146.5], [304, 150]]) { for (const [dx, dy, a] of [[-1.6, 0.9, 0.5], [1.6, 0.9, -0.5], [0, -1.2, Math.PI / 2]]) b.dab(x + dx, y + dy, '#7a5cc8', 0.95, 1.9, 0.9, a); b.dab(x, y + 0.3, '#f0d24a', 1, 0.45, 0.45, 0); }
    // sneeuwkijklantaarn op een oeversteen
    stone(b, LX, 159.5, 11, 4, '#7e7b74');
    const ST = '#9d998e';
    for (const sgn of [-1, 1]) b.rock([[LX + sgn * 9.5, 158, 1], [LX + sgn * 8.4, 152], [LX + sgn * 5.2, 148.6, 1], [LX + sgn * 3.6, 149.4, 1], [LX + sgn * 6.4, 153], [LX + sgn * 7, 158, 1]], ST, { cracks: 0 });
    b.rock([[LX - 1, 158, 1], [LX - 1.2, 149, 1], [LX + 1.2, 149, 1], [LX + 1, 158, 1]], tone(ST, -0.3), { cracks: 0 });
    b.rock([[LX - 9.4, 149.2, 1], [LX + 9.4, 149.2, 1], [LX + 8.6, 146.6, 1], [LX - 8.6, 146.6, 1]], ST, { cracks: 0 });
    b.rock([[LX - 6.2, 146.8, 1], [LX + 6.2, 146.8, 1], [LX + 6.2, 138.6, 1], [LX - 6.2, 138.6, 1]], ST, { cracks: 0 });
    nc.fillStyle = '#2c2a28'; nc.fillRect(LX - 3.6, 140.2, 7.2, 5.2); nc.fillStyle = ST; nc.fillRect(LX - 0.35, 140.2, 0.7, 5.2);
    b.rock([[LX - 18, 139.6, 1], [LX - 11, 134.6], [LX, 131.4], [LX + 11, 134.6], [LX + 18, 139.6, 1], [LX, 138.2]], tone(ST, -0.12), { cracks: 0 });
    b.rock([[LX - 2.4, 132], [LX, 128.4], [LX + 2.4, 132]], ST, { cracks: 0 });
    if (snow) { cap(b, LX, 133.4, 15, 3); cap(b, LX, 128.9, 2.2, 1); }
    // waterbekken met bamboegoot
    stone(b, 186, 145, 9, 4.6, '#7a7770');
    nc.fillStyle = '#24383a'; nc.beginPath(); nc.ellipse(186, 142, 5, 1.5, 0, 0, TAU); nc.fill();
    b.stem([[175, 131], [175, 147]], '#a8925c', 1.8, 1.8); b.stem([[172.5, 135.4], [184.6, 137.2]], '#b8a268', 1.5, 1.4);
    // stapstenen
    for (const [x, y, rx, ry] of [[22, 215, 16, 5], [57, 205.5, 13.5, 4.4], [93, 212.5, 13, 4.2], [129, 205.5, 12, 3.8]]) b.rock([[x - rx, y], [x - rx * 0.6, y - ry], [x + rx * 0.6, y - ry], [x + rx, y], [x + rx * 0.5, y + ry], [x - rx * 0.6, y + ry]], snow ? '#d4dadf' : '#a6a297', { cracks: 0, shade: 0.7 });
    // de steen in het grind, met een rand van mos
    stone(b, 272, 212, 14, 8, '#7b7871', { cracks: 1 });
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI + Math.PI * 0.03; b.moss(272 + Math.cos(a) * 15, 216.4 + Math.sin(a) * 3.4, 3.6, 1.4, mix(mossCol, '#3f6a2c', snow ? 0 : 0.2), { lit, fringe: !snow }); }
    b.canvas(X0, 128, X1, H, 1800);
    // de voren in het grind: een eigen laag, zodat de hark erin kan
    rake.c.beginPath(); rake.c.moveTo(170, 208); rake.c.quadraticCurveTo(190, 203, 212, 201.5); rake.c.lineTo(268, 199.5); rake.c.lineTo(X1, 197.5); rake.c.lineTo(X1, H + 4); rake.c.lineTo(160, H + 4); rake.c.closePath(); rake.c.clip();

    // omlijsting dichtbij: donker blad linksonder
    b = createBrush(frame.c, 83);
    for (const [x, y, len, wd, a, col] of [[-8, H + 2, 34, 12, -0.9, '#1f3f2a'], [-12, H - 12, 28, 10, -0.35, '#24482e'], [4, H + 6, 28, 10, -1.4, '#1b3826'], [26, H + 8, 22, 8, -1.2, '#21422b']]) b.leaf(x, y, len, wd, a, snow ? mix(col, '#5a6a66', 0.4) : col, { kind: 'round', l: -0.2 });
    for (let i = 0; i < 9; i++) b.leaf(40 + i * 3, H + 4, 16 + b.q() * 12, 0.9, -1.2 - b.q() * 0.9, '#2a4e30', { vein: false, l: -0.2 });

    // esdoorn: sprite die van linksboven inhangt en wiegt rond zijn aanhechting
    const tree = layer(196, 104, scale, 14, 14), tb = createBrush(tree.c, 79), limbs = [];
    limbs.push(tb.branch([[-12, 4], [26, 16], [66, 26], [108, 30], [150, 26], [174, 30]], '#3e2e26', 7.4, 1.5));
    for (const [pts, w] of [[[[60, 25], [84, 42], [102, 58]], 3], [[[26, 16], [42, 0], [52, -8]], 3], [[[108, 30], [132, 46], [142, 58]], 2.4], [[[150, 26], [164, 12]], 1.8], [[[84, 42], [72, 56]], 1.4]]) limbs.push(tb.branch(pts, '#3e2e26', w, 0.9));
    if (mapleCols) {
      const leaves = [];
      for (const S of limbs) for (let i = 2; i < S.length; i += 2) for (let k = 0; k < 4; k++) leaves.push([S[i][0] + (tb.q() - 0.5) * 26, S[i][1] + (tb.q() - 0.32) * 20, tb.q()]);
      leaves.sort((p, r) => p[2] - r[2]);
      for (const [x, y, z] of leaves) mapleLeaf(tree.c, x, y, 3.3 + tb.q() * 1.9, Math.PI / 2 + (tb.q() - 0.5) * 1.5, tone(mapleCols[Math.floor(tb.q() * mapleCols.length)], (z - 0.62) * 1.1 + (tb.nz(x * 0.05, y * 0.05, 2) - 0.5) * 0.5));
    } else for (const S of limbs) { tree.c.strokeStyle = white; tree.c.lineWidth = 1.3; tree.c.lineCap = 'round'; tree.c.beginPath(); S.forEach(([x, y], i) => (i ? tree.c.lineTo(x, y - 1.6) : tree.c.moveTo(x, y - 1.6))); tree.c.stroke(); }
    const clouds = [0, 1, 2].map(i => { const l = layer(110, 36, scale, 0, 0), q = rng(100 + i); for (let k = 0; k < 46; k++) { const u = q(), x = 12 + u * 86, y = 20 - Math.sin(u * Math.PI) * 9 * q() + q() * 6, r = 5 + q() * 9 * Math.sin(u * Math.PI); const gr = l.c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); l.c.fillStyle = gr; l.c.fillRect(x - r, y - r, r * 2, r * 2); } return l; });
    built = { far, midL, near, rake, frame, tree, clouds, mapleCols, snow, gravelCol: snow ? '#eaeef1' : '#d6d0c0', cloudX: built?.cloudX || [10, 130, 240] };
    rakeAll();
  }

  /* ---- leven ---- */
  function seed() {
    const q = rng(9);
    koi = [['#e8742c', [[0.25, 0, 0.5, '#f4efe4'], [0.6, 0.2, 0.4, '#f4efe4']]], ['#f4efe4', [[0.12, 0, 0.42, '#e04a26'], [0.5, -0.2, 0.5, '#e04a26'], [0.78, 0.1, 0.3, '#1c1c20']]], ['#e8b84a', []], ['#f4efe4', [[0.35, 0.1, 0.6, '#1c1c20'], [0.7, -0.1, 0.35, '#e8742c']]]]
      .map(([col, marks], i) => ({ x: 150 + i * 34, y: 168 + q() * 12, a: q() * TAU, v: 6, turn: 0, col, marks, fin: 'rgba(250,240,225,.55)', size: 2.6 + q() * 0.9, ph: q() * TAU, sp: Array.from({ length: 8 }, () => [150 + i * 34, 172]) }));
    flies = Array.from({ length: 6 }, () => ({ x: 60 + q() * 250, y: 120 + q() * 60, a: q() * TAU, ph: q() * 9, per: 3.2 + q() * 2.6, on: 0 }));
    falls = []; ripples = []; rain = []; flakes = []; food = []; bird = null; butterfly = null; dragon = null;
  }
  const kind = () => sky?.kind || 'clear';
  const cloudy = () => ({ clear: 0, partly: 0.4, cloudy: 0.85, fog: 0.6, drizzle: 0.8, rain: 0.95, sleet: 0.95, snow: 0.85, thunder: 1 }[kind()] ?? 0);
  const wet = () => ({ drizzle: 0.35, rain: 0.8, sleet: 0.6, thunder: 1 }[kind()] || 0);
  const snowing = () => ({ snow: 1, sleet: 0.5 }[kind()] || 0);
  function drop(x, y, burst) {
    const k = sz === 0 ? 'petal' : sz === 2 ? 'leaf' : sz === 3 ? 'snow' : 'green';
    if (sz === 1 && !burst && Math.random() < 0.7) return;
    falls.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: 4 + Math.random() * 6, a: Math.random() * TAU, spin: (Math.random() - 0.5) * 4, k, land: 0, life: 1, r: 2.4 + Math.random() * 1.2, col: k === 'leaf' ? ['#c8322a', '#e8662c', '#e0902e'][Math.floor(Math.random() * 3)] : k === 'petal' ? (Math.random() < 0.5 ? '#f6d6dc' : '#f0bccb') : k === 'green' ? '#57a044' : '#ffffff' });
  }
  function shake() {
    maple.v += 0.06; for (let i = 0; i < (sz === 1 ? 6 : 14); i++) drop(10 + Math.random() * 150, 10 + Math.random() * 44, true);
    if (bird && !bird.fly) bird.fly = { at: t };
    if (t - rustleAt > 0.3) { rustleAt = t; playTerra('rustle', { x: -0.4 }); }
  }
  function feed(x, y) {
    for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, d = Math.random() * 7; food.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.35, at: t + i * 0.05 }); }
    ripples.push({ x, y, at: t, big: true });
    playTerra('plop', { x: x / W * 2 - 1 });
  }

  function step(dt) {
    t += dt;
    if (t - skyAt > 20) { skyAt = t; sky = skyOf ? skyOf() : currentSky(); day = daylight(now()); if (userLamp !== null && userLamp === autoLamp()) userLamp = null; const s = season(now()); if (s !== sz) { sz = s; build(); } }
    const live = t - hover.at < 2.5;
    const tx = live ? clamp(hover.x / W - 0.5, -0.5, 0.5) * 2 : 0.35 * Math.sin(t * 0.05), ty = live ? clamp(hover.y / H - 0.5, -0.5, 0.5) * 2 : 0.2 * Math.sin(t * 0.037);
    const kk = 1 - Math.exp(-dt * 2.2); px += (tx - px) * kk; py += (ty - py) * kk;
    lampLv += ((lampOn() ? 1 : 0) - lampLv) * (1 - Math.exp(-dt * 2.5));
    spout.step(dt, t);
    // wind: een vlaag sterft uit, de esdoorn veert terug
    wind *= Math.exp(-dt * 0.8);
    const w = 0.15 + 0.08 * Math.sin(t * 0.3) + wind + wet() * 0.3;
    maple.v += (-maple.a * 5 - maple.v * 1.6 + (w - 0.15) * 0.04 * Math.sin(t * 1.3)) * dt; maple.a += maple.v * dt;
    built.cloudX = built.cloudX.map((x, i) => { const n = x + dt * (1.5 + i * 0.6 + w * 4); return n > W + 20 ? -120 : n; });
    // vallend blad, bloesem, sneeuw van de boom
    if (Math.random() < dt * (sz === 2 ? 0.5 : sz === 0 ? 0.6 : sz === 3 ? 0.15 : 0.08) * (1 + w * 2)) drop(10 + Math.random() * 160, 20 + Math.random() * 34);
    for (const f of falls) {
      if (f.land === 0) {
        f.vx += ((w * 22) - f.vx) * dt * 0.8; f.x += (f.vx + Math.sin(t * 2 + f.a) * 6) * dt; f.y += f.vy * dt; f.a += f.spin * dt;
        if (inPond(f.x, f.y, 0.95) && f.y > 158) { f.land = 2; ripples.push({ x: f.x, y: f.y, at: t }); }
        else if (f.y > 136 + (f.k === 'snow' ? 0 : (f.x * 7 % 84))) f.land = 1;
      } else if (f.land === 2) { f.x += dt * (1.5 + w * 3); f.life -= dt / 40; if (!inPond(f.x, f.y, 0.95)) f.life = 0; }
      else f.life -= dt / (f.k === 'snow' ? 3 : 24);
    }
    falls = falls.filter(f => f.life > 0 && f.x < W + 20 && f.y < H + 10).slice(-140);
    // regen en sneeuw uit de lucht
    const rn = wet(), sn = snowing();
    if (rn > 0) { while (rain.length < 90 * rn) rain.push({ x: Math.random() * (W + 40), y: Math.random() * H, v: 160 + Math.random() * 60 }); }
    rain.length = Math.min(rain.length, Math.round(90 * rn));
    for (const r of rain) { r.y += r.v * dt; r.x -= r.v * dt * (0.15 + w * 0.3); if (r.y > H) { if (Math.random() < 0.5) { const rx = 110 + Math.random() * 190, ry = 156 + Math.random() * 36; if (inPond(rx, ry, 0.95)) ripples.push({ x: rx, y: ry, at: t, rain: true }); } r.y = -10; r.x = Math.random() * (W + 40); } }
    if (sn > 0) { while (flakes.length < 80 * sn) flakes.push({ x: Math.random() * W, y: Math.random() * H, v: 9 + Math.random() * 12, k: Math.random() * 9, r: 0.5 + Math.random() * 0.7 }); }
    flakes.length = Math.min(flakes.length, Math.round(80 * sn));
    for (const s of flakes) { s.y += s.v * dt; s.x += (Math.sin(t + s.k) * 6 + w * 10) * dt; if (s.y > H) { s.y = -4; s.x = Math.random() * W; } if (s.x > W) s.x = 0; }
    if (kind() === 'thunder' && Math.random() < dt / 25) flash = 1;
    flash = Math.max(0, flash - dt * 4);
    ripples = ripples.filter(r => t - r.at < (r.rain ? 0.9 : 2.2)).slice(-48);
    if (Math.random() < dt * 0.5) ripples.push({ x: 186 + (Math.random() - 0.5) * 2, y: 142, at: t, tiny: true });
    // koi: zwemmen rustig, komen naar het voer en happen het weg
    const slow = sz === 3 ? 0.5 : 1; food = food.filter(f => !f.gone && t - f.at < 30);
    for (const k of koi) {
      k.turn += (Math.random() - 0.5) * dt * 3; k.turn *= 1 - dt; k.a += k.turn * dt;
      let want = 6 * slow; const fd = food.length ? food.reduce((p, f) => (Math.hypot(f.x - k.x, (f.y - k.y) * 3) < Math.hypot(p.x - k.x, (p.y - k.y) * 3) ? f : p)) : null;
      if (fd) { const d = Math.hypot(fd.x - k.x, (fd.y - k.y) * 2.6), target = Math.atan2((fd.y - k.y) * 2.6, fd.x - k.x); let da = target - k.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; k.a += da * dt * 3; want = d < 5 ? 2 : 15 * slow; if (d < 3.2) { fd.gone = true; ripples.push({ x: fd.x, y: fd.y, at: t }); } }
      if (!inPond(k.x, k.y, 0.78)) { let da = Math.atan2((173.5 - k.y) * 3, 204 - k.x) - k.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; k.a += da * dt * 2.4; }
      k.v += (want - k.v) * dt * 2; k.x += Math.cos(k.a) * k.v * dt; k.y += Math.sin(k.a) * k.v * dt * 0.38; k.ph += dt * (2 + k.v * 0.5);
      k.sp[0] = [k.x, k.y]; for (let i = 1; i < 8; i++) { const [ax, ay] = k.sp[i - 1], [bx, by] = k.sp[i], dx = bx - ax, dy = (by - ay) / 0.38, l = Math.hypot(dx, dy) || 1, sw = Math.sin(k.ph - i * 0.6) * 0.16 * (i / 7); k.sp[i] = [ax + (dx / l - dy / l * sw) * k.size * 0.95, ay + (dy / l + dx / l * sw) * k.size * 0.95 * 0.38]; }
    }
    // vogeltje op de lantaarn
    if (!bird && (nextBird -= dt) < 0 && day.light > 0.3 && wet() < 0.5) { bird = { x: -10, y: 70, sit: 0, fly: null, arrive: t, hop: 0, face: 1, look: 0 }; nextBird = 70 + Math.random() * 90; }
    if (bird) {
      if (bird.fly) { const u = t - bird.fly.at; bird.face = 1; bird.x += dt * 62; bird.y -= dt * (32 - u * 10); if (bird.x > W + 20 || bird.y < -20) bird = null; }
      else if (bird.sit === 0) { const u = clamp((t - bird.arrive) / 2.2, 0, 1); bird.x = -10 + (ROOF[0] + 10) * u; bird.y = 70 + (ROOF[1] - 70) * u - Math.sin(u * Math.PI) * 18; if (u >= 1) { bird.sit = t; bird.leave = 12 + Math.random() * 14; } }
      else { if (Math.random() < dt * 0.5) bird.hopAt = t; if (Math.random() < dt * 0.7) { bird.look = Math.random() < 0.5 ? 1 : -0.6; if (Math.random() < 0.25) bird.face *= -1; } bird.hop = bird.hopAt && t - bird.hopAt < 0.14 ? 1 : 0; if (t - bird.sit > bird.leave) bird.fly = { at: t }; }
    }
    // vlinder (lente, zomer, overdag), libel boven de vijver (zomer), vuurvliegjes (zomernacht)
    if (!butterfly && (nextFly -= dt) < 0 && sz <= 1 && day.light > 0.6 && wet() === 0) { butterfly = { x: -10, y: 130 + Math.random() * 30, ph: 0, col: Math.random() < 0.5 ? '#f4f0e0' : '#f2d36a' }; nextFly = 50 + Math.random() * 60; }
    if (butterfly) { butterfly.ph += dt; butterfly.x += dt * (13 + w * 10) * (0.6 + 0.4 * Math.sin(butterfly.ph * 0.9)); butterfly.y += Math.sin(butterfly.ph * 1.7) * dt * 14 - dt * 2; if (butterfly.x > W + 10) butterfly = null; }
    if (sz === 1 && day.light > 0.6 && wet() === 0) {
      if (!dragon) dragon = { x: 200, y: 150, tx: 200, ty: 150, next: 0, a: 0 };
      if ((dragon.next -= dt) < 0) { dragon.next = 0.8 + Math.random() * 2.4; dragon.tx = 120 + Math.random() * 170; dragon.ty = 140 + Math.random() * 26; }
      const dx = dragon.tx - dragon.x; if (Math.abs(dx) > 2) dragon.a = dx > 0 ? 0 : Math.PI;
      dragon.x += dx * dt * 4; dragon.y += (dragon.ty - dragon.y) * dt * 4;
    } else dragon = null;
    for (const f of flies) { f.a += (Math.random() - 0.5) * dt * 3; f.on = Math.max(0, Math.sin((t + f.ph) / f.per * TAU)) ** 3; f.x += Math.cos(f.a) * dt * 6; f.y += Math.sin(f.a) * dt * 4 - f.on * dt * 4; if (f.x < 30 || f.x > W - 10 || f.y < 110 || f.y > 196) f.a += Math.PI * dt * 2; f.y = clamp(f.y, 100, 200); }
  }

  /* ---- licht ---- */
  function lighting(L, warm, cl, ox, oy) {
    const amb = lerp3([0.24, 0.3, 0.46], [0.86 - cl * 0.2, 0.88 - cl * 0.18, 0.86 - cl * 0.14], L);
    light.begin([Math.min(1, amb[0] + warm * 0.12), amb[1] + warm * 0.02, Math.max(0, amb[2] - warm * 0.08)]);
    if (L > 0.05 && cl < 0.8 && built.mapleCols) light.dapple(0, 132, W, H, t * 0.6 + maple.a * 300 + px * 6, Math.sin(t * 0.17) * 4, 0.3 * L * (1 - cl), 170, 80);     // bladschaduw van de esdoorn
    const N = (1 - L) * lampLv;
    if (N > 0.01) {
      const fl = 0.94 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 2.9);
      light.spot(LX + ox, 150 + oy, 86, [1, 0.7, 0.36], N * fl, 44);
      light.spot(LX + ox, 142 + oy, 30, [0.9, 0.62, 0.3], N * fl);
      light.spot(262 + ox * 0.6, 110 + oy * 0.6, 100, [1, 0.76, 0.46], N * 0.9, 56);
      light.spot(250 + ox * 0.6, 142 + oy * 0.6, 120, [0.7, 0.48, 0.24], N * 0.8, 30);
    }
    const fa = sz === 1 ? clamp(1 - L * 2.2, 0, 1) : 0;
    if (fa > 0.01) for (const f of flies) if (f.on > 0.02) light.spot(f.x + ox, f.y + oy, 26, [0.86, 0.84, 0.36], fa * f.on);
    return { N, fa };
  }

  /* ---- tekenen ---- */
  function draw() {
    const { far, midL, near, rake, frame, tree, clouds } = built, L = day.light, warm = day.warm, cl = cloudy();
    g.setTransform(scale, 0, 0, scale, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    // kleuren van de lucht volgens uur en weer (de lucht zelf komt er straks achter)
    let top = mix('#16203a', '#86b6de', L), bot = mix('#2c3554', '#f4e6c6', L);
    top = mix(top, '#c9849a', warm * 0.4); bot = mix(bot, '#f6b678', warm * 0.75);
    top = mix(top, L > 0.3 ? '#a6aeb4' : '#2a2f3c', cl * 0.75); bot = mix(bot, L > 0.3 ? '#cfd3d2' : '#3a3f4c', cl * 0.7);
    if (kind() === 'fog') { top = mix(top, '#d7dad6', 0.6 * L + 0.2); bot = mix(bot, '#e2e3de', 0.6 * L + 0.2); }
    g.drawImage(far.cv, -PAD - px * 1.5, -py * 0.6, W + PAD * 2, H);
    g.drawImage(midL.cv, -PAD - px * 3.5, -py * 1.2, W + PAD * 2, H);
    const nx = -PAD - px * 6, ny = -py * 2, ox = nx + PAD, oy = ny;
    g.drawImage(near.cv, nx, ny, W + PAD * 2, H);
    g.drawImage(rake.cv, nx, ny, W + PAD * 2, H);
    g.save(); g.translate(ox, oy);
    // vijver: koi onder het water, de lucht in het oppervlak, lelieblad, kringen
    g.save(); g.beginPath(); smooth(g, POND); g.clip();
    for (const k of koi) drawKoi(g, k, 0.38, sz === 3 ? 0.55 : 0.92);
    { const gr = g.createLinearGradient(0, 152, 0, 196); gr.addColorStop(0, mix(bot, '#ffffff', 0.1) + 'd8'); gr.addColorStop(0.5, mix(top, '#3f6a72', 0.3) + 'a0'); gr.addColorStop(1, mix(top, '#2a4a50', 0.5) + '66'); g.fillStyle = gr; g.fillRect(96, 150, 216, 48); }
    g.fillStyle = 'rgba(20,34,30,.3)'; g.beginPath(); g.ellipse(250, 155.5, 44, 4.6, 0, 0, TAU); g.ellipse(150, 156, 26, 3.4, 0, 0, TAU); g.fill();        // het theehuis en de den in het water
    g.lineWidth = 0.5; g.strokeStyle = 'rgba(255,255,255,.34)'; for (let i = 0; i < 12; i++) { const x = 112 + ((i * 41 + t * (2 + i % 3)) % 184), y = 158 + (i * 7 % 32), wl = 5 + (i % 4) * 4; if (!inPond(x, y, 0.9)) continue; g.beginPath(); g.moveTo(x, y); g.lineTo(x + wl, y); g.stroke(); }
    if (sz !== 3) for (const [x, y, r, a] of [[236, 180, 5, 0.4], [246, 184.5, 4, 2.1], [226, 185, 3.4, 4], [160, 166, 4.4, 1.2], [152, 170, 3.2, 5]]) { const bx = x + Math.sin(t * 0.4 + x) * 0.5; g.fillStyle = sz === 2 ? '#6f8a44' : '#4f8f48'; g.beginPath(); g.ellipse(bx, y, r, r * 0.4, 0, a, a + TAU - 0.5); g.lineTo(bx, y); g.closePath(); g.fill(); g.fillStyle = 'rgba(200,230,150,.3)'; g.beginPath(); g.ellipse(bx - r * 0.2, y - r * 0.08, r * 0.5, r * 0.16, 0, 0, TAU); g.fill(); }
    for (const f of food) if (t >= f.at) { g.fillStyle = '#b8793a'; g.beginPath(); g.ellipse(f.x, f.y, 0.75, 0.42, 0, 0, TAU); g.fill(); }
    for (const r of ripples) { if (r.tiny) continue; const u = (t - r.at) / (r.rain ? 0.9 : 2.2), R = (r.rain ? 5 : r.big ? 20 : 11) * u + 1; g.strokeStyle = `rgba(255,255,255,${(r.rain ? 0.4 : 0.55) * (1 - u)})`; g.beginPath(); g.ellipse(r.x, r.y, R, R * 0.32, 0, 0, TAU); g.stroke(); }
    g.restore();
    // bekken: straaltje uit de bamboegoot, kringen
    spout.draw(g, t);
    for (const r of ripples) { if (!r.tiny) continue; const u = (t - r.at) / 2.2; g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - u)})`; g.lineWidth = 0.35; g.beginPath(); g.ellipse(r.x, r.y, 0.8 + u * 3.6, 0.3 + u * 1, 0, 0, TAU); g.stroke(); }
    // vallend en liggend blad
    for (const f of falls) { g.globalAlpha = Math.min(1, f.life * 3); if (f.k === 'snow') { g.fillStyle = f.col; g.beginPath(); g.arc(f.x, f.y, 0.9, 0, TAU); g.fill(); } else if (f.k === 'leaf') { g.save(); g.translate(f.x, f.y); g.scale(1, f.land ? 0.45 : 0.6 + 0.4 * Math.cos(f.a * 1.7)); mapleLeaf(g, 0, 0, f.r, f.a, f.col); g.restore(); } else { g.fillStyle = f.col; g.beginPath(); g.ellipse(f.x, f.y, f.k === 'petal' ? 1.7 : 2.2, (f.k === 'petal' ? 1 : 0.9) * (f.land ? 0.5 : 1), f.a, 0, TAU); g.fill(); } }
    g.globalAlpha = 1;
    if (bird) drawBird(g, { ...bird, fly: bird.fly || bird.sit === 0 ? 1 : null }, t);
    if (butterfly) { const f = Math.abs(Math.sin(butterfly.ph * 13)); g.fillStyle = butterfly.col; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(butterfly.x + s * 1.5 * f, butterfly.y - 0.4, 1.7 * f + 0.3, 2.1, s * 0.35, 0, TAU); g.fill(); g.beginPath(); g.ellipse(butterfly.x + s * 1.1 * f, butterfly.y + 1.5, 1.1 * f + 0.2, 1.3, s * 0.5, 0, TAU); g.fill(); } g.fillStyle = '#3a3428'; g.fillRect(butterfly.x - 0.25, butterfly.y - 1.4, 0.5, 3.2); }
    if (dragon) { g.save(); g.translate(dragon.x, dragon.y); g.rotate(dragon.a); g.strokeStyle = '#2c7f9a'; g.lineWidth = 0.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(1.6, 0); g.stroke(); g.fillStyle = '#2a5a4a'; g.beginPath(); g.arc(2.4, 0, 0.9, 0, TAU); g.fill(); g.fillStyle = `rgba(232,242,246,${0.42 + 0.2 * Math.sin(t * 46)})`; for (const [dx, a] of [[0.6, -1.25], [0.6, 1.25], [-0.6, -1.5], [-0.6, 1.5]]) { g.save(); g.translate(dx, 0); g.rotate(a); g.beginPath(); g.ellipse(2.6, 0, 2.9, 0.7, 0, 0, TAU); g.fill(); g.restore(); } g.restore(); }
    g.restore();
    // esdoorn en omlijsting op de voorgrond
    g.save(); g.translate(-14 - px * 8, -14 - py * 2.5); g.rotate(maple.a + 0.006 * Math.sin(t * 0.8)); g.drawImage(tree.cv, 0, 0, 196, 104); g.restore();
    g.drawImage(frame.cv, -PAD - px * 9, -py * 3, W + PAD * 2, H);
    // licht over wat getekend is
    const { N, fa } = lighting(L, warm, cl, ox, oy);
    light.applyDrawn(g);
    // wat zelf licht geeft: het venster van de lantaarn, de shoji, hun weerschijn in de vijver, vuurvliegjes
    g.globalCompositeOperation = 'lighter';
    if (N > 0.01) {
      const fl = 0.9 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 2.9), lx = LX + ox, ly = 142.8 + oy;
      g.fillStyle = `rgba(255,214,140,${0.85 * N * fl})`; g.fillRect(lx - 3.6, ly - 2.6, 7.2, 5.2);
      let gr = g.createRadialGradient(lx, ly, 0, lx, ly, 30); gr.addColorStop(0, `rgba(255,190,110,${0.34 * N * fl})`); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(lx - 30, ly - 30, 60, 60);
      const mx = -px * 3.5, my = -py * 1.2;
      for (const [x, y, w, h] of SHOJI) { g.fillStyle = `rgba(255,196,120,${0.3 * N})`; g.fillRect(x + mx, y + my, w, h); }
      gr = g.createRadialGradient(262 + mx, 110 + my, 0, 262 + mx, 110 + my, 78); gr.addColorStop(0, `rgba(255,186,104,${0.2 * N})`); gr.addColorStop(1, 'rgba(255,186,104,0)'); g.fillStyle = gr; g.fillRect(170, 40, 170, 150);
      g.save(); g.translate(ox, oy); g.beginPath(); smooth(g, POND); g.clip(); g.lineCap = 'round';
      for (let j = 0; j < 10; j++) { const y = 161.5 + j * 2.3, x = LX + 3 + Math.sin(t * 1.3 + j * 1.1) * 1.7 * (0.3 + j / 9), wl = 4.6 - j * 0.28; g.strokeStyle = `rgba(255,200,120,${0.55 * N * fl * (1 - j / 11)})`; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - wl, y); g.lineTo(x + wl, y); g.stroke(); }
      for (let j = 0; j < 16; j++) { const x = 216 + (j * 37 % 80), y = 156.5 + (j * 3.1 % 9), wl = 2 + (j % 3) * 1.6; g.strokeStyle = `rgba(255,196,120,${0.34 * N * (0.5 + 0.5 * Math.sin(t * 1.1 + j * 2.3))})`; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - wl, y); g.lineTo(x + wl, y); g.stroke(); }
      g.restore();
    }
    if (fa > 0.01) for (const f of flies) { if (f.on < 0.02) continue; const a = fa * f.on, x = f.x + ox, y = f.y + oy, gr = g.createRadialGradient(x, y, 0, x, y, 6); gr.addColorStop(0, `rgba(240,255,150,${0.95 * a})`); gr.addColorStop(0.2, `rgba(215,245,110,${0.4 * a})`); gr.addColorStop(1, 'rgba(200,240,110,0)'); g.fillStyle = gr; g.fillRect(x - 6, y - 6, 12, 12); }
    // de lucht erachter: wolken, zon of maan, sterren, verloop
    g.globalCompositeOperation = 'destination-over';
    built.cloudX.forEach((x, i) => { const y = 10 + i * 12, wa = clamp(cl * 1.4 + 0.3, 0, 1) * (0.35 + 0.65 * L); g.globalAlpha = wa; g.drawImage(clouds[i].cv, x - px * 2, y, 110, 36); g.globalAlpha = 1; });
    { const moon = L < 0.5, u = moon ? day.moon : day.sun, sx = 40 + u * (W - 80) - px * 1.5, sy = 92 - Math.sin(u * Math.PI) * 70, a = (1 - cl * 0.9) * (moon ? 1 - L : L);
      if (a > 0.02) { g.fillStyle = moon ? `rgba(244,242,226,${0.95 * a})` : `rgba(255,250,232,${0.95 * a})`; g.beginPath(); g.arc(sx, sy, moon ? 5.5 : 7, 0, TAU); g.fill(); const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 44); gr.addColorStop(0, `rgba(255,248,225,${0.5 * a})`); gr.addColorStop(1, 'rgba(255,248,225,0)'); g.fillStyle = gr; g.fillRect(sx - 44, sy - 44, 88, 88); } }
    if (L < 0.6 && cl < 0.7) { const q = rng(5); for (let i = 0; i < 46; i++) { const x = q() * W, y = q() * 100, s = 0.5 + q() * 0.6; g.fillStyle = `rgba(255,255,240,${(0.6 - L) * 1.4 * (1 - cl) * (0.5 + 0.5 * Math.sin(t * (0.6 + q()) + i))})`; g.fillRect(x, y, s, s); } }
    { const sg = g.createLinearGradient(0, 0, 0, 140); sg.addColorStop(0, top); sg.addColorStop(1, bot); g.fillStyle = sg; g.fillRect(0, 0, W, H); }
    g.globalCompositeOperation = 'source-over';
    // neerslag, mist, een verre flits
    if (rain.length) { g.strokeStyle = `rgba(220,230,240,${0.16 + 0.2 * L})`; g.lineWidth = 0.6; g.beginPath(); for (const r of rain) { g.moveTo(r.x, r.y); g.lineTo(r.x + 1.6, r.y - 7); } g.stroke(); }
    if (flakes.length) { g.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * L})`; for (const s of flakes) { g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill(); } }
    if (kind() === 'fog') { const fg = g.createLinearGradient(0, 70, 0, H), fc = mix('#2a3040', '#e6e8e4', L); fg.addColorStop(0, fc + '00'); fg.addColorStop(0.4, fc + '66'); fg.addColorStop(1, fc + '2a'); g.fillStyle = fg; g.fillRect(0, 0, W, H); }
    if (flash > 0) { g.fillStyle = `rgba(230,235,255,${0.18 * flash})`; g.fillRect(0, 0, W, H); }
  }

  return {
    own: true,
    onDark: true,
    tools: GARDEN_TOOLS,
    get tool() { return tool; },
    get lit() { return lampOn(); },
    pick(id) { if (id === 'lantern') { const want = !lampOn(); userLamp = want === autoLamp() ? null : want; save(); playTerra('lamp', { x: -0.3 }); } else tool = id; onTool(); },
    get busy() { return false; },
    init() { seed(); restore(); },
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
      sz = season(now()); sky = skyOf ? skyOf() : currentSky(); day = daylight(now()); skyAt = t;
      build(); light = createLight(W, H);
      lastNow = 0;
      if (!started) { started = true; lampLv = lampOn() ? 1 : 0; for (let i = 0; i < 90; i++) step(1 / 30); }
      if (reducedMotion.matches) draw();
    },
    unmount() { cv?.remove(); cv = null; g = null; built = null; light = null; ptr = null; },
    frame(n) {
      if (!cv || reducedMotion.matches) return;
      const dt = lastNow ? clamp((n - lastNow) / 1000, 0, 0.05) : 1 / 60;
      lastNow = n;
      step(dt);
      draw();
    },
    move(p) { hover = { x: p.x, y: p.y, at: t }; },
    down(p) { ptr = { x: p.x, y: p.y, tool, inTree: p.y < 84 && p.x < 190, raked: false }; },
    drag(p) {
      if (!ptr) return;
      const dx = p.x - ptr.x, x0 = ptr.x, y0 = ptr.y;
      if (ptr.tool === 'rake') {
        // harken: voren langs de sleep, enkel in het grind; korte stukjes worden samengenomen
        if (Math.hypot(p.x - x0, p.y - y0) < 2.5) return;
        ptr.x = p.x; ptr.y = p.y;
        if (p.x > 164 && p.y > gravelY(p.x) && y0 > gravelY(x0)) { const s = [x0, y0, p.x, p.y]; strokes.push(s); if (strokes.length > 160) { strokes.shift(); rakeAll(); } else { groove(built.rake.c, ...s); clearRock(); } ptr.raked = true; if (t - rustleAt > 0.45) { rustleAt = t; playTerra('rustle', { x: p.x / W * 2 - 1 }); } }
        return;
      }
      ptr.x = p.x; ptr.y = p.y;
      if (ptr.tool === 'wind') { wind = clamp(wind + dx * 0.01, -1.2, 1.6); maple.v += dx * 0.0008; if (ptr.inTree && Math.abs(dx) > 3 && t - rustleAt > 0.5) shake(); }
    },
    up() { if (ptr?.raked) save(); ptr = null; },
    tap(p) {
      if (bird && !bird.fly && bird.sit && Math.hypot(p.x - bird.x, p.y - bird.y + 3) < 14) { bird.fly = { at: t }; playTerra('hop', { x: -0.3 }); return; }
      if (tool === 'feed' && inPond(p.x, p.y, 1.08)) feed(clamp(p.x, 118, 290), clamp(p.y, 160, 187));
      else if (tool === 'wind') { if (p.y < 84 && p.x < 190) shake(); else wind = clamp(wind + 0.5, -1.2, 1.6); }
    },
    leave() { ptr = null; hover.at = -99; },
    recolor() {},
  };
}
