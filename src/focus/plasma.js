/* ---- Plasmabol: diëlektrische ontlading fidget in de focusmodus ---- */
// De klassieke plasmabol (Tesla / diëlektrische barrière-ontlading).
// Een centrale hoogspanningselektrode zendt elektrische plasma-draden (filamenten) uit
// naar de buitenste glazen bol. De filamenten kronkelen organisch door het edelgas.
// Zodra je de glazen bol aanraakt of met de cursor nadert, verandert de diëlektrische capaciteit:
// felle, dikke ontladingsbundels trekken onmiddellijk naar je vinger toe en ontmoeten het glas
// in een stralende corona van vonken.

const W = 325.6, H = 226.8;
const CX = W / 2;
const CY = H / 2 + 10;
const CORE_R = 15;
const GLASS_R = 90;

const PRESETS = [
  {
    name: 'Neon-Xenon',
    root: '#9B30FF',   // Diep violet
    mid: '#E040FB',    // Magenta
    tip: '#00E5FF',    // Cyaan
    corona: 'rgba(224, 64, 251, 0.45)',
    hot: '#FFFFFF'
  },
  {
    name: 'Bliksem',
    root: '#1E88E5',   // Elektrisch blauw
    mid: '#42A5F5',    // IJsblauw
    tip: '#E1F5FE',    // Helder witblauw
    corona: 'rgba(66, 165, 245, 0.45)',
    hot: '#FFFFFF'
  },
  {
    name: 'Zonnewind',
    root: '#E65100',   // Diep amber
    mid: '#FF9100',    // Zonnewind oranje
    tip: '#FFD700',    // Goudgeel
    corona: 'rgba(255, 145, 0, 0.45)',
    hot: '#FFFDE7'
  },
  {
    name: 'Aurora',
    root: '#7B1FA2',   // Paars
    mid: '#00E676',    // Noorderlicht smaragdgroen
    tip: '#69F0AE',    // Helder mint
    corona: 'rgba(0, 230, 118, 0.45)',
    hot: '#FFFFFF'
  }
];

export function createPlasma({ reducedMotion, accent, onPreset }) {
  let cv = null, g = null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  let presetIdx = 0;
  let t = 0;
  let ptr = { x: null, y: null, down: false };
  let surge = 0;
  let sparks = [];

  // 12 basis filamenten
  const FILAMENT_COUNT = 12;
  const filaments = Array.from({ length: FILAMENT_COUNT }, (_, i) => ({
    angle: (i / FILAMENT_COUNT) * Math.PI * 2,
    speed: 0.003 + Math.random() * 0.005,
    phase: Math.random() * Math.PI * 2,
    freq: 2 + Math.random() * 2,
    life: 0.5 + Math.random() * 0.5,
    drift: (Math.random() - 0.5) * 0.015
  }));

  function isDark() {
    return document.documentElement.dataset.theme === 'dark';
  }

  function getPalette() {
    const custom = accent?.();
    if (custom) {
      return {
        name: 'Accent',
        root: custom,
        mid: custom,
        tip: '#FFFFFF',
        corona: custom,
        hot: '#FFFFFF'
      };
    }
    return PRESETS[presetIdx];
  }

  function setPreset(idx) {
    presetIdx = (idx + PRESETS.length) % PRESETS.length;
    onPreset?.(presetIdx, PRESETS.length, `Plasma · ${PRESETS[presetIdx].name}`);
  }

  // Fractal bliksem-subdivisie (midpoint displacement)
  function buildLightning(x0, y0, x1, y1, roughness, jitter, time, seed) {
    const pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
    const steps = 4; // 16 segmenten

    for (let step = 0; step < steps; step++) {
      const nextPts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const pA = pts[i];
        const pB = pts[i + 1];
        nextPts.push(pA);

        const midX = (pA.x + pB.x) / 2;
        const midY = (pA.y + pB.y) / 2;

        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const len = Math.hypot(dx, dy);

        // Loodrechte normaal
        const nx = -dy / (len || 1);
        const ny = dx / (len || 1);

        // Organische ruis gebaseerd op tijd en positie
        const noise = Math.sin(time * 8 + i * 2.7 + seed) * 0.6 +
                      Math.cos(time * 14 + (step + 1) * 3.3 + seed * 2) * 0.4;
        const offset = noise * len * roughness * jitter;

        nextPts.push({
          x: midX + nx * offset,
          y: midY + ny * offset
        });
      }
      nextPts.push(pts[pts.length - 1]);
      pts.length = 0;
      pts.push(...nextPts);
    }
    return pts;
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
    move(p) {
      if (!p) { ptr.x = null; ptr.y = null; return; }
      ptr.x = p.x;
      ptr.y = p.y;
    },
    drag(p) {
      this.move(p);
      ptr.down = true;
    },
    tap(p) {
      this.move(p);
      surge = 1.0; // Elektromagnetische puls
      // Vonken op het contactpunt
      for (let i = 0; i < 18; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.2 + Math.random() * 2.8;
        sparks.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          alpha: 1,
          life: 20 + Math.random() * 15
        });
      }
    },
    leave() {
      ptr.x = null;
      ptr.y = null;
      ptr.down = false;
    },
    recolor() {},
    frame(now) {
      if (!g || !cv) return;
      t += 0.016;
      surge *= 0.92;

      const pal = getPalette();
      const dark = isDark();

      // Check of pointer dichtbij of binnen de bol is
      let touchTarget = null;
      if (ptr.x !== null && ptr.y !== null) {
        const pdx = ptr.x - CX;
        const pdy = ptr.y - CY;
        const pDist = Math.hypot(pdx, pdy);
        if (pDist < GLASS_R + 32) {
          // Klem op of binnen de glazen bol
          const clampR = Math.min(GLASS_R - 2, Math.max(CORE_R + 6, pDist));
          const ang = Math.atan2(pdy, pdx);
          touchTarget = {
            x: CX + Math.cos(ang) * clampR,
            y: CY + Math.sin(ang) * clampR,
            rawDist: pDist,
            ang
          };
        }
      }

      // Vonken updaten
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.94;
        s.vy *= 0.94;
        s.alpha -= 1 / s.life;
        if (s.alpha <= 0) sparks.splice(i, 1);
      }

      // Spontane vonkjes bij actieve aanraking
      if (touchTarget && Math.random() < 0.4) {
        const sa = Math.random() * Math.PI * 2;
        sparks.push({
          x: touchTarget.x,
          y: touchTarget.y,
          vx: Math.cos(sa) * (0.8 + Math.random() * 1.5),
          vy: Math.sin(sa) * (0.8 + Math.random() * 1.5),
          alpha: 1,
          life: 14 + Math.random() * 10
        });
      }

      // ---- RENDEREN ----
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = dark ? '#0D0D10' : '#F5F3ED'; g.fillRect(0, 0, W, H);

      // 1. Glazen bol achtergrond gloed & contour
      const glassGrad = g.createRadialGradient(CX, CY, CORE_R, CX, CY, GLASS_R);
      glassGrad.addColorStop(0, dark ? 'rgba(25, 20, 35, 0.4)' : 'rgba(235, 230, 240, 0.3)');
      glassGrad.addColorStop(0.7, dark ? 'rgba(10, 8, 16, 0.15)' : 'rgba(240, 238, 245, 0.1)');
      glassGrad.addColorStop(1, dark ? 'rgba(50, 40, 75, 0.35)' : 'rgba(200, 195, 215, 0.4)');

      g.fillStyle = glassGrad;
      g.beginPath();
      g.arc(CX, CY, GLASS_R, 0, Math.PI * 2);
      g.fill();

      // Glazen rand
      g.strokeStyle = dark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(20, 20, 30, 0.15)';
      g.lineWidth = 1.4;
      g.stroke();

      // Glansboog op het glas (spiegeling linksboven)
      g.strokeStyle = dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.6)';
      g.lineWidth = 2.2;
      g.beginPath();
      g.arc(CX, CY, GLASS_R - 2.5, Math.PI * 1.15, Math.PI * 1.55);
      g.stroke();

      // 2. Centrale elektrode basis en corona
      const coreGlow = g.createRadialGradient(CX, CY, CORE_R * 0.4, CX, CY, CORE_R * 2.2);
      coreGlow.addColorStop(0, pal.hot);
      coreGlow.addColorStop(0.3, pal.mid);
      coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = coreGlow;
      g.beginPath();
      g.arc(CX, CY, CORE_R * 2.2, 0, Math.PI * 2);
      g.fill();

      // Centrale metalen elektrode bol
      const coreGrad = g.createRadialGradient(CX - 3, CY - 3, 2, CX, CY, CORE_R);
      coreGrad.addColorStop(0, dark ? '#444455' : '#777788');
      coreGrad.addColorStop(0.8, dark ? '#15151E' : '#22222D');
      coreGrad.addColorStop(1, '#05050A');
      g.fillStyle = coreGrad;
      g.beginPath();
      g.arc(CX, CY, CORE_R, 0, Math.PI * 2);
      g.fill();

      // 3. Vrije achtergrond-filamenten
      filaments.forEach((fil, fIdx) => {
        fil.angle += fil.speed + fil.drift;
        const curAng = fil.angle + Math.sin(t * 1.5 + fil.phase) * 0.12;

        // Als aanraking actief is, worden sommige filamenten naar het doel getrokken
        let targetX = CX + Math.cos(curAng) * (GLASS_R - 2);
        let targetY = CY + Math.sin(curAng) * (GLASS_R - 2);
        let intensity = 1.0;

        if (touchTarget) {
          const dAng = Math.atan2(Math.sin(curAng - touchTarget.ang), Math.cos(curAng - touchTarget.ang));
          if (Math.abs(dAng) < 0.6) {
            // Dit filament wordt gevangen door de capacitieve aantrekkingskracht
            targetX += (touchTarget.x - targetX) * 0.75;
            targetY += (touchTarget.y - targetY) * 0.75;
            intensity = 1.4;
          }
        }

        const startX = CX + Math.cos(curAng) * CORE_R;
        const startY = CY + Math.sin(curAng) * CORE_R;

        const pts = buildLightning(
          startX, startY, targetX, targetY,
          0.16 + surge * 0.1,
          1.0,
          t + fIdx * 0.5,
          fIdx * 19.3
        );

        // Tekenen in 3 lagen: brede diffuse gloed, gekleurd filament, en witte kern
        // A. Gloedlaag
        g.strokeStyle = pal.mid;
        g.globalAlpha = (0.28 + surge * 0.4) * intensity;
        g.lineWidth = 4 + surge * 3;
        g.beginPath();
        pts.forEach((p, idx) => { if (idx === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); });
        g.stroke();

        // B. Kleurkern
        g.strokeStyle = pal.tip;
        g.globalAlpha = (0.7 + surge * 0.3) * intensity;
        g.lineWidth = 1.8;
        g.stroke();

        // C. Witte hete kern
        g.strokeStyle = pal.hot;
        g.globalAlpha = (0.9 + surge * 0.1) * intensity;
        g.lineWidth = 0.8;
        g.stroke();

        // Vertakking nabij het glas (forking tip)
        if (pts.length > 4 && Math.random() < 0.8) {
          const splitPt = pts[pts.length - 4];
          const forkAng = curAng + (fIdx % 2 === 0 ? 0.22 : -0.22);
          const forkEnd = {
            x: CX + Math.cos(forkAng) * (GLASS_R - 1.5),
            y: CY + Math.sin(forkAng) * (GLASS_R - 1.5)
          };
          g.strokeStyle = pal.tip;
          g.globalAlpha = 0.5 * intensity;
          g.lineWidth = 1.0;
          g.beginPath();
          g.moveTo(splitPt.x, splitPt.y);
          g.lineTo(
            (splitPt.x + forkEnd.x) / 2 + (Math.random() - 0.5) * 6,
            (splitPt.y + forkEnd.y) / 2 + (Math.random() - 0.5) * 6
          );
          g.lineTo(forkEnd.x, forkEnd.y);
          g.stroke();
        }
      });
      g.globalAlpha = 1;

      // 4. Primaire ontladingsbundel naar aanraking (Dielectric Touch Arc)
      if (touchTarget) {
        const BEAMS = 3;
        for (let b = 0; b < BEAMS; b++) {
          const beamAng = touchTarget.ang + (b - 1) * 0.08;
          const startX = CX + Math.cos(beamAng) * CORE_R;
          const startY = CY + Math.sin(beamAng) * CORE_R;

          const pts = buildLightning(
            startX, startY, touchTarget.x, touchTarget.y,
            0.18 + (b * 0.05),
            1.2,
            t * 1.5 + b * 2.3,
            b * 77.1
          );

          // Buitenste brede ontladingsaura
          g.strokeStyle = pal.corona;
          g.globalAlpha = 0.65;
          g.lineWidth = 9 + b * 2;
          g.beginPath();
          pts.forEach((p, idx) => { if (idx === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); });
          g.stroke();

          // Heldere middenbundel
          g.strokeStyle = pal.mid;
          g.globalAlpha = 0.9;
          g.lineWidth = 3.5;
          g.stroke();

          // Witte hoogspanningskern
          g.strokeStyle = pal.hot;
          g.globalAlpha = 1;
          g.lineWidth = 1.4;
          g.stroke();
        }

        // Contactpoel op het glas (Dielectric Bloom Flare)
        const bloom = g.createRadialGradient(
          touchTarget.x, touchTarget.y, 1,
          touchTarget.x, touchTarget.y, 22
        );
        bloom.addColorStop(0, pal.hot);
        bloom.addColorStop(0.35, pal.tip);
        bloom.addColorStop(0.7, pal.mid);
        bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');

        g.fillStyle = bloom;
        g.beginPath();
        g.arc(touchTarget.x, touchTarget.y, 22, 0, Math.PI * 2);
        g.fill();

        // Contactpunt ring
        g.strokeStyle = pal.hot;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(touchTarget.x, touchTarget.y, 5 + Math.sin(t * 12) * 1.5, 0, Math.PI * 2);
        g.stroke();
      }

      // 5. Vonken tekenen
      sparks.forEach(s => {
        g.fillStyle = pal.hot;
        g.globalAlpha = Math.max(0, s.alpha);
        g.beginPath();
        g.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;

      // 6. Subtiele HUD onderaan
      g.fillStyle = dark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(20, 20, 24, 0.5)';
      g.font = '500 8.5px "Geist Mono", monospace';
      g.textAlign = 'left';
      g.textBaseline = 'bottom';
      g.fillText(`${PRESETS[presetIdx].name.toUpperCase()}`, 12, H - 6);

      g.textAlign = 'right';
      g.fillText('RAAK HET GLAS AAN', W - 12, H - 6);
    }
  };
}
