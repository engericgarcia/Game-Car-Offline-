/* ============================================================
   ai.js - pilotos controlados pelo computador
   Miram um ponto adiante na trajetória ideal e calculam a
   velocidade máxima possível pela curvatura da curva que vem.
   ============================================================ */
'use strict';

/* Níveis de dificuldade. `base` é o ritmo do adversário: multiplica a
   velocidade de curva e a velocidade máxima que a IA se permite usar.
   A força da equipe (tier, 0.96-1.00) ainda pesa por cima disso. */
const DIFFICULTIES = [
  { name: 'Muito fácil', base: 0.76, desc: 'para aprender os traçados' },
  { name: 'Fácil', base: 0.85, desc: 'dá para ganhar sem volta perfeita' },
  { name: 'Normal', base: 0.93, desc: 'exige volta limpa' },
  { name: 'Difícil', base: 1.00, desc: 'ritmo de referência' },
  { name: 'Extremo', base: 1.07, desc: 'o limite do carro' }
];

class AIDriver {
  constructor(car, skill, lane) {
    this.car = car;
    this.skill = skill;          /* 0.86 (lento) .. 1.06 (rápido) */
    this.lane = lane;            /* deslocamento lateral preferido */
    this.noise = Math.random() * 1000;
    this.hbTimer = 0;
    this.stuck = 0;
    this.reverse = 0;
  }

  think(dt, t) {
    const car = this.car, track = car.track, n = track.n;
    const speed = car.speed;
    const off = car.offTrack;

    /* ---- recuperação: preso no muro ou atolado ---- */
    if (speed < 34) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt * 2.5);
    if (this.stuck > 1.1 && this.reverse <= 0) { this.reverse = 1.0; this.stuck = 0; }
    if (this.reverse > 0) {
      this.reverse -= dt;
      const rp = track.pts[(car.idx + 8) % n];
      const rd = wrapAngle(Math.atan2(rp.y - car.y, rp.x - car.x) - car.angle);
      return { steer: clamp(-rd * 2, -1, 1), throttle: 0, brake: 1, handbrake: false };
    }

    /* ponto de mira à frente, proporcional à velocidade */
    const aheadUnits = (off ? 30 : 46) + speed * 0.38;
    const ai = (car.idx + Math.round(aheadUnits / track.spacing)) % n;
    const ap = track.pts[ai];

    /* trajetória: por dentro da curva, aberto na reta.
       fora da pista, mira direto na linha central para voltar */
    const k = ap.curv;
    const apexPull = clamp(Math.abs(k) * track.length / 8, 0, 1);
    const wob = Math.sin((t * 0.0007) + this.noise) * 0.07;
    const offset = off ? 0
      : (-Math.sign(k) * apexPull * 0.30 + this.lane * (1 - apexPull * 0.6) + wob) * track.half;
    const tx = ap.x + ap.nx * offset;
    const ty = ap.y + ap.ny * offset;

    /* esterço: mira no ponto à frente + correção do desvio lateral atual
       (só a mira faz o carro cortar a curva por dentro e sair da pista) */
    const cp = track.pts[car.idx];
    const latNow = (car.x - cp.x) * cp.nx + (car.y - cp.y) * cp.ny;
    const latErr = latNow - offset;
    const want = Math.atan2(ty - car.y, tx - car.x);
    const diff = wrapAngle(want - car.angle);
    const steer = clamp(diff * 2.2 - latErr * 0.007, -1, 1);

    /* velocidade alvo: pior curvatura nos próximos ~150 pontos */
    let worst = 0;
    const span = Math.round((60 + speed * 0.62) / track.spacing);
    for (let s = 2; s < span; s += 3) {
      const c = Math.abs(track.pts[(car.idx + s) % n].curv);
      const weight = 1 - (s / span) * 0.35;
      if (c * weight > worst) worst = c * weight;
    }
    /* nesta física quem limita a curva é a velocidade de giro do carro:
       raio = v / w, com w máximo = turn * (1 - 0.4 * v/top).
       Resolvendo para v dá a velocidade máxima de passagem na curva. */
    const yawLimit = car.spec.turn / (worst + 0.4 * car.spec.turn / car.spec.top);
    let target = 0.90 * this.skill * yawLimit;
    target = Math.min(target, car.spec.top * this.skill);
    if (off) target = Math.min(target, 190);
    /* muito atravessado em relação ao alvo: reduz até se alinhar */
    if (Math.abs(diff) > 0.8) target = Math.min(target, 130);

    let throttle = 0, brake = 0;
    if (speed > target * 1.05) brake = clamp((speed - target) / 95, 0.2, 0.9);
    else throttle = clamp((target - speed) / 40 + 0.4, 0, 1);
    if (off) throttle = Math.min(throttle, 0.65);

    /* freio de mão em curvas bem fechadas: deixa a IA atravessada também */
    this.hbTimer -= dt;
    if (!off && this.hbTimer <= -0.9 && Math.abs(diff) > 0.62 && speed > 200 &&
      Math.abs(k) * track.length > 34) {
      this.hbTimer = 0.45;
    }
    const handbrake = this.hbTimer > 0.2;

    return { steer: steer, throttle: throttle, brake: brake, handbrake: handbrake };
  }
}

/* Monta o grid a partir de uma lista de inscrições já na ordem de
   largada (a primeira é a pole). Uma delas tem isPlayer. */
function makeGrid(track, entries, difficulty) {
  const cars = [], ais = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const car = new Car(e, track, e.isPlayer);
    const arc = -(GRID_BACK + i * GRID_GAP);
    const lateral = (i % 2 === 0 ? -1 : 1) * track.half * 0.34;
    car.placeAtArc((track.length + arc) % track.length, lateral);
    car.name = e.name;
    car.entry = e;
    car.gridPos = i + 1;
    cars.push(car);
    if (!e.isPlayer) {
      /* a força da equipe pesa, mas o dia do piloto pesa também: sem esta
         variação as corridas terminam sempre na mesma ordem das equipes */
      const nivel = DIFFICULTIES[clamp(difficulty | 0, 0, DIFFICULTIES.length - 1)];
      const base = nivel.base * (e.team ? e.team.tier : 1);
      const forma = (Math.random() - 0.5) * 0.055;
      ais.push(new AIDriver(car, base + forma, (Math.random() - 0.5) * 0.44));
    }
  }
  return { cars: cars, ais: ais };
}

