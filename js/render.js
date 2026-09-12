/* ============================================================
   render.js - desenho do circuito, dos carros e dos efeitos
   O traçado é desenhado UMA vez numa camada em cache; a cada
   quadro só desenhamos carros, fumaça e HUD por cima.
   ============================================================ */
'use strict';

/* As pistas grandes não cabem numa textura de resolução fixa: um circuito
   de 2000x1400 a 2x daria ~90 MB. Em vez de fixar a nitidez, fixamos o
   orçamento de pixels e deixamos a nitidez se ajustar ao tamanho da pista. */
const LAYER_PIXEL_BUDGET = 6.5e6;   /* ~26 MB */
const MARKS_PIXEL_BUDGET = 2.0e6;   /* ~8 MB  */
/* limites de nitidez: abaixo de ~0.9 as zebras ficam borradas */

function layerScale(bounds, budget, min, max) {
  return clamp(Math.sqrt(budget / (bounds.w * bounds.h)), min, max);
}

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

/* ---------- cenário ---------- */

/* faixas de grama cortada, na diagonal, como nos autódromos de verdade */
function mownStripes(ctx, b, angle, width) {
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.rotate(angle);
  const span = Math.hypot(b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let x = -span; x < span; x += width * 2) ctx.fillRect(x, -span / 2, width, span);
  ctx.restore();
}

function drawTree(ctx, x, y, r, rng) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.30, y + r * 0.34, r * 0.92, r * 0.78, 0, 0, TAU);
  ctx.fill();
  /* copa: três círculos sobrepostos, do escuro para o claro */
  const tone = rng();
  const dark = tone > 0.5 ? '#1d3d1c' : '#213f22';
  const mid = tone > 0.5 ? '#2a5a26' : '#2f5f2c';
  const lit = tone > 0.5 ? '#3d7a33' : '#44813a';
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = mid;
  ctx.beginPath(); ctx.arc(x - r * 0.14, y - r * 0.16, r * 0.80, 0, TAU); ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.30, r * 0.48, 0, TAU); ctx.fill();
}

/* arquibancada de frente para a pista */
function drawGrandstand(ctx, p, side, len, depth, rng) {
  const nx = p.nx * side, ny = p.ny * side;
  ctx.save();
  ctx.translate(p.x + nx * (depth * 0.5 + 8), p.y + ny * (depth * 0.5 + 8));
  ctx.rotate(Math.atan2(p.ty, p.tx));
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(-len / 2 + 3, -depth / 2 + 4, len, depth);
  ctx.fillStyle = '#3b424d';
  ctx.fillRect(-len / 2, -depth / 2, len, depth);
  const rows = 5, seats = Math.max(4, Math.floor(len / 5));
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < seats; s++) {
      if (rng() > 0.82) continue;
      const sx = -len / 2 + 3 + s * (len - 6) / seats;
      const sy = -depth / 2 + 4 + r * (depth - 8) / rows;
      ctx.fillStyle = ['#d8dde4', '#9aa5b4', '#c05a4e', '#4e7bc0', '#d9b44a'][Math.floor(rng() * 5)];
      ctx.fillRect(sx, sy, 2.6, 2.6);
    }
  }
  ctx.fillStyle = 'rgba(24,28,34,0.88)';
  ctx.fillRect(-len / 2 - 2, -depth / 2 - 5, len + 4, 6);
  ctx.restore();
}

/* caixas brancas do grid de largada, atrás da linha de chegada */
function drawStartGrid(ctx, track, slots) {
  ctx.save();
  ctx.strokeStyle = 'rgba(240,244,248,0.7)';
  ctx.fillStyle = 'rgba(240,244,248,0.09)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < slots; i++) {
    const p = track.atArc(track.length - (GRID_BACK + i * GRID_GAP));
    /* a caixa só é pintada em trecho reto - em curva ficaria torta */
    if (Math.abs(p.curv) > 0.0022) continue;
    const lat = (i % 2 === 0 ? -1 : 1) * track.half * 0.34;
    ctx.save();
    ctx.translate(p.x + p.nx * lat, p.y + p.ny * lat);
    ctx.rotate(Math.atan2(p.ty, p.tx));
    ctx.beginPath(); ctx.rect(-17, -11, 34, 22);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function buildTrackLayer(track) {
  const b = track.bounds;
  const sc = layerScale(b, LAYER_PIXEL_BUDGET, 0.92, 2);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(b.w * sc);
  cv.height = Math.ceil(b.h * sc);
  const ctx = cv.getContext('2d');
  ctx.setTransform(sc, 0, 0, sc, -b.x * sc, -b.y * sc);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const def = track.def;
  /* o que conta como "curva" depende do tamanho do circuito: numa pista de
     7 km uma curva de raio 600 é curva; numa de 2 km, é quase reta */
  const L = track.length;
  const inten = curveIntensity(track, 10 / L, 42 / L);   /* zebras */
  const sandI = curveIntensity(track, 26 / L, 75 / L);   /* áreas de escape */
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
  if (!def.urban) mownStripes(ctx, b, 0.42, 46);
  const blobs = clamp(Math.round(b.w * b.h / 900), 1500, 9000);
  for (let i = 0; i < blobs; i++) {
    const x = b.x + rng() * b.w, y = b.y + rng() * b.h, r = 2.5 + rng() * 9;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.030)' : 'rgba(0,0,0,0.045)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();

  /* ---------- árvores, em bosques fora da área de corrida ---------- */
  if (!def.urban) {
    const safe = track.half + track.runoff + 26;
    const groves = clamp(Math.round(b.w * b.h / 26000), 40, 260);
    for (let g = 0; g < groves; g++) {
      const gx = b.x + rng() * b.w, gy = b.y + rng() * b.h;
      if (track.surfaceAt(gx, gy).dist < safe + 40) continue;
      const count = 4 + Math.floor(rng() * 9);
      const spread = 34 + rng() * 52;
      for (let i = 0; i < count; i++) {
        const tx = gx + (rng() - 0.5) * spread * 2;
        const ty = gy + (rng() - 0.5) * spread * 2;
        if (track.surfaceAt(tx, ty).dist < safe) continue;
        drawTree(ctx, tx, ty, 7 + rng() * 11, rng);
      }
    }
  }

  if (def.urban) {
    /* quarteirões / prédios em volta do circuito de rua */
    ctx.save();
    const blocks = clamp(Math.round(b.w * b.h / 14000), 90, 420);
    for (let i = 0; i < blocks; i++) {
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
  const specks = clamp(Math.round(track.n * 1.6), 600, 2600);
  for (let i = 0; i < specks; i++) {
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

  /* ---------- largada: caixas do grid, linha e arquibancadas ---------- */
  drawStartGrid(ctx, track, 20);
  drawStartLine(ctx, track);

  const standSpots = [40, -70, 150, 260];
  for (const off of standSpots) {
    const p = track.atArc((track.length + off * TRACK_SPACING) % track.length);
    drawGrandstand(ctx, p, 1, 150, 40, rng);
    if (off === 40 || off === -70) drawGrandstand(ctx, p, -1, 130, 34, rng);
  }

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
  const sc = layerScale(b, MARKS_PIXEL_BUDGET, 0.45, 1.2);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(b.w * sc);
  cv.height = Math.ceil(b.h * sc);
  const ctx = cv.getContext('2d');
  ctx.setTransform(sc, 0, 0, sc, -b.x * sc, -b.y * sc);
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

/* Monoposto visto de cima. Peças, da frente para trás: asa dianteira,
   bico, rodas dianteiras, cockpit com halo, sidepods, capô do motor,
   rodas traseiras e asa traseira. */
function drawCar(ctx, car) {
  const sp = car.spec;
  const body = sp.color, trim = sp.accent || '#f2f4f7', wing = sp.wing || '#1a1d22';

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  /* sombra projetada */
  ctx.save();
  ctx.translate(2.5, 3.5);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.moveTo(17, -2); ctx.lineTo(17, 2); ctx.lineTo(-17, 5); ctx.lineTo(-17, -5);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-13, -10, 26, 20);
  ctx.restore();

  const steer = car.steerAngle * 0.45;

  /* ---- rodas (desenhadas antes da carroceria) ---- */
  function wheel(x, y, len, wid, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.fillStyle = '#15171c';
    roundRectPath(ctx, -len / 2, -wid / 2, len, wid, 1.6);
    ctx.fill();
    /* faixa clara do pneu + brilho */
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(-len / 2 + 0.8, -wid / 2 + 0.7, len - 1.6, 0.9);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(-len / 2 + 0.8, wid / 2 - 1.6, len - 1.6, 0.9);
    ctx.restore();
  }
  wheel(WHEEL_FX, -WHEEL_FY, 7.6, 4.4, steer);
  wheel(WHEEL_FX, WHEEL_FY, 7.6, 4.4, steer);
  wheel(WHEEL_RX, -WHEEL_RY, 8.6, 5.6, 0);
  wheel(WHEEL_RX, WHEEL_RY, 8.6, 5.6, 0);

  /* ---- asa dianteira ---- */
  ctx.fillStyle = wing;
  roundRectPath(ctx, 13.2, -10.4, 4.2, 20.8, 1.2);
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(16.4, -10.4, 1.1, 20.8);
  /* derivas laterais */
  ctx.fillStyle = body;
  ctx.fillRect(12.6, -10.6, 3.2, 1.7);
  ctx.fillRect(12.6, 8.9, 3.2, 1.7);

  /* ---- bico ---- */
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(15.2, -1.5); ctx.lineTo(15.2, 1.5);
  ctx.lineTo(5.5, 3.6); ctx.lineTo(5.5, -3.6);
  ctx.closePath(); ctx.fill();

  /* ---- sidepods ---- */
  const pods = ctx.createLinearGradient(0, -9, 0, 9);
  pods.addColorStop(0, 'rgba(0,0,0,0.30)');
  pods.addColorStop(0.28, body);
  pods.addColorStop(0.72, body);
  pods.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = pods;
  ctx.beginPath();
  ctx.moveTo(3.6, -5.2); ctx.lineTo(1.2, -7.4); ctx.lineTo(-7.5, -6.6);
  ctx.lineTo(-10.5, -4.2); ctx.lineTo(-10.5, 4.2); ctx.lineTo(-7.5, 6.6);
  ctx.lineTo(1.2, 7.4); ctx.lineTo(3.6, 5.2);
  ctx.closePath(); ctx.fill();

  /* entradas de ar dos sidepods */
  ctx.fillStyle = 'rgba(10,12,16,0.55)';
  roundRectPath(ctx, 0.4, -7.0, 2.6, 2.2, 0.8); ctx.fill();
  roundRectPath(ctx, 0.4, 4.8, 2.6, 2.2, 0.8); ctx.fill();

  /* ---- chassi central e capô do motor ---- */
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(5.5, -3.6); ctx.lineTo(5.5, 3.6);
  ctx.lineTo(-13.5, 2.6); ctx.lineTo(-13.5, -2.6);
  ctx.closePath(); ctx.fill();

  /* faixa da equipe no eixo do carro */
  ctx.fillStyle = trim;
  ctx.fillRect(-13.5, -1.0, 19, 2.0);

  /* ---- cockpit e halo ---- */
  ctx.fillStyle = 'rgba(12,14,19,0.92)';
  roundRectPath(ctx, -2.6, -2.9, 6.4, 5.8, 2.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,200,235,0.30)';
  roundRectPath(ctx, -1.6, -2.1, 4.2, 4.2, 1.6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,22,28,0.9)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(1.0, 0, 3.9, -Math.PI * 0.72, Math.PI * 0.72);
  ctx.stroke();

  /* tomada de ar acima do piloto */
  ctx.fillStyle = 'rgba(10,12,16,0.75)';
  ctx.beginPath();
  ctx.moveTo(-3.4, -2.2); ctx.lineTo(-3.4, 2.2);
  ctx.lineTo(-6.4, 1.5); ctx.lineTo(-6.4, -1.5);
  ctx.closePath(); ctx.fill();

  /* ---- asa traseira ---- */
  ctx.fillStyle = wing;
  roundRectPath(ctx, -17.6, -9.2, 4.0, 18.4, 1.2);
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(-17.6, -9.2, 1.1, 18.4);
  ctx.fillStyle = body;
  ctx.fillRect(-17.8, -9.4, 4.4, 1.6);
  ctx.fillRect(-17.8, 7.8, 4.4, 1.6);

  /* luz de chuva / freio */
  if (car.brakeGlow > 0) {
    ctx.fillStyle = 'rgba(255,58,40,' + (0.55 + car.brakeGlow * 0.45).toFixed(2) + ')';
    roundRectPath(ctx, -16.2, -1.6, 1.8, 3.2, 0.8);
    ctx.fill();
  }

  /* piscada branca ao bater */
  if (car.hitTimer > 0) {
    ctx.globalAlpha = clamp(car.hitTimer * 3, 0, 0.65);
    ctx.fillStyle = '#fff';
    roundRectPath(ctx, -17, -10, 34, 20, 3);
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
