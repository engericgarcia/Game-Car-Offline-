/* ============================================================
   render.js - desenho do circuito, dos carros e dos efeitos
   O traçado é desenhado UMA vez numa camada em cache; a cada
   quadro só desenhamos carros, fumaça e HUD por cima.
   ============================================================ */
'use strict';

const STATIC_SCALE = 2;   /* nitidez da camada do circuito */
const MARKS_SCALE = 1.5;  /* marcas de pneu (menor = menos memória) */

function offsetPoints(track, offset) {
  const out = new Array(track.n);
  for (let i = 0; i < track.n; i++) {
    const p = track.pts[i];
    out[i] = [p.x + p.nx * offset, p.y + p.ny * offset];
  }
  return out;
}

function pathFrom(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function centerPath(ctx, track) {
  ctx.beginPath();
  ctx.moveTo(track.pts[0].x, track.pts[0].y);
  for (let i = 1; i < track.n; i++) ctx.lineTo(track.pts[i].x, track.pts[i].y);
  ctx.closePath();
}

/* intensidade de curva em cada ponto (0 = reta, 1 = curva fechada).
   lo/hi definem a partir de que raio a curva "conta" */
function curveIntensity(track, lo, hi) {
  const n = track.n, raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = clamp((Math.abs(track.pts[i].curv) - lo) / (hi - lo), 0, 1);
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -6; k <= 6; k++) s += raw[(i + k + n) % n];
    sm[i] = s / 13;
  }
  return sm;
}

function buildTrackLayer(track) {
  const b = track.bounds;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(b.w * STATIC_SCALE);
  cv.height = Math.ceil(b.h * STATIC_SCALE);
  const ctx = cv.getContext('2d');
  ctx.setTransform(STATIC_SCALE, 0, 0, STATIC_SCALE, -b.x * STATIC_SCALE, -b.y * STATIC_SCALE);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const def = track.def;
  const inten = curveIntensity(track, 0.0055, 0.013);   /* zebras */
  const sandI = curveIntensity(track, 0.0095, 0.021);   /* áreas de escape */
  const half = track.half;

  /* ---------- fundo ----------
     tudo fora do limite fica escuro: o jogador enxerga onde acaba
     a área de corrida sem precisar de muro desenhado */
  const outside = shade(def.grass, -0.55);
  ctx.fillStyle = outside;
  ctx.fillRect(b.x, b.y, b.w, b.h);

  if (!def.urban) {
    centerPath(ctx, track);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = track.width + track.runoff * 2 + 9;
    ctx.stroke();
    centerPath(ctx, track);
    ctx.strokeStyle = def.grass;
    ctx.lineWidth = track.width + track.runoff * 2;
    ctx.stroke();
  }

  const rng = makeRng(def.id.length * 7919 + 13);
  ctx.save();
  for (let i = 0; i < 3200; i++) {
    const x = b.x + rng() * b.w, y = b.y + rng() * b.h, r = 2.5 + rng() * 9;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.030)' : 'rgba(0,0,0,0.045)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();

  if (def.urban) {
    /* quarteirões / prédios em volta do circuito de rua */
    ctx.save();
    for (let i = 0; i < 90; i++) {
      const p = track.pts[Math.floor(rng() * track.n)];
      const side = rng() > 0.5 ? 1 : -1;
      const d = half + 26 + rng() * 90;
      const w = 34 + rng() * 70, h = 30 + rng() * 60;
      const x = p.x + p.nx * side * d, y = p.y + p.ny * side * d;
      ctx.fillStyle = ['#2b313d', '#333a47', '#3c4453', '#262b35'][Math.floor(rng() * 4)];
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - w / 2, y + h / 2 - 6, w, 6);
    }
    ctx.restore();
  }

  /* ---------- área de escape (brita) do lado de fora das curvas ---------- */
  if (!def.urban) {
    const sandW = Math.min(track.runoff * 0.60, 44);
    for (const sideSign of [1, -1]) {
      const inner = [], outer = [];
      for (let i = 0; i < track.n; i++) {
        const p = track.pts[i];
        const isOuter = (sideSign > 0) ? (p.curv < 0) : (p.curv > 0);
        const s = isOuter ? sandI[i] * sandW : 0;
        inner.push([p.x + p.nx * sideSign * (half + 1), p.y + p.ny * sideSign * (half + 1)]);
        outer.push([p.x + p.nx * sideSign * (half + 1 + s), p.y + p.ny * sideSign * (half + 1 + s)]);
      }
      ctx.beginPath();
      ctx.moveTo(inner[0][0], inner[0][1]);
      for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i][0], inner[i][1]);
      for (let i = outer.length - 1; i >= 0; i--) ctx.lineTo(outer[i][0], outer[i][1]);
      ctx.closePath();
      ctx.fillStyle = '#b9a06a';
      ctx.fill();
    }
  }

  /* ---------- asfalto ---------- */
  centerPath(ctx, track);
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = track.width + 10;
  ctx.stroke();

  centerPath(ctx, track);
  ctx.strokeStyle = def.asphalt;
  ctx.lineWidth = track.width;
  ctx.stroke();

  /* variação do asfalto + traçado ideal escurecido */
  ctx.save();
  ctx.globalAlpha = 0.10;
  centerPath(ctx, track);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = track.width * 0.42;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 700; i++) {
    const p = track.pts[Math.floor(rng() * track.n)];
    const o = (rng() - 0.5) * track.width;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.arc(p.x + p.nx * o, p.y + p.ny * o, 4 + rng() * 16, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  /* ---------- zebras (kerbs) e linhas de borda ---------- */
  const step = 3;
  for (let i = 0; i < track.n; i += step) {
    const p = track.pts[i], q = track.pts[(i + step) % track.n];
    const k = inten[i];
    for (const sideSign of [1, -1]) {
      const o1 = half - 2.5, o2 = half + 9;
      const ax = p.x + p.nx * sideSign * o1, ay = p.y + p.ny * sideSign * o1;
      const bx = p.x + p.nx * sideSign * o2, by = p.y + p.ny * sideSign * o2;
      const cx = q.x + q.nx * sideSign * o2, cy = q.y + q.ny * sideSign * o2;
      const dx = q.x + q.nx * sideSign * o1, dy = q.y + q.ny * sideSign * o1;
      if (k > 0.22) {
        const band = Math.floor(i * track.spacing / 18) % 2;
        ctx.fillStyle = band ? '#e8ecef' : '#d8352b';
        ctx.globalAlpha = clamp((k - 0.22) * 5, 0, 1);
      } else if (!def.urban) {
        ctx.fillStyle = '#e8ecef';
        ctx.globalAlpha = 0.55;
      } else { continue; }
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  /* ---------- muros do circuito de rua ---------- */
  if (def.urban) {
    for (const sideSign of [1, -1]) {
      const pts = [];
      for (let i = 0; i < track.n; i++) {
        const p = track.pts[i];
        const o = sideSign * (half + track.runoff);
        pts.push([p.x + p.nx * o, p.y + p.ny * o]);
      }
      pathFrom(ctx, pts);
      ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      /* faixas vermelhas nas curvas */
      for (let i = 0; i < track.n; i += 6) {
        if (inten[i] < 0.3 || Math.floor(i / 6) % 2) continue;
        const p = track.pts[i], q = track.pts[(i + 6) % track.n];
        const o = sideSign * (half + track.runoff);
        ctx.beginPath();
        ctx.moveTo(p.x + p.nx * o, p.y + p.ny * o);
        ctx.lineTo(q.x + q.nx * o, q.y + q.ny * o);
        ctx.strokeStyle = '#d8352b'; ctx.lineWidth = 7; ctx.stroke();
      }
    }
  }

  /* ---------- linha de largada/chegada ---------- */
  drawStartLine(ctx, track);

  return { canvas: cv, bounds: b, bg: outside };
}

function drawStartLine(ctx, track) {
  const p = track.pts[0];
  const cols = 10, rows = 2, cell = track.width / cols;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.ang);
  ctx.fillStyle = '#f4f6f8';
  ctx.fillRect(-cell * rows / 2 - 1, -track.half, cell * rows + 2, track.width);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2) continue;
      ctx.fillStyle = '#15181d';
      ctx.fillRect(-cell * rows / 2 + r * cell, -track.half + c * cell, cell, cell);
    }
  }
  ctx.restore();
}

/* ---------- marcas de pneu ---------- */
function makeMarksLayer(track) {
  const b = track.bounds;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(b.w * MARKS_SCALE);
  cv.height = Math.ceil(b.h * MARKS_SCALE);
  const ctx = cv.getContext('2d');
  ctx.setTransform(MARKS_SCALE, 0, 0, MARKS_SCALE, -b.x * MARKS_SCALE, -b.y * MARKS_SCALE);
  ctx.lineCap = 'round';
  return { canvas: cv, ctx: ctx, bounds: b };
}

function paintTireMarks(marks, car) {
  const intensity = clamp(Math.abs(car.slip) * 1.3 - 0.14, 0, 1);
  if (intensity <= 0.02 || car.speed < 45 || car.offTrack) {
    car.wheelTrail[0] = car.wheelTrail[1] = null; return;
  }
  const ctx = marks.ctx;
  ctx.strokeStyle = 'rgba(20,20,24,' + (0.16 * intensity + 0.04).toFixed(3) + ')';
  ctx.lineWidth = 3.6;
  for (let w = 0; w < 2; w++) {
    const pos = car.wheelPos(false, w === 1);
    const prev = car.wheelTrail[w];
    if (prev) {
      const d = Math.hypot(pos[0] - prev[0], pos[1] - prev[1]);
      if (d < 40) {
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(pos[0], pos[1]);
        ctx.stroke();
      }
    }
    car.wheelTrail[w] = pos;
  }
}

/* ---------- partículas de fumaça / poeira ---------- */
class Particles {
  constructor() { this.list = []; }
  spawn(x, y, vx, vy, r, life, color) {
    if (this.list.length > 420) return;
    this.list.push({ x: x, y: y, vx: vx, vy: vy, r: r, life: life, max: life, color: color });
  }
  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      p.r += dt * 13;
    }
  }
  draw(ctx) {
    for (const p of this.list) {
      const a = (p.life / p.max);
      ctx.globalAlpha = a * 0.38;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function emitCarParticles(parts, car, dt) {
  const slip = Math.abs(car.slip);
  if (car.speed < 40) return;
  if (slip > 0.20 && !car.offTrack) {
    if (Math.random() < clamp(slip * 2.2, 0, 1)) {
      const w = car.wheelPos(false, Math.random() > 0.5);
      parts.spawn(w[0], w[1], (Math.random() - 0.5) * 40 - car.vx * 0.06,
        (Math.random() - 0.5) * 40 - car.vy * 0.06,
        2.4 + Math.random() * 3, 0.5 + Math.random() * 0.35, '#e9e9ec');
    }
  }
  if (car.offTrack && car.speed > 60) {
    if (Math.random() < 0.75) {
      const w = car.wheelPos(false, Math.random() > 0.5);
      parts.spawn(w[0], w[1], (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60,
        2 + Math.random() * 3.5, 0.45, '#9a9068');
    }
  }
}

/* ---------- carro ---------- */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car) {
  const L = CAR_LEN, W = CAR_WID;
  ctx.save();
  ctx.translate(car.x, car.y);

  /* sombra */
  ctx.save();
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  roundRectPath(ctx, -L / 2 + 2, -W / 2 + 3, L, W, 5);
  ctx.fill();
  ctx.restore();

  ctx.rotate(car.angle);

  /* rodas */
  const steer = car.steerAngle * 0.5;
  ctx.fillStyle = '#16181d';
  const wheels = [[L * 0.30, W * 0.50, steer], [L * 0.30, -W * 0.50, steer],
  [-L * 0.30, W * 0.52, 0], [-L * 0.30, -W * 0.52, 0]];
  for (const w of wheels) {
    ctx.save();
    ctx.translate(w[0], w[1]);
    ctx.rotate(w[2]);
    ctx.fillRect(-4.5, -2.6, 9, 5.2);
    ctx.restore();
  }

  /* carroceria */
  const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
  g.addColorStop(0, car.spec.color);
  g.addColorStop(0.5, car.spec.color);
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  roundRectPath(ctx, -L / 2, -W / 2, L, W, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  /* cabine e vidros */
  ctx.fillStyle = 'rgba(15,18,24,0.85)';
  roundRectPath(ctx, -L * 0.16, -W * 0.34, L * 0.34, W * 0.68, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,190,230,0.35)';
  roundRectPath(ctx, L * 0.06, -W * 0.30, L * 0.10, W * 0.60, 2);
  ctx.fill();

  /* detalhes: capô, asa traseira, faróis */
  ctx.fillStyle = car.spec.accent;
  ctx.fillRect(-L / 2 - 1.5, -W * 0.46, 3, W * 0.92);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(L / 2 - 2.5, -W * 0.38, 2, 3.2);
  ctx.fillRect(L / 2 - 2.5, W * 0.38 - 3.2, 2, 3.2);
  if (car.brakeGlow > 0) {
    ctx.fillStyle = 'rgba(255,60,40,' + car.brakeGlow.toFixed(2) + ')';
    ctx.fillRect(-L / 2, -W * 0.40, 2.5, W * 0.80);
  }

  if (car.hitTimer > 0) {
    ctx.globalAlpha = clamp(car.hitTimer * 3, 0, 0.6);
    ctx.fillStyle = '#fff';
    roundRectPath(ctx, -L / 2, -W / 2, L, W, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawPlayerArrow(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y - 24);
  const bob = Math.sin(t * 0.006) * 2;
  ctx.translate(0, bob);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.moveTo(0, 6); ctx.lineTo(-6, -4); ctx.lineTo(6, -4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------- minimapa ---------- */
function drawMinimap(ctx, track, cars, x, y, size) {
  const b = track.bounds;
  const s = size / Math.max(b.w, b.h);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10,12,16,0.62)';
  roundRectPath(ctx, -7, -7, size + 14, size + 14, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.translate((size - b.w * s) / 2, (size - b.h * s) / 2);
  ctx.scale(s, s);
  ctx.translate(-b.x, -b.y);
  ctx.lineJoin = ctx.lineCap = 'round';
  centerPath(ctx, track);
  ctx.strokeStyle = 'rgba(255,255,255,0.60)';
  ctx.lineWidth = track.width * 0.95;
  ctx.stroke();
  /* marca a linha de chegada */
  const sp = track.pts[0];
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = track.width * 0.9;
  ctx.beginPath();
  ctx.moveTo(sp.x + sp.nx * track.half, sp.y + sp.ny * track.half);
  ctx.lineTo(sp.x - sp.nx * track.half, sp.y - sp.ny * track.half);
  ctx.stroke();
  for (const c of cars) {
    ctx.fillStyle = c.isPlayer ? '#fff' : c.spec.color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.isPlayer ? 26 : 18, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
