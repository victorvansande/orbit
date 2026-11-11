/* ---- Geluid ---- */
// Klein en zacht, met Web Audio opgewekt (geen bestanden). Standaard aan; uit te zetten in Instellingen. De toonhoogte volgt
// het moment: Nu het hoogst, Ooit het laagst, telkens een noot uit dezelfde pentatonische toonladder.

const SOUND_KEY = 'priority-orbit.sound.v1';   // 'on' of 'off'
export const SOUND_STYLE = 'sonar';            // gekozen door Victor (04/11/2026, ronde 2 van de geluidsidentiteit), zie SOUNDS
const NOTES = [0, 1318.5, 1046.5, 880, 784, 659.3];   // per moment (1 = Nu): E6, C6, A5, G5, E5
const MELODY = [0, 2, 4, 7, 9, 7, 4, 2, 4, 9, 12, 9];   // halve tonen boven C6, voor 'melodie'

let ctx = null, masterLimiter = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterLimiter = ctx.createDynamicsCompressor();
    masterLimiter.threshold.value = -3;
    masterLimiter.knee.value = 8;
    masterLimiter.ratio.value = 20;
    masterLimiter.attack.value = 0.002;
    masterLimiter.release.value = 0.12;
    masterLimiter.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// in een tik oproepen: start de audioklok, zodat geluid later (zonder nieuwe tik) mag spelen
export function unlockAudio() { if (soundOn()) audio(); }

export function soundOn() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }   // standaard aan (Victor miste het geluid)
}
export function setSound(on) {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* geen opslag */ }
  if (on) audio();   // in de klik zelf starten, anders blijft hij op iOS stil
}

// Een omhullende: snel aan, exponentieel uit
function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(a, out, { f, t, type = 'sine', peak = 0.2, attack = 0.004, decay = 0.5, detune = 0 }) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  env(g, t, peak, attack, decay);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + attack + decay + 0.05);
  return o;
}

function noise(a, seconds) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * seconds), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

export const SOUNDS = {
  // Zilverglas: een fijne tik tegen kristal (FM), past bij de zilveren ster
  glas(a, out, t, f) {
    const car = a.createOscillator(), mod = a.createOscillator(), mg = a.createGain(), g = a.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.08);
    mod.connect(mg).connect(car.frequency);
    env(g, t, 0.18, 0.002, 0.16);
    car.connect(g).connect(out);
    car.start(t); mod.start(t); car.stop(t + 0.2); mod.stop(t + 0.2);
  },
  // Rasterregen: drie piepkleine tikjes vlak na elkaar, zoals de golf door de puntjes, met een toontje als slot
  raster(a, out, t, f) {
    [0, 0.028, 0.048].forEach((dt, i) => {
      const src = noise(a, 0.015), bp = a.createBiquadFilter(), g = a.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 3200 + i * 700; bp.Q.value = 10;
      env(g, t + dt, 0.25, 0.001, 0.012);
      src.connect(bp).connect(g).connect(out);
      src.start(t + dt); src.stop(t + dt + 0.02);
    });
    tone(a, out, { f, t: t + 0.062, peak: 0.12, attack: 0.002, decay: 0.1 });
  },
  // Komeet: een korte zoef, meteen gevolgd door een stip
  komeet(a, out, t, f) {
    const src = noise(a, 0.12), bp = a.createBiquadFilter(), g = a.createGain();
    bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(6000, t); bp.frequency.exponentialRampToValueAtTime(1500, t + 0.07);
    env(g, t, 0.08, 0.02, 0.06);
    src.connect(bp).connect(g).connect(out);
    src.start(t); src.stop(t + 0.12);
    tone(a, out, { f, t: t + 0.07, peak: 0.13, attack: 0.002, decay: 0.11 });
  },
  // Sterrenmelodie: elke afgevinkte taak de volgende noot van een vast deuntje, als een korte marimbatik
  melodie(a, out, t, f, n) {
    const fm = 1046.5 * Math.pow(2, MELODY[n % MELODY.length] / 12) / 2;
    tone(a, out, { f: fm, t, peak: 0.22, attack: 0.001, decay: 0.14 });
    tone(a, out, { f: fm * 4, t, peak: 0.05, attack: 0.001, decay: 0.03 });
  },
  // Kalimba: een getokkelde snaar (Karplus-Strong), snel gedempt
  kalimba(a, out, t, f) {
    const fk = f / 2, len = Math.round(a.sampleRate / fk), dur = 0.22;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
    for (let i = len; i < d.length; i++) d[i] = 0.975 * 0.5 * (d[i - len] + d[i - len + 1]);
    const src = a.createBufferSource(), lp = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 3200;
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp).connect(g).connect(out);
    src.start(t);
  },
  // Baken: twee blipjes, een kwint omhoog, als een computer die "klaar" zegt
  baken(a, out, t, f) {
    const fb = f / 2;
    tone(a, out, { f: fb, t, peak: 0.1, attack: 0.003, decay: 0.045 });
    tone(a, out, { f: fb * 1.5, t: t + 0.06, peak: 0.11, attack: 0.003, decay: 0.09 });
  },
};

/* ---- Sonar (Victor, 04/11/2026, uit ronde 2: ontwerp/geluid/ronde2.html) ----
   Een korte ping met echo's die donkerder wegsterven. De echo staat voor de afstand tot de kern: bij Nu komt ze meteen
   terug, bij Ooit pas na een derde seconde. Toonhoogte uit dezelfde pentatonische reeks, een octaaf lager dan vroeger.
   Elke toon wordt zacht aangezet en loopt exponentieel uit, nooit een sprong. Genormaliseerd zodat het afvinken net als
   baken piekt op ongeveer -20 dBFS (gemeten met OfflineAudioContext). Geluid krijgen enkel: afvinken, prestatie, nieuwe
   rang, zandloper klaar en de maandwissel. */
const P = { E2: 82.41, E3: 164.81, G3: 196, B3: 246.94, D4: 293.66, E4: 329.63, Fs4: 369.99, G4: 392, A4: 440, B4: 493.88, C5: 523.25, E5: 659.26, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.5 };
const SONAR_NOTES = [0, P.E5, P.C5, P.A4, P.G4, P.E4];   // Nu .. Ooit
const ECHO = [0, 0.075, 0.115, 0.16, 0.22, 0.3];         // Nu .. Ooit: afstand tot de kern, in s
const DET = [0, 5, -4, 3, -6, 2, -2];                     // kleine vaste stemverschillen bij herhaling (cent)
const SONAR_GAIN = 0.504;

function soft(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.00001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0.00001, t + attack, decay / 5);
}
// echo, fb, wet en att overschrijven de gewone sonar (de maandwissel gebruikt kortere en langere echo's)
function ping(a, out, t, f, { g = 1, dur = 0.16, det = 0, lv = 3, echo, fb: fbk = 0.36, wet: wg = 0.55, att = 0.004 } = {}) {
  const o = a.createOscillator(), e = a.createGain();
  o.frequency.value = f; o.detune.value = det;
  soft(e, t, 0.2 * g, att, dur);
  o.connect(e); e.connect(out);
  if (echo !== 0) {
    const dl = a.createDelay(1), fb = a.createGain(), lp = a.createBiquadFilter(), wet = a.createGain();
    dl.delayTime.value = echo || ECHO[lv] || ECHO[3]; fb.gain.value = fbk;
    lp.type = 'lowpass'; lp.frequency.value = Math.min(2200, f * 2.2); wet.gain.value = wg;
    e.connect(dl); dl.connect(lp).connect(fb).connect(dl); lp.connect(wet).connect(out);
  }
  const stopT = t + att + dur * 1.5 + 0.1;
  e.gain.setValueAtTime(0.00001, stopT - 0.015);
  e.gain.linearRampToValueAtTime(0, stopT);
  o.start(t); o.stop(stopT);
}
SOUNDS.sonar = (a, out, t, f, n, level = 3) => ping(a, out, t, SONAR_NOTES[level] || P.A4, { det: DET[n % DET.length], g: 1 - 0.05 * (n % 3), lv: level });

// Speelt een reeks pings; enkel als het geluid aan staat. Een browser laat geluid pas toe na een tik: zolang de audioklok
// stilstaat, wachtte alles en kwam het er pas bij de volgende tik uit (de maandwissel klonk na haar animatie, Victor,
// 04/11/2026). Wat niet meteen kan, valt nu weg in plaats van te laat te komen.
// Wanneer er echt geluid speelde (cue), voor het stilknopje: soundBurst(ms) = hoeveel geluiden in de laatste ms.
const played = [];
export function soundBurst(ms = 20000) {
  const from = performance.now() - ms;
  while (played.length && played[0] < from) played.shift();
  return played.length;
}
function cue(fn, force = false, gain = SONAR_GAIN) {
  if (!force && !soundOn()) return;
  const a = audio();
  if (!a) return;
  const go = () => {
    played.push(performance.now());
    const out = a.createGain();
    out.gain.value = gain;
    out.connect(masterLimiter || a.destination);
    fn(a, out, a.currentTime + 0.02);
  };
  if (a.state === 'running') { go(); return; }
  const asked = performance.now();   // in een klik start de klok binnen enkele ms; later is te laat
  a.resume().then(() => { if (a.state === 'running' && performance.now() - asked < 250) go(); }).catch(() => {});
}
// prestatie: Sonar plus (Victor, 04/11/2026, uit ronde 3: ontwerp/geluid/prestatie3.html). De ping van afvinken, uitgewerkt:
// een zachte boventoon, een echo die links en rechts terugkaatst, en per niveau meer tonen (brons één, zilver een kwint, goud
// een akkoord C-E-G licht uitgewaaierd, platina met een glinstering D7 erboven). Door een productieketen: hoogdoorlaat,
// zachte hoge plank, een kleine kamer als galm en lichte stereobreedte. Zilver piekt op ongeveer -21 dBFS.
const FEAT_GAIN = 0.59;
const FEAT_CHORDS = { 1: [P.C5], 2: [P.C5, P.G5], 3: [P.C5, P.E5, P.G5], 4: [P.C5, P.E5, P.G5] };
const roomCache = new WeakMap();
function room(a, secs = 1.1) {   // synthetische impulsrespons van een kleine kamer, stereo, donkerder naarmate ze uitsterft
  if (roomCache.has(a)) return roomCache.get(a);
  const sr = a.sampleRate, len = Math.ceil(sr * secs), ir = a.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let x = 1234 + ch * 777, lp = 0;
    for (let i = 0; i < len; i++) {
      x = (x * 16807) % 2147483647; const u = i / len;
      lp += (x / 2147483647 * 2 - 1 - lp) * (0.55 - 0.45 * u);
      d[i] = (i < sr * 0.012 ? 0 : lp) * Math.pow(1 - u, 3.2);   // 12 ms voor de eerste weerkaatsing
    }
  }
  roomCache.set(a, ir);
  return ir;
}
function chain(a, out, wetK) {
  const inp = a.createGain(), hp = a.createBiquadFilter(), hs = a.createBiquadFilter(), conv = a.createConvolver(), wet = a.createGain();
  hp.type = 'highpass'; hp.frequency.value = 150; hp.Q.value = 0.6;
  hs.type = 'highshelf'; hs.frequency.value = 6500; hs.gain.value = -4;
  conv.buffer = room(a); wet.gain.value = wetK;
  inp.connect(hp).connect(hs); hs.connect(out); hs.connect(conv).connect(wet).connect(out);
  return inp;
}
function panned(a, out, x) { if (!a.createStereoPanner) return out; const p = a.createStereoPanner(); p.pan.value = x; p.connect(out); return p; }
function sonarPlus(a, out, t, f, { g = 1, dur = 0.5, x = 0 } = {}) {
  const o2 = panned(a, out, x), o = a.createOscillator(), h = a.createOscillator(), e = a.createGain(), he = a.createGain();
  o.frequency.value = f; h.frequency.value = f * 2;
  soft(e, t, 0.12 * g, 0.003, dur); soft(he, t, 0.025 * g, 0.002, dur * 0.4);
  o.connect(e); h.connect(he).connect(e); e.connect(o2);
  if (a.createStereoPanner) {   // echo die links en rechts terugkaatst
    const dL = a.createDelay(1), dR = a.createDelay(1), fb = a.createGain(), lp = a.createBiquadFilter(), pL = a.createStereoPanner(), pR = a.createStereoPanner();
    dL.delayTime.value = 0.16; dR.delayTime.value = 0.16; fb.gain.value = 0.38;
    lp.type = 'lowpass'; lp.frequency.value = Math.min(2400, f * 2.4);
    pL.pan.value = -0.7; pR.pan.value = 0.7;
    e.connect(dL); dL.connect(lp).connect(pL).connect(out); lp.connect(dR); dR.connect(pR).connect(out); dR.connect(fb).connect(dL);
  }
  o.start(t); h.start(t); o.stop(t + dur * 1.5 + 0.1); h.stop(t + dur * 1.5 + 0.1);
}
export function playFeat(tier = 'silver') {
  const k = { bronze: 1, silver: 2, gold: 3, platinum: 4 }[tier] || 2;
  cue((a, o, t) => {
    const out = chain(a, o, 0.2), notes = FEAT_CHORDS[k];
    notes.forEach((f, i) => sonarPlus(a, out, t + i * 0.05, f, { g: i ? 0.62 : 1, x: (i - (notes.length - 1) / 2) * 0.35 }));
    if (k === 4) sonarPlus(a, out, t + 0.22, 2349.3, { g: 0.28, x: 0.3 });
  }, false, FEAT_GAIN);
}
// nieuwe rang: een lage toon bij het oude teken, en een zachte kwint met een glinstering als de nieuwe stip landt (land in s)
export function playRank(land = 2.2) {
  cue((a, o, t) => {
    if (land > 0.3) ping(a, o, t, P.G3, { g: 0.5, dur: 0.6 });
    ping(a, o, t + land, P.C5, { g: 0.85, dur: 0.45 });
    ping(a, o, t + land, P.G5, { g: 0.42, dur: 0.5 });
    ping(a, o, t + land + 0.16, P.E6, { g: 0.18, dur: 0.6 });
  });
}
// wiel van de momenten: een heel zacht, droog klikje per moment dat je voorbijdraait, zoals de nok van een draaiknop
// (Victor, 04/11/2026; eerst een toontje in de toon van het moment met echo, "in de goede richting, maar nog iets te
// speels"). Voor elk moment hetzelfde, geen echo: een kort tikje ruis met een klein, laag lijfje eronder. Ongeveer 18 dB
// zachter dan afvinken, en nooit sneller dan om de 45 ms, zodat snel draaien geen ratel wordt.
let lastTick = 0, tickNoise = null;
export function playTick() {
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;
  cue((a, out, t) => {
    if (!tickNoise || tickNoise.sampleRate !== a.sampleRate) {
      tickNoise = a.createBuffer(1, Math.ceil(a.sampleRate * 0.03), a.sampleRate);
      const d = tickNoise.getChannelData(0); let x = 9871;
      for (let i = 0; i < d.length; i++) { x = (x * 16807) % 2147483647; d[i] = x / 2147483647 * 2 - 1; }
    }
    const n = a.createBufferSource(), bp = a.createBiquadFilter(), ne = a.createGain();
    n.buffer = tickNoise; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.4;
    soft(ne, t, 0.046, 0.0008, 0.012);
    n.connect(bp).connect(ne).connect(out); n.start(t); n.stop(t + 0.03);
    const o = a.createOscillator(), e = a.createGain();
    o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(480, t + 0.02);
    soft(e, t, 0.013, 0.001, 0.022);
    o.connect(e).connect(out); o.start(t); o.stop(t + 0.06);
  });
}
// tik op de kern: een heel zacht, traag aanzwellend akkoord dat lang uitademt (Victor, 04/11/2026: "heel zacht,
// geleidelijk, super soothing"). Laag (G3, D4) met een fluistering E5 erboven, elke toon als twee stemmen een paar cent uit
// elkaar, door een laagdoorlaat die mee opent en weer sluit; een vage echo voor ruimte. Ongeveer 9 dB zachter dan afvinken
// (piek rond -29 dBFS), uitgeademd na ongeveer 5 s.
export function playCore() {
  cue((a, out, t) => {
    const lp = a.createBiquadFilter(), bus = a.createGain();
    lp.type = 'lowpass'; lp.Q.value = 0.3;
    lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(1500, t + 0.7); lp.frequency.setTargetAtTime(420, t + 0.9, 0.7);
    bus.gain.setValueAtTime(0.00001, t); bus.gain.linearRampToValueAtTime(1, t + 0.6); bus.gain.setTargetAtTime(0.00001, t + 0.8, 0.75);
    const dl = a.createDelay(1), fb = a.createGain(), wet = a.createGain();
    dl.delayTime.value = 0.28; fb.gain.value = 0.3; wet.gain.value = 0.35;
    lp.connect(bus); bus.connect(out); bus.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(out);
    [[P.G3, 0.021], [293.66, 0.015], [P.E5, 0.003]].forEach(([f, amp]) => [-5, 5].forEach(det => {
      const o = a.createOscillator(), k = a.createGain();
      o.frequency.value = f; o.detune.value = det; k.gain.value = amp;
      o.connect(k).connect(lp); o.start(t); o.stop(t + 7);
    }));
  });
}
// zandloper klaar: drie keer dezelfde toon, telkens zachter, zoals een rustige keukenwekker
export function playTimer() {
  cue((a, o, t) => [0, 0.62, 1.24].forEach((dt, i) => ping(a, o, t + dt, P.A4, { g: 1.12 - 0.22 * i })));
}
// maandwissel: een piepklein tikje per ster die in de kern valt, steeds sneller (1,3 tot 4,4 s), en op 3,9 s bij het witte
// licht één lage, warme samenklank. Zelfde tijdlijn als scene.monthTurn en whiteBurst.
/* ---- Maandwissel: vier uitwerkingen (Victor, 04/11/2026, src/scene/turn.js) ----
   Het geluid leest dezelfde tijdlijn als het beeld: elk tikje valt op het moment dat een ster de kern bereikt, het akkoord
   op het moment dat het licht begint. Verfijnd tegenover de voorstellen: tikjes die minder dan 45 ms na elkaar zouden
   vallen, worden er één (een iets voller tikje), zodat een volle hemel niet zoemt; elk tikje komt links of rechts uit,
   waar de ster aankomt; en de vertraging van het toestel (Bluetooth) wordt opgevangen door het beeld iets later te laten
   beginnen (`audioLead`), niet door het geluid te laat te laten komen. */
// Breakout (Victor, 09/11/2026: "geluidjes toevoegen aan breakout"): kleine, droge blipjes zoals een oude buis, maar zacht
// en rond (sinus en driehoek door een laagdoorlaat, geen schelle blokgolf), zodat ze naast de rest van Orbit passen.
// kind: 'paddle', 'brick' (lv: rij 0 tot 5, hogere rij hoger), 'hard' (harde steen, eerste tik), 'steel', 'power',
// 'life' (bal kwijt), 'clear' (level voltooid), 'over'. x: -1 links tot 1 rechts. Per soort nooit sneller dan om de 40 ms,
// zodat een regen van stenen geen ratel wordt; enkel als het tabblad zichtbaar is.
const BREAK_GAIN = 0.42;
const BREAK_NOTES = [P.E5, P.G5, P.A5, P.C6, P.D6, P.E6];
const breakLast = {};
function blip(a, out, t, f, { type = 'triangle', g = 1, dur = 0.07, glide = 1, lp = 3200 } = {}) {
  const o = a.createOscillator(), e = a.createGain(), f2 = a.createBiquadFilter();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glide !== 1) o.frequency.exponentialRampToValueAtTime(f * glide, t + dur);
  f2.type = 'lowpass'; f2.frequency.value = lp; f2.Q.value = 0.5;
  soft(e, t, 0.11 * g, 0.002, dur);
  o.connect(f2).connect(e).connect(out);
  o.start(t); o.stop(t + dur * 1.6 + 0.05);
}
export function playBreak(kind, { lv = 0, x = 0 } = {}) {
  if (document.hidden) return;
  const now = performance.now();
  if (now - (breakLast[kind] || 0) < 40) return;
  breakLast[kind] = now;
  cue((a, o, t) => {
    const out = panned(a, o, Math.max(-0.6, Math.min(0.6, x * 0.6)));
    switch (kind) {
      case 'paddle': blip(a, out, t, P.C5, { g: 0.9, dur: 0.06, glide: 0.94, lp: 2200 }); break;
      case 'brick': blip(a, out, t, BREAK_NOTES[Math.max(0, Math.min(5, lv))] || P.A5, { type: 'sine', g: 0.85, dur: 0.08 }); break;
      case 'hard': blip(a, out, t, P.B4, { g: 0.7, dur: 0.05, lp: 1800 }); break;
      case 'steel': blip(a, out, t, 1760, { type: 'sine', g: 0.35, dur: 0.04 }); blip(a, out, t, 2637, { type: 'sine', g: 0.18, dur: 0.05 }); break;
      case 'power': [P.C5, P.E5, P.G5, P.C6].forEach((f, i) => blip(a, out, t + i * 0.055, f, { type: 'sine', g: 0.7, dur: 0.09 })); break;
      case 'life': [P.E5, P.C5, P.A4].forEach((f, i) => blip(a, out, t + i * 0.11, f, { g: 0.75, dur: 0.14, glide: 0.97, lp: 1600 })); break;
      case 'clear': [P.C5, P.E5, P.G5, P.C6, P.E6].forEach((f, i) => blip(a, out, t + i * 0.07, f, { type: 'sine', g: 0.75, dur: i === 4 ? 0.4 : 0.1 })); break;
      case 'over': [P.G4, P.E4, P.C5 / 2].forEach((f, i) => blip(a, out, t + i * 0.22, f, { g: 0.8, dur: i === 2 ? 0.6 : 0.2, lp: 1400 })); break;
    }
  }, false, BREAK_GAIN);
}

// hoeveel ms het beeld moet wachten zodat geluid en beeld samen uit het toestel komen (luidspreker of Bluetooth)
export function audioLead() {
  if (!soundOn() || !ctx) return 60;
  const lat = (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
  return Math.round(Math.min(320, 60 + lat));
}
function panTo(a, out, p) {
  if (!a.createStereoPanner) return out;
  const n = a.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); n.connect(out);
  return n;
}
// slot van Z1 tot Z3, in de geest van Z4 (Victor, 11/11/2026: "die serene vibe"): een akkoord dat al stil begint terwijl de
// kern inademt, bij het licht openbloeit achter een lage doorlaat en lang uitademt. Elke stem staat vanaf haar start op een
// vaste sterkte en de enige omhullende begint op 0: geen tik bij het begin. (Vroeger begonnen stemmen 2 tot 4 tot 36 ms vóór
// hun omhullende op volle sterkte, de "pop" die door de begrenzer klonk alsof het clipte.)
function monthSwell(a, out, tL, notes, { inhale = 0.4, bloom = 0.5, open = 1700, hold = 0.3, tail = 1.1, g = 0.8, rest = 520 } = {}) {
  const t = tL - inhale, lp = a.createBiquadFilter(), v = a.createGain();
  lp.type = 'lowpass'; lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(240, t); lp.frequency.exponentialRampToValueAtTime(600, tL);
  lp.frequency.exponentialRampToValueAtTime(open, tL + bloom); lp.frequency.setTargetAtTime(rest, tL + bloom + hold, tail * 1.3);
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.3 * g, tL); v.gain.linearRampToValueAtTime(g, tL + bloom);
  v.gain.setValueAtTime(g, tL + bloom + hold); v.gain.setTargetAtTime(0, tL + bloom + hold, tail);
  lp.connect(v).connect(out);
  const end = tL + bloom + hold + tail * 7;
  for (const [f, gg] of notes) for (const det of [-5, 5]) {
    const os = a.createOscillator(), e = a.createGain();
    os.frequency.value = f; os.detune.value = det; e.gain.value = gg;
    os.connect(e).connect(lp); os.start(t); os.stop(end);
  }
}
// een tikje per ster die aankomt, steeds lager naarmate de kern voller wordt; te dicht op elkaar wordt één tikje
function monthTicks(a, out, t0, arrivals) {
  const notes = [P.E6, P.D6, P.C6, P.A5, P.G5, P.E5];
  let last = -1, extra = 0, n = 0;   // eerste tikje altijd
  const bus = a.createGain();
  bus.gain.value = 0.75;
  bus.connect(out);
  for (let i = 0; i < arrivals.length; i++) {
    const x = arrivals[i], u = x.u;
    if (x.t - last < 0.045) { extra++; continue; }
    ping(a, panTo(a, bus, 0.5 * Math.cos(x.a || 0)), t0 + x.t, notes[Math.min(5, Math.floor(u * 6))],
      { g: Math.min(0.38, (0.16 + 0.12 * u) * (1 + 0.08 * Math.min(extra, 3))), dur: 0.07, echo: 0.06, fb: 0.14, wet: 0.28, det: DET[n++ % DET.length] });
    last = x.t; extra = 0;
  }
}
// slotakkoorden: elk een eigen kleur in E, geen kopie van Z4 (dat E3 B3 E4 G4 houdt)
const OPEN = [[P.E3, 0.13], [P.B3, 0.085], [P.E4, 0.05], [P.B4, 0.02]];      // Z1: lege kwinten, wat overblijft na de slokken
const STARRY = [[P.E3, 0.12], [P.B3, 0.08], [P.Fs4, 0.045], [P.A4, 0.03]];   // Z3: zwevend (sus), sluit aan op de pings E5 en A4
const WARM = [[P.E3, 0.12], [P.B3, 0.075], [P.D4, 0.05], [P.G4, 0.025]];     // Z2: warm (Em7) na het draaien
const MONTH = {
  // Z1 Opgeslokt: tikjes op de slokken; terwijl de kern inademt begint het akkoord stil en bloeit het met het licht open
  slok(a, o, t0, pl) {
    monthTicks(a, o, t0, pl.arrivals);
    monthSwell(a, o, t0 + pl.light, OPEN, { inhale: 0.38 });
    ping(a, o, t0 + pl.light + 0.3, P.E6, { g: 0.08, dur: 0.7, echo: 0.3, fb: 0.4, att: 0.12 });
  },
  // Z2 Draaikolk: geen wind meer (Victor, 11/11/2026: "te druk, ongezellige wind") maar een zachte toon die met de schijf
  // meedraait: hij pulseert en zwaait van links naar rechts, steeds sneller (1 naar 6 keer per seconde), terwijl de doorlaat
  // opengaat; een lage toon eronder glijdt van E2 naar E3. Vlak voor het dichtknijpen ademt alles weg, dan bloeit het akkoord.
  kolk(a, o, t0, pl) {
    const C = pl.collapse, T = x => t0 + x, s0 = 0.9;
    const lfo = a.createOscillator(), depth = a.createGain(), am = a.createGain(), lp = a.createBiquadFilter(), v = a.createGain();
    lfo.frequency.setValueAtTime(1, T(s0)); lfo.frequency.exponentialRampToValueAtTime(2.2, T(3)); lfo.frequency.exponentialRampToValueAtTime(6, T(C));
    depth.gain.setValueAtTime(0.15, T(s0)); depth.gain.linearRampToValueAtTime(0.35, T(C));
    am.gain.value = 0.62; lfo.connect(depth).connect(am.gain);
    lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(300, T(s0)); lp.frequency.exponentialRampToValueAtTime(1100, T(C));
    v.gain.setValueAtTime(0, T(s0)); v.gain.linearRampToValueAtTime(0.45, T(3)); v.gain.linearRampToValueAtTime(0.75, T(C - 0.35));
    v.gain.linearRampToValueAtTime(0, T(C - 0.02));
    let tail = v;
    if (a.createStereoPanner) {
      const pan = a.createStereoPanner(), sway = a.createGain();
      sway.gain.setValueAtTime(0.1, T(s0)); sway.gain.linearRampToValueAtTime(0.4, T(C));
      lfo.connect(sway).connect(pan.pan); v.connect(pan); tail = pan;
    }
    am.connect(lp).connect(v); tail.connect(o);
    for (const [f, gg] of [[P.E3, 0.1], [P.B3, 0.06], [P.E4, 0.03]]) for (const det of [-6, 6]) {
      const os = a.createOscillator(), e = a.createGain();
      os.frequency.value = f; os.detune.value = det; e.gain.value = gg;
      os.connect(e).connect(am); os.start(T(s0)); os.stop(T(C + 0.1));
    }
    lfo.start(T(s0)); lfo.stop(T(C + 0.1));
    const lo = a.createOscillator(), lg = a.createGain();
    lo.frequency.setValueAtTime(P.E2, T(1.2)); lo.frequency.exponentialRampToValueAtTime(P.E3, T(C));
    lg.gain.setValueAtTime(0, T(1.2)); lg.gain.linearRampToValueAtTime(0.045, T(C - 0.35)); lg.gain.linearRampToValueAtTime(0, T(C - 0.02));
    lo.connect(lg).connect(o); lo.start(T(1.2)); lo.stop(T(C + 0.1));
    monthSwell(a, o, T(C), WARM, { inhale: 0.08, bloom: 0.6, open: 1500, hold: 0.25, tail: 1.2, g: 0.95 });
  },
  // Z3 Sterrenbeeld: een zachte ping per laag die zich tekent, een tikje per kraal die de kern bereikt, dan bloeit het akkoord
  beeld(a, o, t0, pl) {
    pl.layers.forEach((tl, d) => ping(a, o, t0 + tl, d % 2 ? P.A4 : P.E5, { g: Math.max(0.12, 0.32 - 0.012 * d), dur: 0.14, echo: 0.22, fb: 0.4, wet: 0.6 }));
    monthTicks(a, o, t0, pl.arrivals);
    monthSwell(a, o, t0 + pl.light, STARRY, { inhale: 0.38, bloom: 0.6, open: 1900, tail: 1.3, g: 0.88 });
  },
  // Z4 Inademen: één lang akkoord dat zwelt en zich opent terwijl de hemel inzakt, vasthoudt, en bij het uitademen opengaat
  adem(a, o, t0, pl) {
    const T = x => t0 + x, lp = a.createBiquadFilter(), g = a.createGain();
    lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(240, T(1.1)); lp.frequency.exponentialRampToValueAtTime(1100, T(pl.inEnd)); lp.frequency.setValueAtTime(1100, T(pl.light));
    lp.frequency.exponentialRampToValueAtTime(3200, T(pl.light + 0.3)); lp.frequency.setTargetAtTime(600, T(pl.light + 0.5), 1.2);
    g.gain.setValueAtTime(0.0001, T(1.1)); g.gain.linearRampToValueAtTime(0.7, T(pl.inEnd)); g.gain.linearRampToValueAtTime(0.62, T(pl.light));
    g.gain.linearRampToValueAtTime(1, T(pl.light + 0.2)); g.gain.setTargetAtTime(0.0001, T(pl.light + 0.3), 0.9);
    lp.connect(g).connect(o);
    for (const [f, gg] of [[P.E3, 0.14], [P.B3, 0.09], [P.E4, 0.06], [P.G4, 0.025]]) for (const det of [-5, 5]) {
      const os = a.createOscillator(), e = a.createGain();
      os.frequency.value = f; os.detune.value = det; e.gain.value = gg;
      os.connect(e).connect(lp); os.start(T(1.1)); os.stop(T(pl.light + 6));
    }
    ping(a, o, T(pl.light + 0.12), P.E6, { g: 0.1, dur: 0.8, echo: 0.3, fb: 0.42, att: 0.08 });
  },
};
// pl: de tijdlijn uit turnPlan; at: performance.now()-tijd waarop het beeld begint (scene.monthTurn met t0)
export function playMonth(pl, at = performance.now()) {
  if (!pl || !MONTH[pl.style]) return;
  cue((a, o) => {
    const lat = a.outputLatency || a.baseLatency || 0;
    const t0 = a.currentTime + (at - performance.now()) / 1000 - lat;
    MONTH[pl.style](a, o, Math.max(a.currentTime - 0.3, t0), pl);   // net voorbij: de eerste tellen zijn stil, de rest valt juist
  });
}

// level: 1..5 (toonhoogte en, bij sonar, de echo), n: hoeveelste ster (stemverschil, voor 'melodie')
export function playDone({ level = 3, n = 0, style = SOUND_STYLE, force = false } = {}) {
  if (style === 'sonar') { cue((a, o, t) => SOUNDS.sonar(a, o, t, 0, n, level), force); return; }
  // andere klank (bv. het geschenk Zilverglas): ook via cue, zodat het stilknopje telt en een stille audioklok niets uitstelt
  cue((a, o, t) => (SOUNDS[style] || SOUNDS.glas)(a, o, t, NOTES[level] || NOTES[3], n), force, 0.6);   // 0,6: even luid als de sonarping (piek rond 0,1)
}
