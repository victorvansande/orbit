/* ---- Japanse tuin in het bakje van de focusmodus ---- */
// Tweede natuurvenster (Victor, 12/11/2026), zelfde handschrift als het paludarium: S1 Penseel (src/focus/brush.js),
// over het hele bakje, recht vooruit, volle natuurkleur. Een esdoorn die van linksboven in beeld hangt, een stenen
// lantaarn op mos, een vijver met koi, gesnoeide struiken, een den met wolkvormige kussens, een tuinmuur, heuvels in nevel.
// Alle vier seizoenen even belangrijk, volgens de datum: lente (fris blad, vallende bloesemblaadjes, vlinders),
// zomer (diep groen, libel boven de vijver, 's nachts vuurvliegjes), herfst (rode esdoorn, vallend en drijvend blad),
// winter (kale takken, sneeuw). Licht volgt de klok (zonsopgang en -ondergang volgens de dag van het jaar, schemer warm),
// het weer volgt de echte stand (currentSky uit weather.js): wolken, regen met kringen, sneeuw, mist.
// Zelf doen: tik in de vijver = voeren (de koi komen), tik in de esdoorn = schudden, slepen = een windvlaag in die
// richting, dubbeltik = lantaarn aan of uit, tik op het vogeltje = het vliegt weg; de muis geeft een beetje diepte.
// Geluid enkel bij acties (playTerra). Geen blur, geen lichtstralen: diepte met nevel. Minder beweging: één beeld.

import { createBrush, layer, mix, rng } from './dabs.js';
import { playTerra } from '../scene/sound.js';
import { LANG } from '../core/i18n.js';
import { currentSky } from './weather.js';

const W = 325.6, H = 226.8, TAU = Math.PI * 2, PAD = 10;
const HINT = LANG === 'en' ? 'TAP: FEED · DRAG: WIND · DOUBLE TAP: LANTERN' : 'TIK: VOEREN · SLEEP: WIND · DUBBELTIK: LANTAARN';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const POND = [[96, 166], [130, 154], [190, 152], [250, 156], [300, 166], [290, 186], [230, 196], [150, 196], [104, 186]];
const inPond = (x, y, m = 1) => ((x - 198) / (96 * m)) ** 2 + ((y - 175) / (20 * m)) ** 2 < 1;
const LX = 64, ROOF = [64, 117];
const ground = x => 142 + Math.sin(x * 0.02) * 3;
let hinted = false;

function season(d = new Date()) { const m = d.getMonth(); return m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3; }
// zon op en onder volgens de dag van het jaar (Vlaanderen: 5:30 tot 22:00 in juni, 8:45 tot 16:40 in december)
function daylight(d = new Date()) {
  const doy = (d - new Date(d.getFullYear(), 0, 0)) / 864e5, c = Math.cos(TAU * (doy - 172) / 365);
  const rise = 7.1 - 1.6 * c, set = 19.35 + 2.65 * c, h = d.getHours() + d.getMinutes() / 60;
  const light = clamp(Math.min((h - rise + 0.6) / 1.2, (set + 0.6 - h) / 1.2), 0, 1);
  const warm = Math.max(Math.exp(-(((h - rise) / 0.8) ** 2)), Math.exp(-(((h - set) / 0.8) ** 2)));
  const night = ((h - set + 24) % 24) / (24 - (set - rise));
  return { light, warm, sun: clamp((h - rise) / (set - rise), 0, 1), moon: clamp(night, 0, 1) };
}
function smooth(c, pts) { const n = pts.length; c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2); for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } c.closePath(); }

export function createGarden({ reducedMotion, zoom = 1 }) {
  let cv = null, g = null, scale = 1, built = null, sz = season(), sky = null, skyAt = -99;
  let t = 0, lastNow = 0, hintAt = -99, px = 0, py = 0, hover = { x: W / 2, y: H / 2, at: -99 }, ptr = null, lastTap = null;
  let wind = 0, maple = { a: 0, v: 0 }, userLamp = null, lampLv = 0, day = daylight();
  let koi = [], food = null, ripples = [], falls = [], rain = [], flakes = [], flies = [], bird = null, nextBird = 40, butterfly = null, nextFly = 20, dragon = null, flash = 0;

  /* ---- schilderen: één keer per seizoen en maat ---- */
  function build() {
    const winter = sz === 3, mapleCol = [['#9ccf62', '#cfe58a'], ['#3f8a3a', '#62a548'], ['#c42e28', '#e8692c'], null][sz];
    const green = winter ? '#5c7a5e' : sz === 1 ? '#3f7d3c' : '#5c8f45', moss = winter ? '#e6ebee' : sz === 1 ? '#5f9a3a' : sz === 2 ? '#7f9a48' : '#7aa64a';
    const far = layer(W + PAD * 2, H, scale, PAD, 0), midL = layer(W + PAD * 2, H, scale, PAD, 0), near = layer(W + PAD * 2, H, scale, PAD, 0);
    let b = createBrush(far.c, 71);
    b.area([[-PAD - 2, 98, 1], [60, 76], [120, 90], [180, 70], [250, 86], [W + PAD + 2, 72, 1], [W + PAD + 2, 150, 1], [-PAD - 2, 150, 1]], mix('#7f9fa8', '#e8eadf', winter ? 0.55 : 0.45), { shade: 0.2, dab: 0.6 });
    b.area([[-PAD - 2, 108, 1], [70, 94], [150, 104], [230, 92], [W + PAD + 2, 102, 1], [W + PAD + 2, 150, 1], [-PAD - 2, 150, 1]], mix('#5f8a80', '#e8eadf', winter ? 0.45 : 0.3), { shade: 0.25, dab: 0.6 });
    for (let i = 0; i < 9; i++) b.blobs(-PAD + i * 40 + b.q() * 20, 110 + b.q() * 6, 16, 6, mix(winter ? '#6f8478' : '#4f7a5a', '#e8eadf', 0.35));
    b = createBrush(midL.c, 73);
    b.area([[150, 112, 1], [W + PAD + 2, 110, 1], [W + PAD + 2, 140, 1], [150, 140, 1]], winter ? '#e9e4d8' : '#e6dcc4', { shade: 0.3 });
    b.area([[144, 108, 1], [W + PAD + 2, 105, 1], [W + PAD + 2, 113, 1], [146, 115, 1]], '#4a4c52', { shade: 0.5 });
    if (winter) b.area([[144, 106, 1], [W + PAD + 2, 103, 1], [W + PAD + 2, 107, 1], [146, 109, 1]], '#ffffff', { shade: 0.2 });
    b.line([[268, 160], [262, 130], [254, 104], [262, 78]], '#5a4434', 6, 3);
    b.line([[258, 118], [232, 104]], '#5a4434', 2.4, 1.2); b.line([[262, 98], [292, 88]], '#5a4434', 2.2, 1.2); b.line([[256, 108], [300, 112]], '#5a4434', 2, 1);
    for (const [x, y, rx, ry] of [[262, 74, 18, 7], [230, 100, 16, 6], [294, 86, 16, 6], [302, 110, 15, 5.5], [262, 96, 12, 5]]) { b.blobs(x, y, rx, ry, '#2f5a3c'); if (winter) b.area([[x - rx * 0.9, y - ry * 0.3], [x, y - ry - 1.5], [x + rx * 0.9, y - ry * 0.3], [x, y - ry * 0.2]], '#ffffff', { shade: 0.15 }); }
    for (const [x, y, rx, ry] of [[196, 140, 22, 11], [224, 146, 16, 8], [120, 142, 18, 9], [306, 146, 22, 10]]) { b.blobs(x, y, rx, ry, green, { r: ry * 0.9 }); if (winter) b.area([[x - rx * 0.85, y - ry * 0.2], [x - rx * 0.3, y - ry - 1], [x + rx * 0.4, y - ry - 0.5], [x + rx * 0.85, y - ry * 0.1], [x, y - ry * 0.5]], '#ffffff', { shade: 0.15 }); }
    b = createBrush(near.c, 77);
    b.area([[-PAD - 2, 142, 1], [80, 136], [160, 146], [W + PAD + 2, 142, 1], [W + PAD + 2, H + 4, 1], [-PAD - 2, H + 4, 1]], moss, { shade: 0.4, dab: 0.9 });
    // geharkt grind rechtsonder (karesansui): lichte vlakte met evenwijdige halen
    const gravel = [[176, 204, 1], [220, 199], [W + PAD + 2, 198, 1], [W + PAD + 2, H + 4, 1], [168, H + 4, 1]];
    b.area(gravel, winter ? '#eef1f3' : '#d9d4c6', { shade: 0.25, dab: 0.5 });
    near.c.save(); near.c.beginPath(); near.c.moveTo(176, 204); near.c.lineTo(220, 199); near.c.lineTo(W + PAD + 2, 198); near.c.lineTo(W + PAD + 2, H + 4); near.c.lineTo(168, H + 4); near.c.closePath(); near.c.clip();
    near.c.strokeStyle = winter ? 'rgba(150,165,180,.45)' : 'rgba(120,110,95,.4)'; near.c.lineWidth = 0.6;
    for (let y = 202; y < H + 4; y += 2.6) { near.c.beginPath(); for (let x = 166; x <= W + PAD; x += 6) { const yy = y + Math.sin(x * 0.03 + y * 0.1) * 0.8; x === 166 ? near.c.moveTo(x, yy) : near.c.lineTo(x, yy); } near.c.stroke(); }
    near.c.restore();
    b.area([[262, 214], [272, 207], [286, 208], [292, 215], [280, 220]], '#8a8780', { shade: 0.8 });
    // mosheuvels vooraan
    for (const [x, y, rx, ry] of [[14, 200, 30, 9], [136, 222, 26, 7], [6, 168, 18, 7], [150, 206, 16, 5]]) b.blobs(x, y, rx, ry, winter ? '#dfe5e8' : mix(moss, '#3f6a2c', 0.25), { r: ry * 0.9 });
    b.area(POND, winter ? '#7f98a6' : '#6aa2b8', { shade: 0.35 });
    near.c.save(); near.c.beginPath(); smooth(near.c, POND); near.c.clip(); near.c.fillStyle = 'rgba(20,50,45,.2)';
    for (const [x, y, rx, ry] of [[230, 160, 18, 4], [262, 158, 14, 3.5], [252, 166, 10, 3]]) { near.c.beginPath(); near.c.ellipse(x, y, rx, ry, 0, 0, TAU); near.c.fill(); }
    near.c.restore();
    for (const [x, y, rx, ry] of [[96, 170, 10, 6], [128, 156, 9, 5], [292, 172, 11, 6], [254, 194, 12, 5], [150, 198, 10, 4]]) { b.area([[x - rx, y + ry * 0.4], [x - rx * 0.6, y - ry], [x + rx * 0.5, y - ry * 0.9], [x + rx, y + ry * 0.2], [x + rx * 0.3, y + ry]], '#8a8780', { shade: 0.8 }); if (winter) b.area([[x - rx * 0.8, y - ry * 0.3], [x - rx * 0.4, y - ry * 1.05], [x + rx * 0.5, y - ry * 0.95], [x + rx * 0.8, y - ry * 0.2]], '#ffffff', { shade: 0.15 }); }
    b.blobs(LX, 172, 34, 9, moss, { r: 8 });
    const stone = '#9a968c';
    b.area([[LX - 10, 170, 1], [LX + 10, 170, 1], [LX + 8, 164, 1], [LX - 8, 164, 1]], stone);
    b.area([[LX - 4, 165, 1], [LX + 4, 165, 1], [LX + 3.5, 146, 1], [LX - 3.5, 146, 1]], stone);
    b.area([[LX - 9, 147, 1], [LX + 9, 147, 1], [LX + 8, 143, 1], [LX - 8, 143, 1]], stone);
    b.area([[LX - 7, 143, 1], [LX + 7, 143, 1], [LX + 7, 131, 1], [LX - 7, 131, 1]], stone);
    near.c.fillStyle = '#3a3a3c'; near.c.fillRect(LX - 3, 134.5, 6, 5);
    b.area([[LX - 18, 131, 1], [LX - 9, 125], [LX, 122], [LX + 9, 125], [LX + 18, 131, 1], [LX, 129]], b.drk(stone, 0.08), { shade: 0.9 });
    b.area([[LX - 3, 123], [LX, 117], [LX + 3, 123]], stone);
    if (winter) b.area([[LX - 18, 130], [LX - 9, 123.5], [LX, 120.5], [LX + 9, 123.5], [LX + 18, 130], [LX, 126]], '#ffffff', { shade: 0.2 });
    for (const [x, y, rx, ry] of [[38, 220, 15, 5], [74, 204, 13, 4.5], [104, 214, 12, 4]]) b.area([[x - rx, y], [x - rx * 0.5, y - ry], [x + rx * 0.6, y - ry], [x + rx, y], [x + rx * 0.4, y + ry], [x - rx * 0.6, y + ry]], winter ? '#d8dee2' : '#a39e94', { shade: 0.6 });
    b.canvas(-PAD, 140, W + PAD, H);
    // esdoorn: sprite die van linksboven inhangt en wiegt rond zijn aanhechting
    const tree = layer(176, 86, scale, 12, 12), tb = createBrush(tree.c, 79);
    tb.line([[-6, 6], [30, 18], [70, 28], [112, 30], [150, 26]], '#3e2e26', 7, 2.4);
    tb.line([[60, 26], [84, 44], [100, 58]], '#3e2e26', 3, 1); tb.line([[30, 18], [44, 2]], '#3e2e26', 3, 1.4); tb.line([[112, 30], [134, 46]], '#3e2e26', 2.4, 1);
    if (mapleCol) for (const [x, y, rx, ry] of [[20, 10, 26, 12], [62, 20, 28, 12], [104, 30, 26, 11], [146, 22, 18, 9], [92, 52, 16, 9], [134, 46, 14, 8], [40, 28, 18, 8]]) tb.blobs(x, y, rx, ry, mapleCol[0], { r: ry * 0.7 });
    else tb.line([[-6, 4], [30, 16], [70, 26], [112, 28], [150, 24]], '#f4f6f6', 2, 0.8);
    // wolken: wit en grijs, de dekking volgt het weer
    const clouds = [0, 1, 2].map(i => { const l = layer(90, 30, scale, 0, 0), cb = createBrush(l.c, 100 + i); cb.blobs(45, 16, 38, 7, '#ffffff', { n: 14, r: 7 }); return l; });
    const grey = [0, 1, 2].map(i => { const l = layer(90, 30, scale, 0, 0), cb = createBrush(l.c, 110 + i); cb.blobs(45, 16, 40, 8, '#9aa3aa', { n: 14, r: 7.5 }); return l; });
    built = { far, midL, near, tree, clouds, grey, mapleCol, cloudX: [20, 140, 250] };
  }

  /* ---- leven ---- */
  function seed() {
    const q = rng(9);
    koi = ['#e8742c', '#f2efe6', '#e8b84a'].map((col, i) => ({ x: 150 + i * 40, y: 172 + q() * 10, a: q() * TAU, v: 6, turn: 0, col, ph: q() * TAU, sp: Array.from({ length: 6 }, () => [150 + i * 40, 175]) }));
    flies = Array.from({ length: 5 }, () => ({ x: 120 + q() * 200, y: 120 + q() * 40, a: q() * TAU, ph: q() * TAU }));
    falls = []; ripples = []; rain = []; flakes = []; bird = null; butterfly = null; dragon = null;
  }
  const kind = () => sky?.kind || 'clear';
  const cloudy = () => ({ clear: 0, partly: 0.4, cloudy: 0.85, fog: 0.6, drizzle: 0.8, rain: 0.95, sleet: 0.95, snow: 0.85, thunder: 1 }[kind()] ?? 0);
  const wet = () => ({ drizzle: 0.35, rain: 0.8, sleet: 0.6, thunder: 1 }[kind()] || 0);
  const snowing = () => ({ snow: 1, sleet: 0.5 }[kind()] || 0);
  const lampOn = () => userLamp ?? day.light < 0.35;
  function drop(x, y, burst) {
    const k = sz === 0 ? 'petal' : sz === 2 ? 'leaf' : sz === 3 ? 'snow' : 'green';
    if (sz === 1 && !burst && Math.random() < 0.7) return;
    falls.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: 4 + Math.random() * 6, a: Math.random() * TAU, spin: (Math.random() - 0.5) * 4, k, land: 0, life: 1, col: k === 'leaf' ? (Math.random() < 0.5 ? '#c42e28' : '#e8692c') : k === 'petal' ? (Math.random() < 0.5 ? '#f6d6dc' : '#f0bccb') : k === 'green' ? '#62a548' : '#ffffff' });
  }
  function shake() {
    maple.v += 0.06; for (let i = 0; i < (sz === 1 ? 6 : 14); i++) drop(10 + Math.random() * 140, 10 + Math.random() * 40, true);
    if (bird && !bird.fly) bird.fly = { at: t, dir: 1 };
    playTerra('rustle', { x: -0.4 });
  }
  function feed(x, y) {
    food = { x, y, at: t }; ripples.push({ x, y, at: t, big: true });
    playTerra('plop', { x: x / W * 2 - 1 });
  }

  function step(dt) {
    t += dt;
    if (t - skyAt > 60) { skyAt = t; sky = currentSky(); day = daylight(); const s = season(); if (s !== sz) { sz = s; build(); } }
    const live = t - hover.at < 2.5;
    const tx = live ? clamp(hover.x / W - 0.5, -0.5, 0.5) * 2 : 0.35 * Math.sin(t * 0.05), ty = live ? clamp(hover.y / H - 0.5, -0.5, 0.5) * 2 : 0.2 * Math.sin(t * 0.037);
    const kk = 1 - Math.exp(-dt * 2.2); px += (tx - px) * kk; py += (ty - py) * kk;
    lampLv += ((lampOn() ? 1 : 0) - lampLv) * (1 - Math.exp(-dt * 2.5));
    if (lastTap && t - lastTap.t > 0.26) {
      const p = lastTap; lastTap = null;
      if (inPond(p.x, p.y, 1.1)) feed(p.x, p.y);
      else if (p.y < 70 && p.x < 170) shake();
    }
    // wind: een vlaag sterft uit, de esdoorn veert terug
    wind *= Math.exp(-dt * 0.8);
    const w = 0.15 + 0.08 * Math.sin(t * 0.3) + wind + wet() * 0.3;
    maple.v += (-maple.a * 5 - maple.v * 1.6 + (w - 0.15) * 0.04 * Math.sin(t * 1.3)) * dt; maple.a += maple.v * dt;
    built.cloudX = built.cloudX.map((x, i) => { const n = x + dt * (1.5 + i * 0.6 + w * 4); return n > W + 20 ? -100 : n; });
    // vallend blad, bloesem, sneeuw van de boom
    if (Math.random() < dt * (sz === 2 ? 0.5 : sz === 0 ? 0.6 : sz === 3 ? 0.15 : 0.08) * (1 + w * 2)) drop(10 + Math.random() * 150, 20 + Math.random() * 30);
    for (const f of falls) {
      if (f.land === 0) {
        f.vx += ((w * 22) - f.vx) * dt * 0.8; f.x += (f.vx + Math.sin(t * 2 + f.a) * 6) * dt; f.y += f.vy * dt; f.a += f.spin * dt;
        if (inPond(f.x, f.y, 0.95) && f.y > 160) { f.land = 2; ripples.push({ x: f.x, y: f.y, at: t }); }
        else if (f.y > ground(f.x) + 8 + (f.k === 'snow' ? 0 : (f.x * 7 % 60))) f.land = 1;
      } else if (f.land === 2) { f.x += dt * (1.5 + w * 3); f.life -= dt / 40; }
      else f.life -= dt / (f.k === 'snow' ? 3 : 20);
    }
    falls = falls.filter(f => f.life > 0 && f.x < W + 20 && f.y < H + 10).slice(-120);
    // regen en sneeuw uit de lucht
    const rn = wet(), sn = Math.max(snowing(), 0);
    if (rn > 0) { while (rain.length < 90 * rn) rain.push({ x: Math.random() * (W + 40), y: Math.random() * H, v: 160 + Math.random() * 60 }); }
    rain.length = Math.min(rain.length, Math.round(90 * rn));
    for (const r of rain) { r.y += r.v * dt; r.x -= r.v * dt * (0.15 + w * 0.3); if (r.y > H) { if (inPond(r.x, 175)) ripples.push({ x: r.x, y: 160 + Math.random() * 34, at: t, rain: true }); r.y = -10; r.x = Math.random() * (W + 40); } }
    if (sn > 0) { while (flakes.length < 70 * sn) flakes.push({ x: Math.random() * W, y: Math.random() * H, v: 10 + Math.random() * 12, k: Math.random() * 9 }); }
    flakes.length = Math.min(flakes.length, Math.round(70 * sn));
    for (const s of flakes) { s.y += s.v * dt; s.x += (Math.sin(t + s.k) * 6 + w * 10) * dt; if (s.y > H) { s.y = -4; s.x = Math.random() * W; } if (s.x > W) s.x = 0; }
    if (kind() === 'thunder' && Math.random() < dt / 25) flash = 1;
    flash = Math.max(0, flash - dt * 4);
    ripples = ripples.filter(r => t - r.at < (r.rain ? 0.9 : 2)).slice(-40);
    // koi: zwemmen rustig, komen naar het voer
    const slow = sz === 3 ? 0.5 : 1;
    for (const k of koi) {
      k.turn += (Math.random() - 0.5) * dt * 3; k.turn *= 1 - dt; k.a += k.turn * dt;
      let want = 6 * slow;
      if (food && t - food.at < 7) { const d = Math.hypot(food.x - k.x, food.y - k.y); const target = Math.atan2((food.y - k.y) * 3, food.x - k.x); let da = target - k.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; k.a += da * dt * 2.5; want = d < 8 ? 1.5 : 14 * slow; if (d < 8 && Math.random() < dt * 1.5) ripples.push({ x: k.x, y: k.y, at: t }); }
      if (!inPond(k.x, k.y, 0.8)) { let da = Math.atan2((175 - k.y) * 3, 198 - k.x) - k.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; k.a += da * dt * 2; }
      k.v += (want - k.v) * dt * 2; k.x += Math.cos(k.a) * k.v * dt; k.y += Math.sin(k.a) * k.v * dt * 0.35; k.ph += dt * (2 + k.v * 0.5);
      k.sp[0] = [k.x, k.y]; for (let i = 1; i < 6; i++) { const [ax, ay] = k.sp[i - 1], [bx, by] = k.sp[i], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1; k.sp[i] = [ax + dx / l * 3.2, ay + dy / l * 3.2 * 0.6]; }
    }
    // vogeltje op de lantaarn
    if (!bird && (nextBird -= dt) < 0 && day.light > 0.3 && wet() < 0.5) { bird = { x: -10, y: 60, sit: 0, fly: null, arrive: t, hop: 0 }; nextBird = 70 + Math.random() * 90; }
    if (bird) {
      if (bird.fly) { const u = t - bird.fly.at; bird.x += dt * 60; bird.y -= dt * (30 - u * 10); if (bird.x > W + 20 || bird.y < -20) bird = null; }
      else if (bird.sit === 0) { const u = clamp((t - bird.arrive) / 2.2, 0, 1); bird.x = -10 + (ROOF[0] + 10) * u; bird.y = 60 + (ROOF[1] - 60) * u - Math.sin(u * Math.PI) * 18; if (u >= 1) { bird.sit = t; bird.leave = 10 + Math.random() * 12; } }
      else { if (Math.random() < dt * 0.8) bird.hop = t; if (t - bird.sit > bird.leave) bird.fly = { at: t }; }
    }
    // vlinder (lente, zomer, overdag)
    if (!butterfly && (nextFly -= dt) < 0 && sz <= 1 && day.light > 0.6 && wet() === 0) { butterfly = { x: -10, y: 120 + Math.random() * 30, ph: 0, col: Math.random() < 0.5 ? '#f4f0e0' : '#f2d36a' }; nextFly = 50 + Math.random() * 60; }
    if (butterfly) { butterfly.ph += dt; butterfly.x += dt * (14 + w * 10); butterfly.y += Math.sin(butterfly.ph * 1.7) * dt * 14 - dt * 2; if (butterfly.x > W + 10) butterfly = null; }
    // libel boven de vijver (zomer, overdag)
    if (sz === 1 && day.light > 0.6 && wet() === 0) {
      if (!dragon) dragon = { x: 200, y: 150, tx: 200, ty: 150, next: 0 };
      if ((dragon.next -= dt) < 0) { dragon.next = 0.8 + Math.random() * 2.2; dragon.tx = 120 + Math.random() * 160; dragon.ty = 136 + Math.random() * 24; }
      dragon.x += (dragon.tx - dragon.x) * dt * 4; dragon.y += (dragon.ty - dragon.y) * dt * 4;
    } else dragon = null;
    for (const f of flies) { f.a += (Math.random() - 0.5) * dt * 3; f.x += Math.cos(f.a) * dt * 6; f.y += Math.sin(f.a) * dt * 4; if (f.x < 80 || f.x > W - 10 || f.y < 110 || f.y > 170) f.a += Math.PI * dt * 2; f.ph += dt; }
    if (ptr) { ptr.dx = 0; ptr.dy = 0; }
  }

  /* ---- tekenen ---- */
  function draw() {
    const { far, midL, near, tree, clouds, grey } = built, L = day.light, warm = day.warm, cl = cloudy();
    g.setTransform(scale, 0, 0, scale, 0, 0);
    // lucht volgens uur en weer
    let top = mix('#18223c', '#86b6de', L), bot = mix('#2c3554', '#f4e6c6', L);
    top = mix(top, '#d9907a', warm * 0.45); bot = mix(bot, '#f2b880', warm * 0.6);
    top = mix(top, L > 0.3 ? '#a6aeb4' : '#2a2f3c', cl * 0.75); bot = mix(bot, L > 0.3 ? '#cfd3d2' : '#3a3f4c', cl * 0.7);
    if (kind() === 'fog') { top = mix(top, '#d7dad6', 0.6 * L + 0.2); bot = mix(bot, '#e2e3de', 0.6 * L + 0.2); }
    const sg = g.createLinearGradient(0, 0, 0, 150); sg.addColorStop(0, top); sg.addColorStop(1, bot); g.fillStyle = sg; g.fillRect(0, 0, W, 150);
    if (L < 0.6 && cl < 0.7) { const q = rng(5); g.fillStyle = `rgba(255,255,240,${(0.6 - L) * (1 - cl)})`; for (let i = 0; i < 30; i++) { const x = q() * W, y = q() * 90; g.fillRect(x, y, 0.8, 0.8); } }
    { const moon = L < 0.5, u = moon ? day.moon : day.sun, sx = 40 + u * (W - 80) - px * 1.5, sy = 96 - Math.sin(u * Math.PI) * 70, a = (1 - cl * 0.9) * (moon ? 1 - L : L);
      if (a > 0.02) { const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 40); gr.addColorStop(0, `rgba(255,248,225,${0.5 * a})`); gr.addColorStop(1, 'rgba(255,248,225,0)'); g.fillStyle = gr; g.fillRect(sx - 40, sy - 40, 80, 80); g.fillStyle = moon ? `rgba(240,240,225,${0.9 * a})` : `rgba(255,250,232,${0.95 * a})`; g.beginPath(); g.arc(sx, sy, moon ? 5.5 : 7, 0, TAU); g.fill(); } }
    built.cloudX.forEach((x, i) => { const y = 14 + i * 13, wa = clamp(cl * 1.4 + 0.25, 0, 1) * (1 - cl * 0.5), ga = cl * 0.9; g.globalAlpha = wa; g.drawImage(clouds[i].cv, x - px * 2, y, 90, 30); if (ga > 0.02) { g.globalAlpha = ga; g.drawImage(grey[i].cv, x - px * 2 + 4, y + 3, 90, 30); } g.globalAlpha = 1; });
    g.drawImage(far.cv, -PAD - px * 1.5, -py * 0.6, W + PAD * 2, H);
    g.drawImage(midL.cv, -PAD - px * 3.5, -py * 1.2, W + PAD * 2, H);
    const nx = -PAD - px * 6, ny = -py * 2;
    g.drawImage(near.cv, nx, ny, W + PAD * 2, H);
    g.save(); g.translate(nx + PAD, ny);
    // vijver: koi onder een waterfilm, kringen, drijvend blad
    g.save(); g.beginPath(); smooth(g, POND); g.clip();
    for (const k of koi) {
      const pts = k.sp, Lp = [], Rp = [];
      for (let i = 0; i < 6; i++) { const s = i / 5, [x, y] = pts[i], [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(5, i + 1)], dx = ax - bx, dy = ay - by, l = Math.hypot(dx, dy) || 1, wv = Math.sin(k.ph - i * 0.7) * 0.8 * s, wd = 3.1 * (s < 0.25 ? 0.7 + 0.3 * s / 0.25 : 1 - (s - 0.25) / 0.75 * 0.85); Lp.push([x - dy / l * (wd + wv), y + dx / l * (wd + wv) * 0.6]); Rp.push([x + dy / l * (wd - wv), y - dx / l * (wd - wv) * 0.6]); }
      g.fillStyle = k.col; g.globalAlpha = sz === 3 ? 0.5 : 0.85; g.beginPath(); g.moveTo(...Lp[0]); Lp.forEach(p => g.lineTo(...p)); for (let i = 5; i >= 0; i--) g.lineTo(...Rp[i]); g.closePath(); g.fill();
      if (k.col === '#f2efe6') { g.fillStyle = '#e45a2a'; g.beginPath(); g.ellipse(pts[1][0], pts[1][1], 1.8, 1.1, 0, 0, TAU); g.fill(); }
      const [tx, ty] = pts[5], [ux, uy] = pts[4], ta = Math.atan2(ty - uy, tx - ux) + Math.sin(k.ph) * 0.4; g.fillStyle = k.col; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(ta + 0.5) * 5, ty + Math.sin(ta + 0.5) * 3); g.lineTo(tx + Math.cos(ta - 0.5) * 5, ty + Math.sin(ta - 0.5) * 3); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    g.fillStyle = sz === 3 ? 'rgba(127,152,166,.35)' : 'rgba(106,162,184,.3)'; g.fillRect(80, 140, 240, 70);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.7; for (let i = 0; i < 10; i++) { const x = 110 + ((i * 41 + t * (2 + i % 3)) % 180), y = 160 + (i * 7 % 32), wl = 6 + (i % 4) * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + wl, y); g.stroke(); }
    for (const r of ripples) { const u = (t - r.at) / (r.rain ? 0.9 : 2), R = (r.rain ? 5 : r.big ? 18 : 10) * u + 1; g.strokeStyle = `rgba(255,255,255,${(r.rain ? 0.4 : 0.55) * (1 - u)})`; g.beginPath(); g.ellipse(r.x, r.y, R, R * 0.3, 0, 0, TAU); g.stroke(); }
    g.restore();
    // vallend en liggend blad
    for (const f of falls) { g.globalAlpha = Math.min(1, f.life * 3); g.fillStyle = f.col; g.save(); g.translate(f.x, f.y); g.rotate(f.a); if (f.k === 'snow') { g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); } else if (f.k === 'leaf') { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 1 : 2.4, a = i / 10 * TAU; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); } else { g.beginPath(); g.ellipse(0, 0, f.k === 'petal' ? 1.8 : 2.2, f.k === 'petal' ? 1.1 : 0.9, 0, 0, TAU); g.fill(); } g.restore(); }
    g.globalAlpha = 1;
    // vogeltje
    if (bird) { const hop = bird.hop && t - bird.hop < 0.15 ? -1 : 0, fl = bird.fly || bird.sit === 0, x = bird.x, y = bird.y + hop; g.fillStyle = '#5a5048'; g.beginPath(); g.ellipse(x, y - 2.2, 3, 2.1, 0, 0, TAU); g.fill(); g.fillStyle = '#1e1e22'; g.beginPath(); g.arc(x + 2.4, y - 3.8, 1.5, 0, TAU); g.fill(); g.fillStyle = '#f2f0ea'; g.beginPath(); g.arc(x + 2.6, y - 3.5, 0.7, 0, TAU); g.fill(); g.strokeStyle = '#3a342e'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 2.6, y - 2); g.lineTo(x - 5, y - 1); g.stroke(); if (fl) { const f = Math.sin(t * 30) * 3; g.beginPath(); g.moveTo(x - 1, y - 3); g.lineTo(x - 2, y - 5 - f); g.moveTo(x + 0.5, y - 3); g.lineTo(x + 0.5, y - 5.5 - f); g.stroke(); } }
    // vlinder en libel
    if (butterfly) { const f = Math.abs(Math.sin(butterfly.ph * 14)); g.fillStyle = butterfly.col; g.beginPath(); g.ellipse(butterfly.x - 1.6 * f, butterfly.y, 1.8 * f + 0.3, 2.2, -0.3, 0, TAU); g.ellipse(butterfly.x + 1.6 * f, butterfly.y, 1.8 * f + 0.3, 2.2, 0.3, 0, TAU); g.fill(); }
    if (dragon) { g.strokeStyle = '#2c6f8a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(dragon.x - 5, dragon.y); g.lineTo(dragon.x + 3, dragon.y); g.stroke(); g.fillStyle = `rgba(230,240,245,${0.45 + 0.2 * Math.sin(t * 40)})`; for (const [dx, dy] of [[0, -2], [0, 2], [-1.5, -1.8], [-1.5, 1.8]]) { g.beginPath(); g.ellipse(dragon.x + dx, dragon.y + dy, 3, 0.8, dy < 0 ? -0.4 : 0.4, 0, TAU); g.fill(); } }
    g.restore();
    // esdoorn op de voorgrond
    g.save(); g.translate(-12 - px * 8, -12 - py * 2.5); g.rotate(maple.a + 0.006 * Math.sin(t * 0.8)); g.drawImage(tree.cv, 0, 0, 176, 86); g.restore();
    // neerslag
    if (rain.length) { g.strokeStyle = 'rgba(220,230,240,.35)'; g.lineWidth = 0.6; g.beginPath(); for (const r of rain) { g.moveTo(r.x, r.y); g.lineTo(r.x + 1.6, r.y - 7); } g.stroke(); }
    if (flakes.length) { g.fillStyle = 'rgba(255,255,255,.85)'; for (const s of flakes) { g.beginPath(); g.arc(s.x, s.y, 0.9, 0, TAU); g.fill(); } }
    if (kind() === 'fog') { const fg = g.createLinearGradient(0, 80, 0, H); fg.addColorStop(0, 'rgba(230,232,228,.0)'); fg.addColorStop(0.4, 'rgba(230,232,228,.35)'); fg.addColorStop(1, 'rgba(230,232,228,.15)'); g.fillStyle = fg; g.fillRect(0, 0, W, H); }
    // licht over alles: nacht, schemer, grijs weer, een verre flits
    if (L < 1) { g.fillStyle = `rgba(14,20,40,${0.55 * (1 - L)})`; g.fillRect(0, 0, W, H); }
    if (warm > 0.02) { g.fillStyle = `rgba(255,150,80,${0.12 * warm})`; g.fillRect(0, 0, W, H); }
    if (cl > 0.5 && L > 0.3) { g.fillStyle = `rgba(110,120,130,${0.12 * (cl - 0.5) * 2})`; g.fillRect(0, 0, W, H); }
    if (flash > 0) { g.fillStyle = `rgba(230,235,255,${0.18 * flash})`; g.fillRect(0, 0, W, H); }
    // lantaarn en vuurvliegjes lichten op in het donker (boven de nachtlaag)
    if (lampLv > 0.02) { const a = lampLv * (0.35 + 0.65 * (1 - L)); const lx = LX + nx + PAD, ly = 137 + ny; g.fillStyle = `rgba(255,220,150,${0.9 * a})`; g.fillRect(lx - 3, ly - 2.5, 6, 5); const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 26); gr.addColorStop(0, `rgba(255,200,120,${0.35 * a})`); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(lx - 26, ly - 26, 52, 52); }
    if (sz === 1 && L < 0.4) for (const f of flies) { const a = (0.4 - L) * 2.5 * (0.5 + 0.5 * Math.sin(f.ph * 2.3)), x = f.x + nx + PAD, y = f.y + ny, gr = g.createRadialGradient(x, y, 0, x, y, 5); gr.addColorStop(0, `rgba(230,250,140,${0.9 * a})`); gr.addColorStop(1, 'rgba(200,240,110,0)'); g.fillStyle = gr; g.fillRect(x - 5, y - 5, 10, 10); }
    // korte uitleg, één keer per bezoek
    const hu = t - hintAt;
    if (hu >= 0 && hu < 7) {
      const a = Math.min(1, hu / 0.6, (7 - hu) / 0.8);
      g.font = '500 8.5px "Geist Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) g.letterSpacing = '1.2px';
      g.fillStyle = sz === 3 && L > 0.5 ? `rgba(40,46,56,${0.8 * a})` : `rgba(250,248,240,${0.85 * a})`; g.fillText(HINT, W / 2, H - 9);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.textAlign = 'start';
    }
  }

  return {
    own: true,
    onDark: true,
    get busy() { return false; },
    init() { seed(); },
    mount(el) {
      if (cv) return;
      scale = Math.min(2, window.devicePixelRatio || 1) * zoom;
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
      cv.style.width = `${W * zoom}px`; cv.style.height = `${H * zoom}px`;
      el.append(cv);
      g = cv.getContext('2d');
      sz = season(); sky = currentSky(); day = daylight(); skyAt = t;
      build();
      lastNow = 0;
      lampLv = lampOn() ? 1 : 0;
      for (let i = 0; i < 60; i++) step(1 / 30);
      if (reducedMotion.matches) { draw(); return; }
      if (!hinted) { hinted = true; hintAt = t + 0.4; }
    },
    unmount() { cv?.remove(); cv = null; g = null; built = null; ptr = null; lastTap = null; },
    frame(now) {
      if (!cv || reducedMotion.matches) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now;
      step(dt);
      draw();
    },
    move(p) { hover = { x: p.x, y: p.y, at: t }; },
    down(p) { ptr = { x: p.x, y: p.y, dx: 0, dy: 0 }; },
    // slepen: een windvlaag in de richting van de veeg
    drag(p) { if (!ptr) return; const dx = p.x - ptr.x; ptr.x = p.x; ptr.y = p.y; wind = clamp(wind + dx * 0.01, -1.2, 1.6); maple.v += dx * 0.0008; },
    up() { ptr = null; },
    tap(p) {
      if (bird && !bird.fly && Math.hypot(p.x - bird.x, p.y - bird.y + 3) < 14) { bird.fly = { at: t }; playTerra('hop', { x: -0.5 }); return; }
      if (lastTap && t - lastTap.t < 0.3 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) { lastTap = null; userLamp = !lampOn(); playTerra('lamp', { x: -0.5 }); return; }
      lastTap = { x: p.x, y: p.y, t };
    },
    leave() { ptr = null; hover.at = -99; },
    recolor() {},
  };
}
