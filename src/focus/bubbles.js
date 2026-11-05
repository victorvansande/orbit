/* ---- Bubbels: oneindig voorbijglijdende bubble-pop-wall fidget ---- */
// Een rustgevende, oneindige noppenfolie (bubble wrap) in Orbit's matte glas-esthetiek.
// De folie zweeft zachtjes omhoog (of kan worden meegesleept).
// Eén klik popt een noppenbel; ingedrukt houden en vegen popt automatisch elke bubbel
// waar je overheen zweeft in een verslavende reeks ploppen met zachte schokgolfjes en vonkjes.

const W = 325.6, H = 226.8;

// Web Audio synthesizer voor een uiterst bevredigende, droge noppenfolie-plop
let audioCtx = null;
function playPopSound(pitchMod = 1.0) {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtx) audioCtx = new AudioCtor();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    const baseFreq = (650 + Math.random() * 450) * pitchMod;
    osc.frequency.setValueAtTime(baseFreq * 2.2, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, t + 0.035);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + 0.04);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);

    osc.connect(filter).connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  } catch {
    // Audio niet toegestaan of foutloos stil
  }
}

const PRESETS = [
  { name: 'Klassiek', radius: 12.5, gapX: 29, gapY: 25, speed: 0.28 },
  { name: 'Groot', radius: 18, gapX: 41, gapY: 35, speed: 0.22 },
  { name: 'Micro', radius: 8.5, gapX: 20, gapY: 17, speed: 0.35 },
  { name: 'Regenboog', radius: 12.5, gapX: 29, gapY: 25, speed: 0.28, rainbow: true }
];

const mod = (n, m) => ((n % m) + m) % m;

function getBubbleY(b, scrollY, p) {
  const totalH = H + p.gapY * 3;
  return mod(b.origY - scrollY + p.gapY, totalH) - p.gapY;
}

export function createBubbles({ reducedMotion, accent, onPreset }) {
  let cv = null, g = null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  let presetIdx = 0;
  let scrollY = 0;
  let isDown = false;
  let poppedCount = 0;

  let bubbles = [];
  let rings = [];     // Uitdijende schokgolfjes
  let particles = []; // Kleine plop-deeltjes

  function isDark() {
    return document.documentElement.dataset.theme === 'dark';
  }

  function getPalette() {
    const custom = accent?.();
    const dark = isDark();
    if (custom) {
      return {
        bubbleTint: custom,
        popRing: custom,
        text: dark ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,24,0.6)'
      };
    }
    return {
      bubbleTint: dark ? '#FFFFFF' : '#111116',
      popRing: dark ? '#38A0F0' : '#1F6BB0',
      rainbowTiers: dark
        ? ['#E08600', '#0FAE69', '#38A0F0', '#9D5BD2']
        : ['#C06000', '#0D8550', '#1F6BB0', '#7E3DB8'],
      text: dark ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,24,0.6)'
    };
  }

  function initGrid() {
    const p = PRESETS[presetIdx];
    bubbles = [];
    const cols = Math.ceil(W / p.gapX) + 2;
    const rows = Math.ceil(H / p.gapY) + 4;

    for (let r = -2; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const offsetX = (Math.abs(r) % 2) * (p.gapX / 2);
        bubbles.push({
          col: c,
          row: r,
          origX: c * p.gapX + offsetX,
          origY: r * p.gapY,
          popped: false,
          scale: 1
        });
      }
    }
    rings = [];
    particles = [];
  }

  function setPreset(idx) {
    presetIdx = (idx + PRESETS.length) % PRESETS.length;
    initGrid();
    onPreset?.(presetIdx, PRESETS.length, `Bubbels · ${PRESETS[presetIdx].name}`);
  }

  function popBubble(b, screenX, screenY) {
    if (b.popped) return;
    b.popped = true;
    b.scale = 0.85;
    poppedCount++;

    const p = PRESETS[presetIdx];
    playPopSound(p.radius > 15 ? 0.75 : p.radius < 10 ? 1.35 : 1.0);

    // Schokgolf ring
    rings.push({
      x: screenX,
      y: screenY,
      r: p.radius * 0.8,
      maxR: p.radius * 2.2,
      alpha: 0.9
    });

    // Spettervonkjes
    const pal = getPalette();
    const count = 6;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.0 + Math.random() * 2.2;
      particles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: 1.2 + Math.random() * 1.2,
        color: pal.popRing,
        alpha: 1,
        life: 18 + Math.random() * 10
      });
    }
  }

  function checkHit(x, y) {
    const p = PRESETS[presetIdx];
    const hitR = p.radius * 1.15;
    bubbles.forEach(b => {
      if (b.popped) return;
      const renderY = getBubbleY(b, scrollY, p);
      const dist = Math.hypot(x - b.origX, y - renderY);
      if (dist <= hitR) {
        popBubble(b, b.origX, renderY);
      }
    });
  }

  return {
    own: true,
    init() {
      setPreset(0);
    },
    step() {},
    mount(el) {
      if (!cv) {
        cv = document.createElement('canvas');
        cv.className = 'panel-canvas';
        cv.setAttribute('aria-hidden', 'true');
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        cv.style.width = `${W}px`;
        cv.style.height = `${H}px`;
        el.append(cv);
        g = cv.getContext('2d');
      }
    },
    unmount() {
      cv?.remove();
      cv = null;
      g = null;
    },
    next(dir = 1) {
      setPreset(presetIdx + dir);
    },
    down(p) {
      if (!p) return;
      isDown = true;
      checkHit(p.x, p.y);
    },
    move(p) {
      if (!p) return;
      if (isDown) checkHit(p.x, p.y);
    },
    drag(p) {
      if (!p) return;
      isDown = true;
      checkHit(p.x, p.y);
    },
    tap(p) {
      if (!p) return;
      checkHit(p.x, p.y);
    },
    up() {
      isDown = false;
    },
    leave() {
      isDown = false;
    },
    recolor() {},
    frame(now) {
      if (!g || !cv) return;

      const p = PRESETS[presetIdx];
      const pal = getPalette();
      const dark = isDark();

      // Oneindig traag voorbijglijden van de folie
      scrollY += p.speed;

      // Update ringen
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += (r.maxR - r.r) * 0.22;
        r.alpha -= 0.055;
        if (r.alpha <= 0) rings.splice(i, 1);
      }

      // Update deeltjes
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.alpha -= 1 / pt.life;
        if (pt.alpha <= 0) particles.splice(i, 1);
      }

      // ---- RENDEREN ----
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = dark ? '#0D0D10' : '#F5F3ED'; g.fillRect(0, 0, W, H);

      // Achtergrond noppenraster
      bubbles.forEach(b => {
        const by = getBubbleY(b, scrollY, p);
        if (by > H + p.gapY * 1.5 && b.popped) {
          b.popped = false;
          b.scale = 1;
        }

        if (by < -p.radius * 2 || by > H + p.radius * 2) return;

        const bx = b.origX;
        const rad = p.radius;
        b.scale += ((b.popped ? 0.9 : 1.0) - b.scale) * 0.15;
        const curR = rad * b.scale;

        let tint = pal.bubbleTint;
        if (p.rainbow && pal.rainbowTiers) {
          tint = pal.rainbowTiers[Math.abs(b.row) % pal.rainbowTiers.length];
        }

        if (!b.popped) {
          // --- ONGEPOPTE MATTE GLASBUBBEL ---
          const grad = g.createRadialGradient(
            bx - curR * 0.35, by - curR * 0.35, curR * 0.1,
            bx, by, curR
          );
          if (dark) {
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.06)');
            grad.addColorStop(0.85, 'rgba(20, 20, 28, 0.4)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0.14)');
          } else {
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
            grad.addColorStop(0.5, 'rgba(230, 226, 220, 0.45)');
            grad.addColorStop(0.85, 'rgba(200, 195, 185, 0.3)');
            grad.addColorStop(1, 'rgba(120, 115, 110, 0.35)');
          }

          g.fillStyle = grad;
          g.beginPath();
          g.arc(bx, by, curR, 0, Math.PI * 2);
          g.fill();

          g.strokeStyle = dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(50, 50, 55, 0.18)';
          g.lineWidth = 1.1;
          g.stroke();

          g.strokeStyle = dark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.95)';
          g.lineWidth = 1.4;
          g.beginPath();
          g.arc(bx, by, curR - 2.2, Math.PI * 1.15, Math.PI * 1.55);
          g.stroke();

          if (accent?.()) {
            g.fillStyle = tint;
            g.globalAlpha = 0.08;
            g.beginPath();
            g.arc(bx, by, curR, 0, Math.PI * 2);
            g.fill();
            g.globalAlpha = 1;
          }
        } else {
          // --- GEPOPTE INGEDRUKTE BUBBEL ---
          g.strokeStyle = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(30, 30, 35, 0.1)';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(bx, by, curR * 0.92, 0, Math.PI * 2);
          g.stroke();

          g.strokeStyle = dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(30, 30, 35, 0.12)';
          g.lineWidth = 0.8;
          g.beginPath();
          g.moveTo(bx - curR * 0.4, by - curR * 0.2);
          g.lineTo(bx + curR * 0.2, by + curR * 0.3);
          g.moveTo(bx - curR * 0.1, by + curR * 0.4);
          g.lineTo(bx + curR * 0.3, by - curR * 0.3);
          g.stroke();

          g.fillStyle = dark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.04)';
          g.beginPath();
          g.arc(bx, by, curR * 0.65, 0, Math.PI * 2);
          g.fill();
        }
      });

      // Schokgolfringen tekenen
      rings.forEach(r => {
        g.strokeStyle = pal.popRing;
        g.globalAlpha = Math.max(0, r.alpha);
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        g.stroke();
      });
      g.globalAlpha = 1;

      // Spettervonkjes tekenen
      particles.forEach(pt => {
        g.fillStyle = pt.color;
        g.globalAlpha = Math.max(0, pt.alpha);
        g.beginPath();
        g.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;

      // Subtiele HUD
      g.fillStyle = pal.text;
      g.font = '500 8.5px "Geist Mono", monospace';
      g.textAlign = 'left';
      g.textBaseline = 'bottom';
      g.fillText(`${PRESETS[presetIdx].name.toUpperCase()}`, 12, H - 6);

      g.textAlign = 'right';
      g.fillText(`${poppedCount} GEPOPT`, W - 12, H - 6);
    }
  };
}
