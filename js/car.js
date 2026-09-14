/* ============================================================
   car.js - física arcade de drift
   Modelo: a velocidade é decomposta em componente frontal e
   lateral. A lateral é "comida" pelo grip; com o freio de mão
   o grip cai e o carro derrapa de lado.
   ============================================================ */
'use strict';

/* proporções de um monoposto visto de cima: comprido e estreito,
   com as rodas para fora da carroceria */
/* ---------- câmbio ----------
   GEAR_TOP é a fração da velocidade máxima em que cada marcha bate o
   corte. A curva de torque faz o motor render mais perto do corte: é o
   que dá sentido a trocar na hora certa. */
const GEAR_TOP = [0.20, 0.35, 0.52, 0.69, 0.85, 1.0];
const SHIFT_TIME = 0.10;
/* Depois de subir a marcha a rotação cai para ~0.55 (a 1ª para a 2ª é o
   salto maior). Se o limite para reduzir ficar perto disso, ele sobe e
   desce sem parar. Daí a folga larga e o bloqueio após cada troca. */
const SHIFT_DOWN_RPM = 0.42;
const SHIFT_LOCK = 0.35;

/* boxes */
const PIT_SPEED = 146;     /* limitador, ~90 km/h */
const PIT_SERVICE = 2.2;   /* segundos parado trocando pneu */

function torqueAt(x) {
  if (x < 0.85) return clamp(0.62 + 0.62 * x, 0.62, 1.15);
  return clamp(1.15 - (x - 0.85) * 1.6, 0.58, 1.15);
}

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
    this.draft = 0;          /* 0..1, quanto vácuo está pegando agora */
    this.lapClean = true;    /* a volta atual vale como tempo? */
    this.tyre = 1;           /* 1 = pneu novo, 0.35 = acabado */
    this.tyreLoss = 0;
    this.wet = 0;            /* 0 = pista seca, 1 = encharcada */
    this.gear = 0;           /* 0..5 = 1ª a 6ª */
    this.rpm = 0;            /* 0..1.15, sendo 1 o corte */
    this.shiftT = 0;         /* tempo restante de troca (sem tração) */
    this.shiftLock = 0;      /* trava contra troca em sequência */
    this.shiftFlash = 0;
    this.inPit = false;      /* dentro do corredor dos boxes */
    this.pitPhase = 0;       /* 0 fora, 1 parado sendo atendido, 2 já atendido */
    this.pitTimer = 0;
    this.pitStops = 0;
    this.pitWanted = false;  /* a IA usa para decidir entrar */
    this.outTimer = 0;
    this.wheelTrail = [null, null];
    this.assist = 0.55;
  }

  shiftTo(g) {
    if (g === this.gear) return;
    this.gear = g;
    this.shiftT = SHIFT_TIME;
    this.shiftLock = SHIFT_LOCK;
    this.shiftFlash = 0.18;
  }

  placeAtArc(s, lateral) {
    const p = this.track.atArc(s);
    this.x = p.x + p.nx * lateral;
    this.y = p.y + p.ny * lateral;
    this.angle = p.ang;
    this.vx = 0; this.vy = 0;
    this.gear = 0; this.rpm = 0; this.shiftT = 0; this.shiftLock = 0;
    this.idx = this.prevIdx = this.track.nearestIndex(this.x, this.y, null);
  }

  update(dt, inp, now) {
    const track = this.track;
    const sp = this.spec;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const speed0 = Math.hypot(this.vx, this.vy);

    let fwd = this.vx * ca + this.vy * sa;
    let lat = -this.vx * sa + this.vy * ca;

    const surf = track.surfaceAt(this.x, this.y, this.idx);
    this.idx = surf.idx;
    this.offTrack = !surf.onTrack;
    this.onKerb = surf.kerb;

    /* limites de pista: passar da zebra por mais de um instante anula a
       volta. Sem isso dá para cortar curva e bater recorde sem merecer. */
    if (surf.dist > track.half + 14 && !this.inPit) {
      this.outTimer += dt;
      if (this.outTimer > 0.15) this.lapClean = false;
    } else {
      this.outTimer = 0;
    }

    /* ---- boxes ----
       O corredor vale como pista: nada de penalidade de grama nem volta
       anulada, mas com limitador de velocidade. */
    const P = track.pit;
    let pitInfo = null;
    if (P) {
      const dIdx = Math.min(this.idx, track.n - this.idx);
      if (dIdx * track.spacing < P.len * 0.75) pitInfo = track.pitAt(this.x, this.y);
    }
    this.inPit = !!(pitInfo && pitInfo.dist < 30 && surf.dist > track.half * 0.75);
    if (this.inPit) {
      this.lapClean = this.lapClean;      /* o box não anula a volta */
      this.outTimer = 0;
      if (fwd > PIT_SPEED) fwd = PIT_SPEED;
      /* parada na vaga */
      const naVaga = Math.abs(pitInfo.i - P.boxIdx) <= 3;
      if (this.pitPhase === 0 && naVaga && speed0 < 38) {
        this.pitPhase = 1; this.pitTimer = PIT_SERVICE;
      }
      if (this.pitPhase === 1) {
        this.pitTimer -= dt;
        fwd = 0; lat = 0;
        this.vx = 0; this.vy = 0;
        if (this.pitTimer <= 0) {
          this.tyre = 1; this.pitPhase = 2; this.pitStops++; this.pitWanted = false;
        }
      }
    } else if (this.pitPhase === 2) {
      this.pitPhase = 0;
    }

    const off = this.offTrack && !this.inPit;
    const power = (off ? 0.48 : 1) * (1 - this.wet * 0.10);
    let drag = off ? 2.9 : 1.06 + (fwd > 0 ? fwd / sp.top * 0.5 : 0);
    /* no vácuo o carro da frente abre o ar: menos arrasto, mais ponta */
    if (!off && this.draft > 0) drag *= 1 - 0.17 * this.draft;

    /* Pneu: gasta com o tempo, e MUITO mais atravessado. É o custo do
       drift - render pontos custa borracha, e borracha gasta custa volta. */
    const gasto = (0.0038 + Math.abs(this.slip) * 0.013 +
      (speed0 / sp.top) * 0.0020) * dt;
    this.tyre = Math.max(0.35, this.tyre - gasto);
    /* a perda cresce mais rápido no fim da vida do pneu: é isso que faz a
       parada nos boxes virar decisão, e não enfeite */
    const velho = Math.pow(1 - this.tyre, 1.4) * 1.70;
    this.tyreLoss = velho;      /* a IA usa para levantar o pé */

    /* ---- câmbio ---- */
    const topG = sp.top * GEAR_TOP[this.gear];
    this.rpm = clamp(Math.max(fwd, 0) / topG, 0, 1.15);
    if (this.shiftT > 0) this.shiftT -= dt;
    if (this.shiftLock > 0) this.shiftLock -= dt;
    if (this.shiftFlash > 0) this.shiftFlash -= dt;

    if (inp.shiftUp && this.gear < 5 && this.shiftT <= 0) this.shiftTo(this.gear + 1);
    else if (inp.shiftDown && this.gear > 0 && this.shiftT <= 0) this.shiftTo(this.gear - 1);
    else if (inp.autoGear !== false && this.shiftT <= 0 && this.shiftLock <= 0) {
      if (this.rpm > 0.97 && this.gear < 5) this.shiftTo(this.gear + 1);
      else if (this.gear > 0 && this.rpm < SHIFT_DOWN_RPM &&
        fwd / (sp.top * GEAR_TOP[this.gear - 1]) < 0.99) this.shiftTo(this.gear - 1);
    }

    /* motor e freio */
    const torque = this.shiftT > 0 ? 0 : torqueAt(this.rpm);
    if (inp.throttle > 0) fwd += sp.engine * torque * power * inp.throttle * dt;
    if (inp.brake > 0) {
      if (fwd > 2) fwd -= sp.brake * (1 - this.wet * 0.24) *
        clamp(1 - velho * 0.11, 0.84, 1) * inp.brake * dt;
      else fwd = Math.max(fwd - 260 * inp.brake * dt, -130);
    }
    fwd -= fwd * drag * dt;
    if (inp.handbrake && fwd > 0) fwd -= fwd * 0.9 * dt;

    /* aderência lateral: quanto mais perto de 1, mais escorrega */
    let g = inp.handbrake ? sp.driftGrip : sp.grip;
    g = Math.min(0.988, g + velho * 0.042 + this.wet * 0.034);
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
    this.angle += this.steerAngle * sp.turn * clamp(1 - velho * 0.13, 0.80, 1) *
      resp * hiDamp * dir * dt;

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
    if (surf.dist > limit && !this.inPit) {
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
            this.lastLapClean = this.lapClean;
            this.lapTimes.push(t);
            if (this.lapClean && (this.bestLap == null || t < this.bestLap)) this.bestLap = t;
          }
        }
        this.lap++;
        this.lapStart = now;
        this.lapClean = true;
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

/* Vácuo: quem vem logo atrás e alinhado com outro carro pega ar limpo.
   Sem isso a ultrapassagem depende só de ser mais rápido na curva, e a
   reta nunca vira oportunidade. */
const DRAFT_LEN = 155, DRAFT_WIDE = 28;

function updateSlipstream(cars) {
  for (const c of cars) c.draft = 0;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.speed < 90) continue;
    const ca = Math.cos(a.angle), sa = Math.sin(a.angle);
    let melhor = 0;
    for (let j = 0; j < cars.length; j++) {
      if (i === j) continue;
      const b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const frente = dx * ca + dy * sa;
      if (frente < 14 || frente > DRAFT_LEN) continue;
      const lado = Math.abs(-dx * sa + dy * ca);
      if (lado > DRAFT_WIDE) continue;
      const f = (1 - frente / DRAFT_LEN) * (1 - lado / DRAFT_WIDE);
      if (f > melhor) melhor = f;
    }
    a.draft = melhor;
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
