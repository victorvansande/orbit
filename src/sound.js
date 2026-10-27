/* ---- Geluid bij afvinken ---- */
// Klein en zacht, met Web Audio opgewekt (geen bestanden). Standaard uit; aan in Instellingen. De toonhoogte volgt
// het moment: Nu het hoogst, Ooit het laagst, telkens een noot uit dezelfde pentatonische toonladder.

const SOUND_KEY = 'priority-orbit.sound.v1';   // 'on' of 'off'
export const SOUND_STYLE = 'glas';             // gekozen klank, zie SOUNDS
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
  try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; }
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
  // Zilverglas: een fijne FM-bel, zoals een tik tegen een kristallen glas; past bij de zilveren ster
  glas(a, out, t, f) {
    const car = a.createOscillator(), mod = a.createOscillator(), mg = a.createGain(), g = a.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.9);
    mod.connect(mg).connect(car.frequency);
    env(g, t, 0.16, 0.003, 1.3);
    car.connect(g).connect(out);
    car.start(t); mod.start(t); car.stop(t + 1.4); mod.stop(t + 1.4);
    tone(a, out, { f: f * 2.76, t, peak: 0.03, decay: 0.5 });
  },
  // Rasterregen: tikjes die versnellen zoals de golf door de puntjes van de kern, met een zachte toon als slot
  raster(a, out, t, f) {
    let at = t;
    for (let i = 0; i < 8; i++) {
      const src = noise(a, 0.02), bp = a.createBiquadFilter(), g = a.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2600 + i * 380; bp.Q.value = 9;
      env(g, at, 0.22 - i * 0.015, 0.001, 0.02);
      src.connect(bp).connect(g).connect(out);
      src.start(at); src.stop(at + 0.03);
      at += 0.055 * Math.pow(0.82, i);
    }
    tone(a, out, { f, t: at + 0.01, peak: 0.12, decay: 0.6 });
    tone(a, out, { f: f * 2, t: at + 0.01, peak: 0.03, decay: 0.3 });
  },
  // Komeet: een zachte zoef die voorbijkomt (gefilterde ruis die zakt), dan een heldere stip
  komeet(a, out, t, f) {
    const src = noise(a, 0.5), bp = a.createBiquadFilter(), g = a.createGain();
    bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(5200, t); bp.frequency.exponentialRampToValueAtTime(700, t + 0.38);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    src.connect(bp).connect(g).connect(out);
    src.start(t); src.stop(t + 0.5);
    tone(a, out, { f, t: t + 0.3, peak: 0.13, decay: 0.7 });
    tone(a, out, { f: f * 1.5, t: t + 0.3, peak: 0.025, decay: 0.4 });
  },
  // Sterrenmelodie: elke afgevinkte taak speelt de volgende noot van een vast deuntje (marimba). Je dag wordt een liedje.
  melodie(a, out, t, f, n) {
    const fm = 1046.5 * Math.pow(2, MELODY[n % MELODY.length] / 12) / 2;
    tone(a, out, { f: fm, t, peak: 0.2, attack: 0.002, decay: 0.55 });
    tone(a, out, { f: fm * 4, t, peak: 0.05, attack: 0.001, decay: 0.08 });
    tone(a, out, { f: fm * 10, t, peak: 0.012, attack: 0.001, decay: 0.03 });
  },
  // Kalimba: een getokkelde snaar (Karplus-Strong), warm en houterig
  kalimba(a, out, t, f) {
    const fk = f / 2, len = Math.round(a.sampleRate / fk), dur = 1.2;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
    for (let i = len; i < d.length; i++) d[i] = 0.996 * 0.5 * (d[i - len] + d[i - len + 1]);
    const src = a.createBufferSource(), lp = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 3200; g.gain.value = 0.35;
    src.connect(lp).connect(g).connect(out);
    src.start(t);
  },
  // Baken: twee zachte tonen, een kwint omhoog, licht zwevend. Een vriendelijke computer die "klaar" zegt.
  baken(a, out, t, f) {
    const fb = f / 2;
    for (const det of [-6, 6]) {
      tone(a, out, { f: fb, t, peak: 0.07, attack: 0.02, decay: 0.22, detune: det });
      tone(a, out, { f: fb * 1.5, t: t + 0.13, peak: 0.08, attack: 0.02, decay: 0.55, detune: det });
    }
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
