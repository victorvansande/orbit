/* ---- Geluid bij afvinken ---- */
// Klein en zacht, met Web Audio opgewekt (geen bestanden). Standaard aan; uit te zetten in Instellingen. De toonhoogte volgt
// het moment: Nu het hoogst, Ooit het laagst, telkens een noot uit dezelfde pentatonische toonladder.

const SOUND_KEY = 'priority-orbit.sound.v1';   // 'on' of 'off'
export const SOUND_STYLE = 'baken';            // gekozen door Victor, zie SOUNDS
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

// level: 1..5 (toonhoogte), n: hoeveelste ster (voor 'melodie')
export function playDone({ level = 3, n = 0, style = SOUND_STYLE, force = false } = {}) {
  if (!force && !soundOn()) return;
  const a = audio();
  if (!a) return;
  const out = a.createGain();
  out.gain.value = 0.9;
  out.connect(a.destination);
  (SOUNDS[style] || SOUNDS.glas)(a, out, a.currentTime + 0.01, NOTES[level] || NOTES[3], n);
}
