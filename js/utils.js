/* ============================================================
   utils.js - matemática, splines e helpers gerais
   ============================================================ */
'use strict';

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

/* normaliza ângulo para [-PI, PI] */
function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/* gerador pseudo-aleatório determinístico (mesma pista = mesmo capim) */
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* spline Catmull-Rom fechada: transforma poucos pontos de controle
   em uma curva suave (é assim que os circuitos são desenhados) */
function catmullRomClosed(pts, samplesPerSeg) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < samplesPerSeg; j++) {
      const t = j / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  return out;
}

/* reamostra uma polilinha fechada em pontos igualmente espaçados */
function resampleClosed(poly, spacing) {
  const out = [];
  let carryX = poly[0][0], carryY = poly[0][1];
  out.push([carryX, carryY]);
  let leftover = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    let segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (segLen < 1e-6) continue;
    const ux = (b[0] - a[0]) / segLen, uy = (b[1] - a[1]) / segLen;
    let d = spacing - leftover;
    while (d <= segLen) {
      out.push([a[0] + ux * d, a[1] + uy * d]);
      d += spacing;
    }
    leftover = segLen - (d - spacing);
  }
  /* evita ponto duplicado no fechamento */
  const last = out[out.length - 1], first = out[0];
  if (Math.hypot(last[0] - first[0], last[1] - first[1]) < spacing * 0.5) out.pop();
  return out;
}

/* escurece (t<0) ou clareia (t>0) uma cor #rrggbb */
function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = v => clamp(Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t), 0, 255);
  return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
}

/* Suaviza apenas os "bicos" do traçado: onde o raio da curva fica
   menor que minRadius, o ponto é puxado para o meio dos vizinhos.
   Sem isso, uma chicane desenhada à mão vira uma curva impossível. */
function relaxCurvature(pts, spacing, minRadius, passes) {
  let cur = pts.map(p => p.slice());
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    /* algumas iterações de suavização... */
    for (let it = 0; it < 14; it++) {
      const n = cur.length;
      const out = cur.map(p => p.slice());
      let changed = false;
      for (let i = 0; i < n; i++) {
        const a = cur[(i - 1 + n) % n], b = cur[i], c = cur[(i + 1) % n];
        const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
        const dth = Math.abs(wrapAngle(a2 - a1));
        /* o espaçamento local encolhe conforme os pontos são puxados, então
           medir com o espaçamento original superestima o raio */
        const step = (Math.hypot(b[0] - a[0], b[1] - a[1]) +
          Math.hypot(c[0] - b[0], c[1] - b[1])) / 2;
        if (step / Math.max(dth, 1e-6) < minRadius) {
          const w = clamp(1 - (step / Math.max(dth, 1e-6)) / minRadius, 0, 1) * 0.5;
          out[i][0] = b[0] + ((a[0] + c[0]) / 2 - b[0]) * w;
          out[i][1] = b[1] + ((a[1] + c[1]) / 2 - b[1]) * w;
          changed = true;
        }
      }
      cur = out;
      if (!changed) { if (it === 0) return cur; break; }
      moved = true;
    }
    /* ...e redistribui: sem isso os pontos se amontoam no ápice e a curva
       continua fechada mesmo depois de "suavizada" */
    cur = resampleClosed(cur, spacing);
    if (!moved) break;
  }
  return cur;
}

function fmtTime(ms) {
  if (ms == null || !isFinite(ms) || ms <= 0) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor(ms % 1000);
  return (m > 0 ? m + ":" : "") + String(s).padStart(m > 0 ? 2 : 1, "0") + "." + String(cs).padStart(3, "0");
}

function ordinal(n) { return n + "º"; }
