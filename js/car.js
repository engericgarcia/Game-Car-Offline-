/* ============================================================
   car.js - física arcade de drift
   Modelo: a velocidade é decomposta em componente frontal e
   lateral. A lateral é "comida" pelo grip; com o freio de mão
   o grip cai e o carro derrapa de lado.
   ============================================================ */
'use strict';

/* proporções de um monoposto visto de cima: comprido e estreito,
   com as rodas para fora da carroceria */
const CAR_LEN = 34, CAR_WID = 20;
const WHEEL_FX = 8.5, WHEEL_FY = 8.6;    /* eixo dianteiro */
const WHEEL_RX = -9.5, WHEEL_RY = 9.2;   /* eixo traseiro  */

class Car {
  constructor(spec, track, isPlayer) {
    this.spec = spec;
    this.track = track;
    this.isPlayer = !!isPlayer;
    this.x = 0; this.y = 0; this.angle = 0;
    this.vx = 0; this.vy = 0;
    this.steerAngle = 0;
    this.idx = 0; this.prevIdx = 0;
    this.lap = 0; this.finished = false; this.finishTime = 0;
    this.lapStart = 0; this.bestLap = null; this.lastLap = null; this.lapTimes = [];
    this.slip = 0; this.speed = 0; this.offTrack = false;
    this.driftScore = 0; this.driftCombo = 1; this.driftTimer = 0; this.driftBank = 0;
    this.hitTimer = 0; this.name = spec.name; this.halfPassed = true;
    this.wheelTrail = [null, null];
    this.assist = 0.55;
  }

  placeAtArc(s, lateral) {
    const p = this.track.atArc(s);
    this.x = p.x + p.nx * lateral;
    this.y = p.y + p.ny * lateral;
    this.angle = p.ang;
    this.vx = 0; this.vy = 0;
    this.idx = this.prevIdx = this.track.nearestIndex(this.x, this.y, null);
  }

  update(dt, inp, now) {
    const track = this.track;
    const sp = this.spec;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);

    let fwd = this.vx * ca + this.vy * sa;
    let lat = -this.vx * sa + this.vy * ca;

    const surf = track.surfaceAt(this.x, this.y, this.idx);
    this.idx = surf.idx;
    this.offTrack = !surf.onTrack;
    this.onKerb = surf.kerb;

    const off = this.offTrack;
    const power = off ? 0.48 : 1;
    const drag = off ? 2.9 : 1.06 + (fwd > 0 ? fwd / sp.top * 0.5 : 0);

    /* motor e freio */
    if (inp.throttle > 0) fwd += sp.engine * power * inp.throttle * dt;
    if (inp.brake > 0) {
      if (fwd > 2) fwd -= sp.brake * inp.brake * dt;
      else fwd = Math.max(fwd - 260 * inp.brake * dt, -130);
    }
    fwd -= fwd * drag * dt;
    if (inp.handbrake && fwd > 0) fwd -= fwd * 0.9 * dt;

    /* aderência lateral: quanto mais perto de 1, mais escorrega */
    let g = inp.handbrake ? sp.driftGrip : sp.grip;
    if (off) g = Math.min(0.972, g + 0.075);
    if (this.onKerb) g = Math.min(0.975, g + 0.03);
    /* acelerar forte durante a derrapagem mantém o carro atravessado */
    if (inp.throttle > 0.6 && Math.abs(lat) > 30) g = Math.min(0.985, g + 0.02);
    lat *= Math.pow(g, dt * 60);

    /* recompõe a velocidade AINDA com o ângulo antigo (é daqui que nasce o drift) */
    this.vx = fwd * ca - lat * sa;
    this.vy = fwd * sa + lat * ca;

    /* direção */
    const speed = Math.hypot(this.vx, this.vy);
    this.speed = speed;
    const resp = Math.min(1, speed / 62);
    const hiDamp = 1 - 0.40 * Math.min(1, speed / sp.top);
    const dir = fwd >= -1 ? 1 : -1;
    this.steerAngle += (inp.steer - this.steerAngle) * Math.min(1, dt * 10);
    this.angle += this.steerAngle * sp.turn * resp * hiDamp * dir * dt;

    /* ângulo de derrapagem */
    this.slip = (speed > 6) ? wrapAngle(Math.atan2(this.vy, this.vx) - this.angle) : 0;
    if (fwd < -1) this.slip = 0;

    /* ajuda de contra-esterço: estabiliza sem tirar a diversão */
    if (this.assist > 0 && !inp.handbrake && Math.abs(this.slip) > 0.35 && fwd > 20) {
      const corr = -this.slip * (Math.abs(this.slip) - 0.35) * 2.2 * this.assist;
      this.angle -= corr * dt;
    }

    /* integração */
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* muros e limites do circuito */
    const limit = track.half + track.runoff;
    if (surf.dist > limit) {
      const s2 = track.surfaceAt(this.x, this.y, this.idx);
      if (s2.dist > limit) {
        const over = s2.dist - limit;
        const sgn = Math.sign(s2.side) || 1;
        this.x -= s2.nx * sgn * over;
        this.y -= s2.ny * sgn * over;
        const vn = this.vx * s2.nx * sgn + this.vy * s2.ny * sgn;
        if (vn > 0) { this.vx -= s2.nx * sgn * vn * 1.4; this.vy -= s2.ny * sgn * vn * 1.4; }
        this.vx *= 0.80; this.vy *= 0.80;
        this.hitTimer = 0.25;
      }
    }
    if (this.hitTimer > 0) this.hitTimer -= dt;

    /* pontuação de drift */
    const driftOk = !off && Math.abs(this.slip) > 0.22 && speed > 85;
    if (driftOk) {
      this.driftTimer += dt;
      this.driftCombo = Math.min(6, 1 + this.driftTimer * 0.55);
      this.driftBank += speed * Math.abs(this.slip) * dt * 0.42;
    } else {
      if (this.driftTimer > 0.35 && !off) this.driftScore += Math.round(this.driftBank * this.driftCombo);
      else if (off) this.driftScore += Math.round(this.driftBank * 0.2);
      this.driftBank = 0; this.driftTimer = 0; this.driftCombo = 1;
    }

    /* voltas */
    this.checkLap(now);
  }

  checkLap(now) {
    const n = this.track.n;
    const a = this.prevIdx, b = this.idx;
    /* só vale a volta depois de passar pelo meio do traçado -
       evita "voltas fantasma" com o carro parado em cima da linha */
    if (b > n * 0.40 && b < n * 0.64) this.halfPassed = true;
    if (a > n * 0.72 && b < n * 0.28) {
      if (this.halfPassed) {
        if (this.lapStart > 0) {
          const t = now - this.lapStart;
          if (t > 3000) {
            this.lastLap = t;
            this.lapTimes.push(t);
            if (this.bestLap == null || t < this.bestLap) this.bestLap = t;
          }
        }
        this.lap++;
        this.lapStart = now;
        this.halfPassed = false;
      }
    } else if (a < n * 0.28 && b > n * 0.72) {
      this.halfPassed = false;
    }
    this.prevIdx = b;
  }

  progress() { return this.lap * this.track.n + this.idx; }

  /* posições dos 4 pneus no mundo (para marcas e fumaça) */
  wheelPos(front, right) {
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const lx = front ? WHEEL_FX : WHEEL_RX;
    const ly = (right ? 1 : -1) * (front ? WHEEL_FY : WHEEL_RY);
    return [this.x + lx * ca - ly * sa, this.y + lx * sa + ly * ca];
  }
}

/* colisão simples entre carros: empurra e troca um pouco de energia */
function resolveCarCollisions(cars, trackN) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      /* carros com voltas muito diferentes não colidem (evita fantasmas) */
      const dp = Math.abs((a.idx - b.idx + trackN) % trackN);
      if (Math.min(dp, trackN - dp) > trackN * 0.08) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = 27;
      if (d > minD || d < 0.0001) continue;
      const ux = dx / d, uy = dy / d;
      const push = (minD - d) * 0.5;
      a.x -= ux * push; a.y -= uy * push;
      b.x += ux * push; b.y += uy * push;
      const rel = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
      if (rel < 0) {
        const imp = rel * 0.55;
        a.vx += ux * imp; a.vy += uy * imp;
        b.vx -= ux * imp; b.vy -= uy * imp;
        a.hitTimer = b.hitTimer = 0.18;
      }
    }
  }
}
