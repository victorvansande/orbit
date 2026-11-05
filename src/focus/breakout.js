/* ---- Breakout: mini arcade fidget in het bakje van de focusmodus ---- */
// Een rustgevende, minimalistische versie van klassiek Breakout, ontworpen volgens Orbit's esthetiek.
// Een gloeiende orb (komeetbal met subtiele deeltjesstaart), een soepel volgend platform en stenen
// in de kleuren van de Orbit-tijdlijnen (of de gekozen accentkleur).
// Geen frustrerende game-overs: bij verlies dockt de bal zacht op het platform,
// en via het pijltje onder het bakje wissel je tussen verschillende iconische steenconstellaties.

const W = 325.6, H = 226.8;
const BALL_SPEED = 3.6;
const PADDLE_Y = 208;
const PADDLE_H = 6.5;
const PADDLE_BASE_W = 54;
const BALL_R = 4;

// Iconische levels / presets (wisselbaar via het pijltje onder het bakje)
const LAYOUTS = [
  {
    name: 'Klassiek',
    build: () => {
      // 4 strakke rijen van 8 stenen
      const bricks = [];
      const rows = 4, cols = 8;
      const bW = 34, bH = 9, gapX = 3.8, gapY = 4;
      const startX = (W - (cols * bW + (cols - 1) * gapX)) / 2;
      const startY = 44;
      const rowTiers = [3, 2, 1, 0]; // Ooit, Maand, Week, Vandaag
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          bricks.push({
            x: startX + c * (bW + gapX),
            y: startY + r * (bH + gapY),
            w: bW,
            h: bH,
            tier: rowTiers[r],
            hp: r === 0 ? 2 : 1,
            maxHp: r === 0 ? 2 : 1,
            bonus: (r === 0 && (c === 2 || c === 5)) ? 'multi' : null
          });
        }
      }
      return bricks;
    }
  },
  {
    name: 'Orbits',
    build: () => {
      // Concentrische bogen van stenen, zoals de ringen van Orbit
      const bricks = [];
      const cx = W / 2, cy = 60;
      const rings = [
        { r: 42, count: 7, tier: 0, hp: 1 },
        { r: 66, count: 11, tier: 1, hp: 1 },
        { r: 90, count: 13, tier: 2, hp: 1 },
        { r: 114, count: 15, tier: 3, hp: 2 }
      ];
      rings.forEach((rg, ringIdx) => {
        const step = Math.PI / (rg.count + 1);
        for (let i = 1; i <= rg.count; i++) {
          const ang = Math.PI * 0.08 + step * i * 0.84;
          const bx = cx + Math.cos(ang) * rg.r - 12;
          const by = cy + Math.sin(ang) * (rg.r * 0.72) - 5;
          bricks.push({
            x: Math.max(12, Math.min(W - 36, bx)),
            y: by,
            w: 24,
            h: 8.5,
            tier: rg.tier,
            hp: rg.hp,
            maxHp: rg.hp,
            bonus: (ringIdx === 3 && i === Math.ceil(rg.count / 2)) ? 'wide' : null
          });
        }
      });
      return bricks;
    }
  },
  {
    name: 'Piramide',
    build: () => {
      const bricks = [];
      const rows = 5;
      const bW = 30, bH = 8.5, gapX = 4, gapY = 4;
      const startY = 46;
      for (let r = 0; r < rows; r++) {
        const count = r * 2 + 1;
        const startX = (W - (count * bW + (count - 1) * gapX)) / 2;
        for (let c = 0; c < count; c++) {
          bricks.push({
            x: startX + c * (bW + gapX),
            y: startY + r * (bH + gapY),
            w: bW,
            h: bH,
            tier: (rows - 1 - r) % 4,
            hp: r === 0 ? 3 : 1,
            maxHp: r === 0 ? 3 : 1,
            bonus: (r === 0) ? 'multi' : null
          });
        }
      }
      return bricks;
    }
  },
  {
    name: 'Kosmos',
    build: () => {
      // Constellatiepatroon met centrale diamant
      const bricks = [];
      const bW = 26, bH = 9, gap = 4;
      const cx = W / 2, cy = 82;
      const offsets = [
        [0, -32, 3, 2], [-32, -16, 2, 1], [32, -16, 2, 1],
        [-64, 0, 1, 1], [-16, 0, 0, 1], [16, 0, 0, 1], [64, 0, 1, 1],
        [-32, 16, 2, 1], [32, 16, 2, 1], [0, 32, 3, 2]
      ];
      offsets.forEach(([dx, dy, tier, hp], idx) => {
        bricks.push({
          x: cx + dx - bW / 2,
          y: cy + dy - bH / 2,
          w: bW,
          h: bH,
          tier,
          hp,
          maxHp: hp,
          bonus: idx === 0 ? 'multi' : (idx === 9 ? 'wide' : null)
        });
      });
      return bricks;
    }
  }
];

export function createBreakout({ reducedMotion, accent, onPreset }) {
  let cv = null, g = null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  let presetIdx = 0;
  let bricks = [];
  let particles = [];
  let pills = [];
  let popups = [];

  let paddleX = W / 2;
  let paddleTargetX = W / 2;
  let paddleW = PADDLE_BASE_W;
  let wideTimer = 0;
  let paddleSquash = 1;

  let balls = [];
  let score = 0;
  let streak = 0;
  let streakTimer = 0;
  let levelClearTimer = 0;
  let autoLaunchTimer = 0;

  function isDark() {
    return document.documentElement.dataset.theme === 'dark';
  }

  function getPalette() {
    const custom = accent?.();
    const dark = isDark();
    if (custom) {
      return {
        bg: dark ? '#0D0D10' : '#F5F3ED',
        paddle: custom,
        ball: '#FFFFFF',
        ballGlow: custom,
        tiers: [custom, custom, custom, custom],
        text: dark ? 'rgba(255,255,255,0.7)' : 'rgba(20,20,24,0.7)'
      };
    }
    // Orbit canonieke kleuren: Vandaag (oranje), Week (groen), Maand (blauw), Ooit (paars)
    return {
      bg: dark ? '#0D0D10' : '#F5F3ED',
      paddle: dark ? '#FFFFFF' : '#111116',
      ball: dark ? '#FFFFFF' : '#111116',
      ballGlow: dark ? '#E08600' : '#C06000',
      tiers: dark
        ? ['#E08600', '#0FAE69', '#38A0F0', '#9D5BD2']
        : ['#C06000', '#0D8550', '#1F6BB0', '#7E3DB8'],
      text: dark ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,24,0.6)'
    };
  }

  function resetLevel(idx) {
    presetIdx = (idx + LAYOUTS.length) % LAYOUTS.length;
    const layout = LAYOUTS[presetIdx];
    bricks = layout.build();
    particles = [];
    pills = [];
    popups = [];
    balls = [{
      x: paddleX,
      y: PADDLE_Y - BALL_R - 1,
      vx: 0,
      vy: 0,
      r: BALL_R,
      stuck: true,
      trail: [],
      super: 0
    }];
    streak = 0;
    autoLaunchTimer = 0;
    levelClearTimer = 0;
    onPreset?.(presetIdx, LAYOUTS.length, `Breakout · ${layout.name}`);
  }

  function launchBall(ball) {
    if (!ball.stuck) return;
    ball.stuck = false;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    ball.vx = Math.sin(angle) * BALL_SPEED;
    ball.vy = Math.cos(angle) * -BALL_SPEED;
    paddleSquash = 0.8;
  }

  function spawnShatter(brick) {
    const palette = getPalette();
    const color = palette.tiers[brick.tier % palette.tiers.length];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 2.2;
      particles.push({
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.8,
        r: 1.2 + Math.random() * 1.6,
        color,
        alpha: 1,
        life: 28 + Math.random() * 14
      });
    }

    if (brick.bonus) {
      pills.push({
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        type: brick.bonus,
        vy: 1.4,
        color
      });
    }
  }

  function addPopup(x, y, text) {
    popups.push({ x, y, text, vy: -0.7, alpha: 1, life: 35 });
  }

  return {
    own: true,
    init() {
      resetLevel(0);
    },
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
      resetLevel(presetIdx + dir);
    },
    move(p) {
      if (!p) return;
      paddleTargetX = Math.max(paddleW / 2 + 8, Math.min(W - paddleW / 2 - 8, p.x));
    },
    drag(p) {
      this.move(p);
    },
    tap(p) {
      const stuckBall = balls.find(b => b.stuck);
      if (stuckBall) {
        launchBall(stuckBall);
      }
    },
    leave() {},
    recolor() {},
    frame(now) {
      if (!g || !cv) return;

      const palette = getPalette();
      const dark = isDark();

      // Smooth paddle beweging
      const prevPaddleX = paddleX;
      paddleX += (paddleTargetX - paddleX) * 0.28;
      const paddleVx = paddleX - prevPaddleX;
      paddleSquash += (1 - paddleSquash) * 0.15;

      // Brede paddle timer
      if (wideTimer > 0) {
        wideTimer--;
        paddleW += (76 - paddleW) * 0.1;
      } else {
        paddleW += (PADDLE_BASE_W - paddleW) * 0.1;
      }

      // Auto-launch timer voor rustige fidget
      const anyStuck = balls.some(b => b.stuck);
      if (anyStuck) {
        autoLaunchTimer++;
        if (autoLaunchTimer > 150) { // Na 2.5 seconden lanceert de bal vanzelf
          const stuck = balls.find(b => b.stuck);
          if (stuck) launchBall(stuck);
          autoLaunchTimer = 0;
        }
      }

      // Sub-step physics (2 stappen per frame voor nauwkeurige botsingen)
      const SUB_STEPS = 2;
      for (let step = 0; step < SUB_STEPS; step++) {
        for (let bIdx = balls.length - 1; bIdx >= 0; bIdx--) {
          const ball = balls[bIdx];
          if (ball.stuck) {
            ball.x = paddleX;
            ball.y = PADDLE_Y - ball.r - 2;
            continue;
          }

          // Positie bijwerken
          ball.x += ball.vx / SUB_STEPS;
          ball.y += ball.vy / SUB_STEPS;

          // Wandbotsingen (links, rechts, boven)
          if (ball.x - ball.r < 6) {
            ball.x = 6 + ball.r;
            ball.vx = Math.abs(ball.vx);
          } else if (ball.x + ball.r > W - 6) {
            ball.x = W - 6 - ball.r;
            ball.vx = -Math.abs(ball.vx);
          }
          if (ball.y - ball.r < 36) { // Bovenkant onder de menubalk
            ball.y = 36 + ball.r;
            ball.vy = Math.abs(ball.vy);
          }

          // Paddle botsing
          const padL = paddleX - paddleW / 2;
          const padR = paddleX + paddleW / 2;
          const padT = PADDLE_Y - PADDLE_H / 2;
          const padB = PADDLE_Y + PADDLE_H / 2;

          if (
            ball.vy > 0 &&
            ball.y + ball.r >= padT &&
            ball.y - ball.r <= padB &&
            ball.x + ball.r >= padL &&
            ball.x - ball.r <= padR
          ) {
            ball.y = padT - ball.r;
            // Hoek bepalen aan de hand van waar de bal op de paddle landt (-1 tot +1)
            const hitRatio = Math.max(-1, Math.min(1, (ball.x - paddleX) / (paddleW / 2)));
            const maxAngle = Math.PI * 0.38;
            const bounceAngle = hitRatio * maxAngle - Math.PI / 2;
            const curSpeed = Math.hypot(ball.vx, ball.vy);
            const speed = Math.max(BALL_SPEED, Math.min(5.2, curSpeed * 1.01));

            ball.vx = Math.cos(bounceAngle) * speed + paddleVx * 0.18;
            ball.vy = Math.sin(bounceAngle) * speed;
            if (ball.vy > -1.5) ball.vy = -1.5; // Zorg altijd voor opwaartse impuls

            paddleSquash = 0.72;
            streak = 0; // Streak herstarten bij paddle-vangst

            // Subtiel landingsdeeltje
            particles.push({
              x: ball.x,
              y: padT,
              vx: hitRatio * 1.5,
              vy: -0.8,
              r: 2,
              color: palette.ballGlow,
              alpha: 0.8,
              life: 14
            });
          }

          // Steenbotsingen
          for (let i = bricks.length - 1; i >= 0; i--) {
            const br = bricks[i];
            if (br.hp <= 0) continue;

            // Dichtstbijzijnde punt op rechthoek
            const nearX = Math.max(br.x, Math.min(ball.x, br.x + br.w));
            const nearY = Math.max(br.y, Math.min(ball.y, br.y + br.h));
            const distX = ball.x - nearX;
            const distY = ball.y - nearY;
            const distSq = distX * distX + distY * distY;

            if (distSq < ball.r * ball.r) {
              br.hp--;
              streak++;
              const pts = 10 * streak;
              score += pts;
              addPopup(br.x + br.w / 2, br.y - 4, `+${pts}`);

              if (br.hp <= 0) {
                spawnShatter(br);
              }

              // Stuiteren tenzij het een komeetbal is die erdoorheen ploegt
              if (ball.super > 0) {
                ball.super--;
              } else {
                // Botsrichting bepalen
                const overlapL = (ball.x + ball.r) - br.x;
                const overlapR = (br.x + br.w) - (ball.x - ball.r);
                const overlapT = (ball.y + ball.r) - br.y;
                const overlapB = (br.y + br.h) - (ball.y - ball.r);
                const minOverlapX = Math.min(overlapL, overlapR);
                const minOverlapY = Math.min(overlapT, overlapB);

                if (minOverlapX < minOverlapY) {
                  ball.vx = ball.x < br.x + br.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
                } else {
                  ball.vy = ball.y < br.y + br.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
                }
              }
              break; // Één steenbotsing per substep
            }
          }

          // Bal valt onderaan weg
          if (ball.y > H + 10) {
            balls.splice(bIdx, 1);
          }
        }
      }

      // Als alle ballen weg zijn: herplaats rustig een nieuwe bal
      if (balls.length === 0) {
        balls.push({
          x: paddleX,
          y: PADDLE_Y - BALL_R - 2,
          vx: 0,
          vy: 0,
          r: BALL_R,
          stuck: true,
          trail: [],
          super: 0
        });
        autoLaunchTimer = 0;
        streak = 0;
      }

      // Trail bijwerken voor ballen
      balls.forEach(ball => {
        if (!ball.stuck) {
          ball.trail.unshift({ x: ball.x, y: ball.y });
          if (ball.trail.length > 6) ball.trail.pop();
        } else {
          ball.trail = [];
        }
      });

      // Power-up pills updaten
      for (let i = pills.length - 1; i >= 0; i--) {
        const pill = pills[i];
        pill.y += pill.vy;
        // Check botsing met paddle
        if (
          pill.y >= PADDLE_Y - PADDLE_H / 2 &&
          pill.y <= PADDLE_Y + PADDLE_H / 2 + 6 &&
          pill.x >= paddleX - paddleW / 2 &&
          pill.x <= paddleX + paddleW / 2
        ) {
          // Activeren
          if (pill.type === 'multi') {
            addPopup(paddleX, PADDLE_Y - 14, 'MULTIBAL');
            const mainBall = balls[0] || { x: paddleX, y: PADDLE_Y - 10 };
            balls.push(
              { x: mainBall.x, y: mainBall.y, vx: -2.8, vy: -3.2, r: BALL_R, stuck: false, trail: [], super: 0 },
              { x: mainBall.x, y: mainBall.y, vx: 2.8, vy: -3.2, r: BALL_R, stuck: false, trail: [], super: 0 }
            );
          } else if (pill.type === 'wide') {
            addPopup(paddleX, PADDLE_Y - 14, 'BREED');
            wideTimer = 480; // ~8 seconden
          }
          pills.splice(i, 1);
          continue;
        }
        if (pill.y > H + 12) pills.splice(i, 1);
      }

      // Check of level voltooid is
      const remainingBricks = bricks.filter(b => b.hp > 0).length;
      if (remainingBricks === 0) {
        levelClearTimer++;
        if (levelClearTimer === 1) {
          score += 250;
          addPopup(W / 2, H / 2, 'LEVEL VOLTOOID +250');
          // Feestelijke stervonkjes
          for (let k = 0; k < 28; k++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 1.5 + Math.random() * 3.5;
            particles.push({
              x: W / 2,
              y: H / 2,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              r: 1.5 + Math.random() * 2,
              color: palette.tiers[k % palette.tiers.length],
              alpha: 1,
              life: 45
            });
          }
        }
        if (levelClearTimer > 75) {
          resetLevel(presetIdx + 1);
        }
      }

      // Deeltjes en popups updaten
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // Zachte zwaartekracht
        p.alpha -= 1 / p.life;
        if (p.alpha <= 0) particles.splice(i, 1);
      }

      for (let i = popups.length - 1; i >= 0; i--) {
        const pop = popups[i];
        pop.y += pop.vy;
        pop.alpha -= 1 / pop.life;
        if (pop.alpha <= 0) popups.splice(i, 1);
      }

      // ---- RENDEREN ----
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = palette.bg; g.fillRect(0, 0, W, H);

      // Stenen tekenen
      bricks.forEach(br => {
        if (br.hp <= 0) return;
        const color = palette.tiers[br.tier % palette.tiers.length];
        const isDamaged = br.maxHp > 1 && br.hp === 1;

        g.fillStyle = color;
        g.globalAlpha = isDamaged ? 0.6 : 0.92;

        // Afgeronde pil-steen
        const rad = 2.5;
        g.beginPath();
        g.roundRect(br.x, br.y, br.w, br.h, rad);
        g.fill();

        // Binnenste subtiele glanslijn
        g.strokeStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)';
        g.lineWidth = 1;
        g.stroke();

        // Bonus indicator
        if (br.bonus) {
          g.fillStyle = '#FFFFFF';
          g.beginPath();
          g.arc(br.x + br.w / 2, br.y + br.h / 2, 1.8, 0, Math.PI * 2);
          g.fill();
        }
      });
      g.globalAlpha = 1;

      // Power-up pills tekenen
      pills.forEach(p => {
        g.fillStyle = p.color;
        g.beginPath();
        g.roundRect(p.x - 7, p.y - 3.5, 14, 7, 3.5);
        g.fill();
        g.fillStyle = '#FFFFFF';
        g.font = '600 7px "Geist Mono", monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(p.type === 'multi' ? '3x' : '↔', p.x, p.y + 0.5);
      });

      // Paddle tekenen
      const padL = paddleX - paddleW / 2;
      const padT = PADDLE_Y - (PADDLE_H * paddleSquash) / 2;
      const padRealH = PADDLE_H * paddleSquash;

      g.fillStyle = palette.paddle;
      g.beginPath();
      g.roundRect(padL, padT, paddleW, padRealH, 3.2);
      g.fill();

      // Middenpuntje op de paddle
      g.fillStyle = dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.arc(paddleX, padT + padRealH / 2, 1.2, 0, Math.PI * 2);
      g.fill();

      // Ballen en kometenstaart tekenen
      balls.forEach(ball => {
        // Trail
        ball.trail.forEach((pt, idx) => {
          const ratio = 1 - idx / ball.trail.length;
          g.fillStyle = palette.ballGlow;
          g.globalAlpha = ratio * 0.35;
          g.beginPath();
          g.arc(pt.x, pt.y, ball.r * (0.4 + 0.5 * ratio), 0, Math.PI * 2);
          g.fill();
        });
        g.globalAlpha = 1;

        // Gloeiende bal zelf
        g.fillStyle = palette.ball;
        g.beginPath();
        g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        g.fill();

        // Bal omtrek / halo
        g.strokeStyle = palette.ballGlow;
        g.lineWidth = 1.2;
        g.stroke();
      });

      // Deeltjes tekenen
      particles.forEach(p => {
        g.fillStyle = p.color;
        g.globalAlpha = Math.max(0, p.alpha);
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;

      // Popups / Score zwevende tekst
      popups.forEach(pop => {
        g.fillStyle = palette.text;
        g.globalAlpha = Math.max(0, pop.alpha);
        g.font = '600 9px "Geist Mono", monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(pop.text, pop.x, pop.y);
      });
      g.globalAlpha = 1;

      // HUD overlay onderaan
      g.fillStyle = palette.text;
      g.font = '500 8.5px "Geist Mono", monospace';
      g.textAlign = 'left';
      g.textBaseline = 'bottom';
      g.fillText(`${LAYOUTS[presetIdx].name.toUpperCase()}`, 12, H - 6);

      g.textAlign = 'right';
      const streakText = streak > 1 ? ` · ×${streak}` : '';
      g.fillText(`${String(score).padStart(4, '0')} PTS${streakText}`, W - 12, H - 6);

      // Instructie bij stilstaande bal
      if (anyStuck && Math.floor(now / 480) % 2 === 0) {
        g.fillStyle = palette.text;
        g.textAlign = 'center';
        g.fillText('TIK OM TE STARTEN', W / 2, PADDLE_Y - 18);
      }
    }
  };
}
