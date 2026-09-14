/* ============================================================
   tracks.js - circuitos inspirados na Fórmula 1
   Cada pista é uma lista de pontos de controle (o primeiro ponto
   é sempre a linha de chegada) suavizada por spline.
   ============================================================ */
'use strict';

/* refLap = melhor volta possivel (ms) com a equipe de ponta no limite.
   E a referencia usada para gerar os tempos da classificacao. */
const TRACK_DEFS = [
  {
    id: 'monza', scale: 1.5, gp: 'GP da Itália', refLap: 24358,
    name: 'Monza',
    sub: 'Templo da Velocidade · 11 curvas',
    country: '🇮🇹',
    width: 112, runoff: 100, minRadius: 70,
    grass: '#3f7d3a', asphalt: '#5b5f66',
    laps: 3, difficulty: 1,
    /* Reta principal → Variante del Rettifilo → Curva Grande → Variante della
       Roggia → Lesmo 1 e 2 → reta do Serraglio → Variante Ascari → reta
       oposta → Parabolica. Sentido horário. */
    points: [
      [305, 1480], [300, 1330], [297, 1180], [295, 1020], [296, 870],
      [303, 760],
      [330, 672], [398, 622], [452, 588],                    /* Rettifilo */
      [478, 522], [512, 452], [566, 372], [642, 300],
      [736, 246], [846, 212], [962, 200], [1074, 214],       /* Curva Grande */
      [1168, 252], [1232, 306],
      [1252, 356], [1216, 400], [1258, 442],                 /* Roggia */
      [1322, 478], [1408, 520],
      [1492, 574], [1546, 646], [1580, 716],                 /* Lesmo 1 */
      [1652, 762], [1664, 850],                              /* Lesmo 2 */
      [1616, 942], [1548, 1046], [1470, 1150], [1396, 1244], /* Serraglio */
      [1338, 1318], [1258, 1352], [1206, 1408], [1128, 1452],/* Ascari */
      [1020, 1500], [900, 1550], [778, 1602], [656, 1658],
      [546, 1718], [452, 1782], [372, 1820],                 /* Parabolica */
      [306, 1806], [278, 1740], [282, 1650], [292, 1560]
    ]
  },
  {
    id: 'monaco', scale: 1.09, gp: 'GP de Mônaco', refLap: 19925,
    name: 'Mônaco',
    sub: 'Circuito de rua · 19 curvas',
    country: '🇲🇨',
    width: 78, runoff: 12, minRadius: 52,
    grass: '#4a5568', asphalt: '#63676e',
    laps: 4, difficulty: 3, urban: true,
    /* Sainte Dévote → Beau Rivage → Massenet → Casino → Mirabeau → Grand
       Hotel → Portier → túnel → Nouvelle Chicane → Tabac → piscina →
       Rascasse → Anthony Noghès. */
    points: [
      [330, 1080], [400, 1042], [470, 1012],
      [536, 986], [586, 944], [600, 880],                     /* Sainte Dévote */
      [612, 810], [634, 730], [664, 652],                     /* Beau Rivage */
      [706, 580], [766, 524], [840, 494],                     /* Massenet */
      [912, 492], [972, 520], [1008, 572],                    /* Casino */
      [1022, 636], [1064, 692], [1122, 726],                  /* Mirabeau Haute */
      [1180, 748], [1226, 776], [1234, 826],
      [1192, 852], [1136, 848], [1086, 830],                  /* Grand Hotel */
      [1046, 850], [1032, 902], [1058, 952],                  /* Portier */
      [1122, 980], [1210, 1000], [1310, 1010],
      [1408, 1004], [1498, 984], [1570, 976],                 /* túnel */
      [1626, 1006], [1660, 1048], [1618, 1082],               /* Nouvelle Chicane */
      [1552, 1096], [1466, 1116], [1378, 1142],               /* Tabac */
      [1300, 1180], [1240, 1216], [1178, 1228],
      [1116, 1204], [1062, 1218], [1020, 1258],               /* piscina */
      [964, 1282], [908, 1268], [862, 1290],
      [828, 1318], [776, 1330], [720, 1314],                  /* Rascasse */
      [668, 1292], [596, 1274], [512, 1250],                  /* Anthony Noghès */
      [430, 1204], [366, 1148]
    ]
  },
  {
    id: 'interlagos', scale: 1.41, gp: 'GP do Brasil', refLap: 19742,
    name: 'Interlagos',
    sub: 'Autódromo José Carlos Pace · 15 curvas',
    country: '🇧🇷',
    width: 100, runoff: 78, minRadius: 62,
    grass: '#437f36', asphalt: '#585c62',
    laps: 4, difficulty: 2,
    /* Subida dos boxes → S do Senna → Curva do Sol → Reta Oposta → Descida
       do Lago → Ferradura → Laranjinha → Pinheirinho → Bico de Pato →
       Mergulho → Junção. Sentido anti-horário. */
    points: [
      [300, 900], [292, 800], [288, 700], [296, 610],
      [318, 530], [364, 466], [430, 434], [478, 400],         /* S do Senna */
      [498, 340], [520, 280], [572, 232],                     /* Curva do Sol */
      [648, 208], [740, 206], [850, 224], [970, 254],
      [1090, 288], [1206, 326], [1310, 366],                  /* Reta Oposta */
      [1396, 414], [1444, 476], [1436, 542],                  /* Descida do Lago */
      [1386, 580], [1310, 594], [1230, 596],
      [1160, 606], [1096, 646], [1064, 712], [1082, 784],     /* Ferradura */
      [1136, 830], [1204, 856], [1258, 892],                  /* Laranjinha */
      [1272, 950], [1242, 1006], [1178, 1032],                /* Pinheirinho */
      [1108, 1030], [1046, 1004], [1008, 952],                /* Bico de Pato */
      [986, 898], [942, 886], [886, 912],                     /* Mergulho */
      [836, 962], [782, 1016], [720, 1064],
      [646, 1096], [566, 1104], [494, 1086],                  /* Junção */
      [430, 1050], [378, 1004], [336, 954]
    ]
  },
  {
    id: 'spa', scale: 1.98, gp: 'GP da Bélgica', refLap: 26883,
    name: 'Spa-Francorchamps',
    sub: 'Ardenas · 19 curvas · a mais longa',
    country: '🇧🇪',
    width: 106, runoff: 92, minRadius: 68,
    grass: '#38703a', asphalt: '#54585e',
    laps: 3, difficulty: 2,
    /* La Source → Eau Rouge/Raidillon → reta Kemmel → Les Combes → Malmedy →
       Rivage → Pouhon → Fagnes → Paul Frère → Stavelot → Blanchimont →
       Bus Stop. */
    points: [
      [520, 1180], [440, 1186],
      [386, 1176], [340, 1148], [318, 1102], [326, 1056], [360, 1024],  /* La Source */
      [406, 996], [440, 946], [478, 888],                     /* Eau Rouge / Raidillon */
      [524, 824], [578, 754], [636, 680], [694, 608], [750, 540],  /* Kemmel */
      [804, 478], [864, 438], [924, 446], [962, 486],         /* Les Combes */
      [964, 540], [936, 584],                                 /* Malmedy */
      [900, 624], [912, 672], [958, 698],                     /* Rivage */
      [1018, 704], [1086, 696], [1152, 678],
      [1214, 664], [1276, 672], [1322, 708], [1346, 762],     /* Pouhon */
      [1382, 812], [1440, 832], [1494, 818],                  /* Fagnes */
      [1540, 842], [1580, 888], [1646, 928], [1714, 968],     /* Paul Frère */
      [1778, 1012], [1826, 1072], [1836, 1142],               /* Stavelot */
      [1806, 1204], [1746, 1250], [1660, 1290], [1556, 1322], /* Blanchimont */
      [1440, 1346], [1318, 1360], [1196, 1362], [1082, 1350],
      [986, 1322], [908, 1284],
      [856, 1240], [812, 1216], [772, 1230],                  /* Bus Stop */
      [720, 1224], [640, 1204]
    ]
  },
  {
    id: 'silverstone', scale: 1.32, gp: 'GP da Inglaterra', refLap: 17458,
    name: 'Silverstone',
    sub: 'Retas longas e esses rápidos',
    country: '🇬🇧',
    width: 104, runoff: 90, minRadius: 72,
    grass: '#3d7a3c', asphalt: '#585d64',
    laps: 3, difficulty: 2,
    /* reta dos boxes → Copse → Maggotts/Becketts → reta Hangar → Stowe →
       Vale/Club → Abbey → setor lento da arena → Wellington. */
    points: [
      [320, 1120], [318, 1000], [332, 884], [372, 776],
      [438, 678], [528, 612], [628, 572],                    /* Copse */
      [710, 524], [772, 464], [834, 430],                    /* Maggotts */
      [906, 428], [976, 464],                                /* Becketts */
      [1066, 484], [1176, 488], [1296, 488],                 /* reta Hangar */
      [1414, 500], [1522, 534], [1612, 592],
      [1670, 674], [1680, 770],                              /* Stowe */
      [1642, 858], [1564, 912], [1472, 928],                 /* Vale */
      [1392, 962], [1332, 1024], [1304, 1104],               /* Club */
      [1232, 1160], [1130, 1192], [1018, 1204],              /* Abbey */
      [908, 1204], [822, 1236],
      [756, 1306], [676, 1338], [592, 1330],                 /* Village */
      [520, 1292], [494, 1220], [510, 1152],                 /* The Loop */
      [452, 1116], [372, 1116]                               /* Wellington */
    ]
  },
  {
    id: 'zandvoort', scale: 1.16, gp: 'GP da Holanda', refLap: 15125,
    name: 'Zandvoort',
    sub: 'Dunas, estreito e sem descanso',
    country: '🇳🇱',
    width: 80, runoff: 50, minRadius: 54,
    grass: '#8a7f5e', asphalt: '#5c6068',
    laps: 4, difficulty: 3,
    /* Tarzan → Gerlach → Hugenholtz → Scheivlak → Masters → Hans Ernst →
       Kumho → Arie Luyendyk, de volta para a reta. */
    points: [
      [330, 1020], [326, 900], [332, 786], [356, 692],
      [416, 620], [500, 590], [586, 608],                    /* Tarzan */
      [640, 668], [634, 744],                                /* Gerlachbocht */
      [576, 796], [512, 828],                                /* Hugenholtz */
      [468, 890], [498, 956], [570, 984],
      [660, 992], [748, 972], [830, 936],                    /* Hunserug */
      [908, 892], [978, 878], [1036, 912],                   /* Scheivlak */
      [1090, 962], [1132, 1032],                             /* Masters */
      [1186, 1102], [1258, 1152], [1330, 1176],              /* Hans Ernst */
      [1390, 1218], [1396, 1284], [1338, 1330],              /* Kumho */
      [1248, 1338], [1160, 1318], [1064, 1290],
      [962, 1278], [858, 1284], [752, 1296],
      [648, 1288], [546, 1258], [448, 1206], [378, 1134]     /* Arie Luyendyk */
    ]
  },
  {
    id: 'arena', scale: 1.26, gp: 'Corrida dos Campeões', refLap: 11933,
    name: 'Arena de Drift',
    sub: 'Treino livre · pista larguíssima',
    country: '🏁',
    width: 340, runoff: 60, minRadius: 220,
    grass: '#39404e', asphalt: '#6b7078',
    laps: 5, difficulty: 1, arena: true,
    points: [
      [500, 400], [900, 340], [1300, 380], [1560, 560], [1600, 820],
      [1420, 1020], [1080, 1100], [700, 1080], [420, 940], [340, 660]
    ]
  }
];

const TRACK_SPACING = 5;   /* distância entre pontos da linha central */
const GRID_GAP = 46;       /* distância entre posições de largada */
const GRID_BACK = 58;      /* recuo da pole em relação à linha */

/* Constrói toda a geometria derivada de uma pista */
function buildTrack(def) {
  /* o desenho é feito numa escala cômoda e esticado aqui: mexer em `scale`
     muda o comprimento da volta sem redesenhar o traçado */
  const k = def.scale || 1;
  const raw = k === 1 ? def.points : def.points.map(p => [p[0] * k, p[1] * k]);
  const smooth = catmullRomClosed(raw, 24);
  let cl = resampleClosed(smooth, TRACK_SPACING);
  /* tira os bicos do desenho à mão e reamostra de novo */
  const minR = def.minRadius || Math.max(46, def.width * 0.55);
  cl = relaxCurvature(cl, TRACK_SPACING, minR, 26);
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
  const pad = def.width / 2 + def.runoff + 76;   /* cabe a arquibancada */

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
