/* ============================================================
   tracks.js - circuitos inspirados na Fórmula 1
   Cada pista é uma lista de pontos de controle (o primeiro ponto
   é sempre a linha de chegada) suavizada por spline.
   ============================================================ */
'use strict';

const TRACK_DEFS = [
  {
    id: 'monza',
    name: 'Monza',
    sub: 'Templo da Velocidade',
    country: '🇮🇹',
    width: 66, runoff: 74, grass: '#3f7d3a', asphalt: '#5b5f66',
    laps: 3, difficulty: 1,
    points: [
      [136, 560], [134, 430], [136, 320], [152, 248],
      [186, 206], [232, 230],                              /* Variante del Rettifilo */
      [306, 202], [424, 178], [542, 172],
      [652, 192], [732, 244], [772, 318],                  /* Curva Grande */
      [760, 386], [718, 408], [746, 460],                  /* Variante della Roggia */
      [802, 508], [848, 568],                              /* Lesmo 1 */
      [820, 622], [758, 646],                              /* Lesmo 2 */
      [648, 660], [556, 664],
      [476, 658], [430, 630], [396, 598], [340, 590],      /* Variante Ascari */
      [268, 606], [196, 632], [150, 634], [128, 606]       /* Parabolica */
    ]
  },
  {
    id: 'monaco',
    name: 'Mônaco',
    sub: 'Circuito de rua',
    country: '🇲🇨',
    width: 48, runoff: 9, grass: '#4a5568', asphalt: '#63676e',
    laps: 3, difficulty: 3, urban: true, minRadius: 34,
    points: [
      [150, 620], [150, 500], [162, 405], [192, 330], [248, 278], [330, 252],
      [398, 268], [432, 312], [472, 352], [522, 372], [558, 398], [537, 428],
      [487, 428], [452, 458], [466, 502], [540, 526], [650, 536], [762, 530],
      [822, 502], [850, 542], [812, 588], [742, 616], [650, 640], [560, 652],
      [505, 615], [465, 578], [420, 596], [385, 638], [330, 652], [250, 656],
      [182, 650]
    ]
  },
  {
    id: 'interlagos',
    name: 'Interlagos',
    sub: 'Autódromo José Carlos Pace',
    country: '🇧🇷',
    width: 62, runoff: 56, grass: '#437f36', asphalt: '#585c62',
    laps: 3, difficulty: 2,
    points: [
      [185, 505], [180, 430], [195, 360], [240, 325], [248, 278], [275, 240],
      [345, 225], [450, 240], [570, 262], [690, 285], [775, 315], [800, 370],
      [755, 400], [690, 405], [630, 415], [590, 465], [630, 505], [665, 540],
      [645, 585], [580, 595], [520, 575], [492, 530], [445, 545], [398, 592],
      [350, 625], [300, 640], [240, 615], [200, 570]
    ]
  },
  {
    id: 'spa',
    name: 'Spa',
    sub: 'Ardenas - alta velocidade',
    country: '🇧🇪',
    width: 66, runoff: 62, grass: '#38703a', asphalt: '#54585e',
    laps: 2, difficulty: 2,
    points: [
      [170, 655], [138, 644], [128, 614], [152, 592], [192, 580], [226, 516],
      [258, 450], [330, 382], [430, 302], [540, 242], [642, 206], [712, 226],
      [736, 286], [700, 336], [732, 386], [792, 422], [818, 482], [782, 538],
      [722, 572], [652, 602], [542, 626], [432, 642], [352, 650], [302, 628],
      [262, 652]
    ]
  },
  {
    id: 'arena',
    name: 'Arena de Drift',
    sub: 'Treino livre - só derrapar',
    country: '🏁',
    width: 200, runoff: 44, grass: '#39404e', asphalt: '#6b7078',
    laps: 5, difficulty: 1, arena: true, minRadius: 90,
    points: [
      [250, 250], [500, 218], [750, 250], [845, 400], [750, 552],
      [500, 592], [250, 552], [162, 400]
    ]
  }
];

const TRACK_SPACING = 5;   /* distância entre pontos da linha central */

/* Constrói toda a geometria derivada de uma pista */
function buildTrack(def) {
  const smooth = catmullRomClosed(def.points, 24);
  let cl = resampleClosed(smooth, TRACK_SPACING);
  /* tira os bicos do desenho à mão e reamostra de novo */
  const minR = def.minRadius || Math.max(40, def.width * 0.8);
  cl = relaxCurvature(cl, TRACK_SPACING, minR, 140);
  cl = resampleClosed(cl, TRACK_SPACING);
  const n = cl.length;

  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = cl[i], nx = cl[(i + 1) % n], pv = cl[(i - 1 + n) % n];
    let tx = nx[0] - pv[0], ty = nx[1] - pv[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    pts[i] = { x: p[0], y: p[1], tx: tx, ty: ty, nx: -ty, ny: tx, curv: 0, ang: Math.atan2(ty, tx) };
  }
  /* curvatura = variação de ângulo por unidade de comprimento */
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 2 + n) % n].ang, b = pts[(i + 2) % n].ang;
    pts[i].curv = wrapAngle(b - a) / (4 * TRACK_SPACING);
  }
  /* suaviza a curvatura para os kerbs não ficarem picotados */
  const cs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -3; k <= 3; k++) s += pts[(i + k + n) % n].curv;
    cs[i] = s / 7;
  }
  for (let i = 0; i < n; i++) pts[i].curv = cs[i];

  /* limites do desenho */
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const pad = def.width / 2 + def.runoff + 60;

  /* grade espacial para achar o ponto mais próximo sem varrer tudo */
  const cell = 48;
  const gx0 = Math.floor((minX - pad) / cell), gy0 = Math.floor((minY - pad) / cell);
  const gw = Math.ceil((maxX + pad) / cell) - gx0 + 1;
  const gh = Math.ceil((maxY + pad) / cell) - gy0 + 1;
  const grid = new Array(gw * gh);
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(pts[i].x / cell) - gx0, cy = Math.floor(pts[i].y / cell) - gy0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = (cy + dy) * gw + (cx + dx);
      if (k < 0 || k >= grid.length) continue;
      (grid[k] || (grid[k] = [])).push(i);
    }
  }

  const track = {
    def: def, pts: pts, n: n, spacing: TRACK_SPACING,
    width: def.width, half: def.width / 2, runoff: def.runoff,
    length: n * TRACK_SPACING,
    bounds: { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 },

    /* índice do ponto mais próximo, buscando primeiro numa janela
       ao redor do último índice conhecido (rápido e evita saltos) */
    nearestIndex: function (x, y, lastIdx) {
      if (lastIdx != null) {
        let best = -1, bestD = Infinity;
        for (let k = -40; k <= 140; k++) {
          const i = (lastIdx + k + n) % n;
          const d = dist2(x, y, pts[i].x, pts[i].y);
          if (d < bestD) { bestD = d; best = i; }
        }
        if (bestD < 90000) return best;
      }
      const cx = Math.floor(x / cell) - gx0, cy = Math.floor(y / cell) - gy0;
      const bucket = (cy >= 0 && cy < gh && cx >= 0 && cx < gw) ? grid[cy * gw + cx] : null;
      let best = 0, bestD = Infinity;
      const list = bucket && bucket.length ? bucket : null;
      if (list) {
        for (let j = 0; j < list.length; j++) {
          const d = dist2(x, y, pts[list[j]].x, pts[list[j]].y);
          if (d < bestD) { bestD = d; best = list[j]; }
        }
      } else {
        for (let i = 0; i < n; i += 2) {
          const d = dist2(x, y, pts[i].x, pts[i].y);
          if (d < bestD) { bestD = d; best = i; }
        }
      }
      return best;
    },

    /* onde estou em relação à pista */
    surfaceAt: function (x, y, lastIdx) {
      const i = track.nearestIndex(x, y, lastIdx);
      const p = pts[i];
      const dx = x - p.x, dy = y - p.y;
      const side = dx * p.nx + dy * p.ny;          /* distância lateral com sinal */
      const dist = Math.abs(side);
      return {
        idx: i, dist: dist, side: side,
        onTrack: dist <= track.half,
        kerb: dist > track.half - 7 && dist <= track.half + 4,
        nx: p.nx, ny: p.ny
      };
    },

    /* posição a X unidades de comprimento de arco da linha de chegada */
    atArc: function (s) {
      let i = Math.round(s / TRACK_SPACING) % n;
      if (i < 0) i += n;
      return pts[i];
    }
  };
  return track;
}
