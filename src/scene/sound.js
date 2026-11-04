/* ---- Geluid ---- */
// Klein en zacht, met Web Audio opgewekt (geen bestanden). Standaard aan; uit te zetten in Instellingen. De toonhoogte volgt
// het moment: Nu het hoogst, Ooit het laagst, telkens een noot uit dezelfde pentatonische toonladder.

const SOUND_KEY = 'priority-orbit.sound.v1';   // 'on' of 'off'
export const SOUND_STYLE = 'sonar';            // gekozen door Victor (04/11/2026, ronde 2 van de geluidsidentiteit), zie SOUNDS
const NOTES = [0, 1318.5, 1046.5, 880, 784, 659.3];   // per moment (1 = Nu): E6, C6, A5, G5, E5
const MELODY = [0, 2, 4, 7, 9, 7, 4, 2, 4, 9, 12, 9];   // halve tonen boven C6, voor 'melodie'

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
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
const P = { E3: 164.81, G3: 196, B3: 246.94, E4: 329.63, G4: 392, A4: 440, C5: 523.25, E5: 659.26, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5 };
const SONAR_NOTES = [0, P.E5, P.C5, P.A4, P.G4, P.E4];   // Nu .. Ooit
const ECHO = [0, 0.075, 0.115, 0.16, 0.22, 0.3];         // Nu .. Ooit: afstand tot de kern, in s
const DET = [0, 5, -4, 3, -6, 2, -2];                     // kleine vaste stemverschillen bij herhaling (cent)
const SONAR_GAIN = 0.504;

function soft(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.00001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0.00001, t + attack, decay / 5);
}
function ping(a, out, t, f, { g = 1, dur = 0.16, det = 0, lv = 3 } = {}) {
  const o = a.createOscillator(), e = a.createGain();
  o.frequency.value = f; o.detune.value = det;
  soft(e, t, 0.2 * g, 0.004, dur);
  const dl = a.createDelay(1), fb = a.createGain(), lp = a.createBiquadFilter(), wet = a.createGain();
  dl.delayTime.value = ECHO[lv] || ECHO[3]; fb.gain.value = 0.36;
  lp.type = 'lowpass'; lp.frequency.value = Math.min(2200, f * 2.2); wet.gain.value = 0.55;
  o.connect(e); e.connect(out); e.connect(dl); dl.connect(lp).connect(fb).connect(dl); lp.connect(wet).connect(out);
  o.start(t); o.stop(t + dur * 1.5 + 0.1);
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
    out.connect(a.destination);
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
export function playMonth() {
  cue((a, o, t) => {
    const N = 26, notes = [P.E6, P.C6, P.A5, P.G5, P.E5];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), at = 1.3 + 3.1 * Math.sqrt(u), k = Math.floor(((i * 7919) % 97) / 97 * 5);
      ping(a, o, t + at, notes[Math.min(4, k + Math.floor(u * 2))], { g: 0.16 + 0.12 * u, dur: 0.12, det: DET[i % DET.length] });
    }
    ping(a, o, t + 3.9, P.E3, { g: 0.85, dur: 1.4 });
    ping(a, o, t + 3.9, P.B3, { g: 0.42, dur: 1.2 });
    ping(a, o, t + 3.98, P.E4, { g: 0.26, dur: 1.0 });
  });
}

// level: 1..5 (toonhoogte en, bij sonar, de echo), n: hoeveelste ster (stemverschil, voor 'melodie')
export function playDone({ level = 3, n = 0, style = SOUND_STYLE, force = false } = {}) {
  if (style === 'sonar') { cue((a, o, t) => SOUNDS.sonar(a, o, t, 0, n, level), force); return; }
  if (!force && !soundOn()) return;
  const a = audio();
  if (!a) return;
  const out = a.createGain();
  out.gain.value = 0.9;
  out.connect(a.destination);
  (SOUNDS[style] || SOUNDS.glas)(a, out, a.currentTime + 0.01, NOTES[level] || NOTES[3], n);
}
