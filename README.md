# Drift GP 🏁

Jogo de corrida **offline** para celular: visão de cima, monopostos que derrapam,
circuitos com o traçado dos originais da Fórmula 1 e um campeonato completo. Roda direto no navegador do celular e,
depois de instalado na tela de início, funciona **sem internet**.

Feito com HTML5 + Canvas puro: sem bibliotecas, sem loja de aplicativos,
sem nenhum arquivo de imagem ou som (tudo é desenhado e sintetizado na hora).

---

## Como jogar no celular

### Opção 1 — instalar como app (recomendado)

1. Publique a pasta em qualquer hospedagem estática. Com **GitHub Pages**:
   - No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**
   - Em um ou dois minutos o jogo fica em
     `https://SEU-USUARIO.github.io/NOME-DO-REPO/`
2. Abra esse endereço no celular.
3. **Android (Chrome):** menu ⋮ → *Instalar aplicativo* / *Adicionar à tela inicial*
   **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*
4. Pronto. A partir daí ele abre em tela cheia e **funciona no modo avião** —
   o service worker guarda tudo no aparelho na primeira abertura.

### Opção 2 — arquivo único, sem hospedagem

`dist/index.html` é o jogo inteiro num arquivo só (~84 KB). Dá para mandar por
WhatsApp/AirDrop/e-mail e abrir direto do gerenciador de arquivos.
Nesse modo não dá para instalar na tela de início, mas joga offline igual.

Para gerar de novo depois de mexer no código:

```bash
python3 build.py
```

Isso escreve dois arquivos: `dist/index.html` (para abrir direto) e
`dist/artifact.html` (mesmo jogo, sem as tags de documento, para publicar
como Artifact do Claude).

### Rodar no computador

```bash
python3 -m http.server 8123
```

E abra `http://localhost:8123`.

---

## Controles

| Ação | Celular | Teclado |
|---|---|---|
| Dirigir | botões ◀ ▶ | ← → |
| Acelerar | pedal **GÁS** | ↑ |
| Frear / dar ré | pedal **FREIO** | ↓ |
| Derrapar (freio de mão) | alavanca **DRIFT** | espaço |
| Pausar | botão ‖ | P ou Esc |

O gás e o freio são pedais com curso: ao encostar, a placa gira no eixo de cima
e afunda no alojamento, acendendo. No Android o aparelho ainda dá um toque de
vibração — curto no gás, mais firme no freio.

**O segredo do drift:** chegue rápido, segure **DRIFT** na entrada da curva e
mantenha o **GÁS** durante a derrapagem. Quanto mais tempo atravessado, maior o
multiplicador de pontos. Sair da pista zera o combo.

Em **Ajustes** dá para ligar o *acelerador automático* (aí você só dirige e
derrapa) e a *ajuda de contra-esterço*, que endireita o carro sozinho.

### Dificuldade

Cinco níveis, com diferença real de ritmo. Referência: melhor volta de um
adversário em Monza.

| Nível | Volta | Quando usar |
|---|---|---|
| Muito fácil | ~29 s | aprendendo os traçados |
| **Fácil** (padrão) | ~27 s | dá para ganhar sem volta perfeita |
| Normal | ~25 s | exige volta limpa |
| Difícil | ~24 s | ritmo de referência |
| Extremo | ~24 s | o limite do carro |

A equipe escolhida também pesa: o carro da `Scuderia Rossa` é ~4% mais rápido
que o da `Verde Lima`.

---

## O que tem no jogo

**5 circuitos**, com o traçado e a sequência de curvas dos originais:

| Circuito | Curvas | Volta | Corrida | Caráter |
|---|---|---|---|---|
| 🇮🇹 Monza | 11 | ~25 s | 3 voltas | retões e chicanes; a mais rápida |
| 🇲🇨 Mônaco | 19 | ~20 s | 4 voltas | rua estreita, muros, grampo do Grand Hotel |
| 🇧🇷 Interlagos | 15 | ~21 s | 4 voltas | S do Senna, Reta Oposta, miolo técnico |
| 🇧🇪 Spa | 19 | ~28 s | 3 voltas | La Source, Eau Rouge, Kemmel; a mais longa |
| 🏁 Arena de Drift | — | ~12 s | 5 voltas | pista larguíssima, só para derrapar |

Cada pista é larga o bastante para os seis carros correrem lado a lado.

**10 equipes**, cada uma com dois pilotos e um carro de desempenho próprio —
da `Scuderia Rossa` (a mais rápida) à `Verde Lima` (a mais lenta, e por isso o
modo difícil do jogo). As equipes são inspiradas nas da F1; os nomes são
próprios do projeto e ficam todos em [`js/teams.js`](js/teams.js).

**4 modos:**

- **Modo História** — escolha uma equipe e dispute um campeonato de 5 GPs.
  Pontuação 25-18-15-12-10-8-6-4-2-1, classificação de pilotos e de
  construtores, e a ordem de largada de cada etapa sai da classificação do
  campeonato. Quem lidera larga na pole.
- **Corrida rápida** — até 19 adversários, número de voltas ajustável.
- **Contra-relógio** — sozinho na pista, atrás do recorde.
- **Ataque de drift** — 90 segundos para somar o máximo de pontos.

A temporada, os recordes de volta e os de drift ficam salvos no aparelho.

---

## Como o código está organizado

```
index.html              telas, HUD e botões de toque
style.css               interface (respeita o notch do iPhone)
js/utils.js             matemática, splines e suavização de traçado
js/teams.js             as 10 equipes, pilotos e desempenho dos carros
js/tracks.js            os 5 circuitos + geometria derivada
js/car.js               física de drift
js/ai.js                pilotos do computador e montagem do grid
js/render.js            circuito, cenário, monopostos e efeitos
js/season.js            campeonato do modo história
js/game.js              laço principal, telas e regras
sw.js                   cache offline (service worker)
build.py                gera dist/index.html (arquivo único)
bump.py                 sobe a versão dos arquivos (cache do celular)
tools_make_icons.py     gera os ícones PNG do app
```

### Duas decisões que valem explicar

**Traçado.** Cada pista é uma lista de pontos desenhados à mão seguindo a
sequência real de curvas do circuito, suavizada por spline Catmull-Rom e esticada
pelo campo `scale` (é ele que define o comprimento da volta). Desenho à mão cria
"bicos" — curvas de raio menor que o próprio carro consegue fazer. `relaxCurvature()`
passa depois arredondando só os trechos que estouram um raio mínimo. Ele **redistribui
os pontos a cada passada**: sem isso eles se amontoam no ápice e a curva continua
fechada mesmo parecendo suave.

**Drift.** A velocidade é separada em componente frontal e lateral. A lateral é
consumida pela aderência a cada quadro; o freio de mão derruba essa aderência.
O truque está em recompor a velocidade **com o ângulo antigo** antes de girar o
carro: é essa defasagem de um quadro que faz a traseira sair.

### Mexendo no jogo

Depois de editar qualquer arquivo, suba a versão — senão o celular (e até o
navegador do computador) continua com a cópia antiga em cache:

```bash
python3 bump.py
```

Isso troca o `?v=N` no `index.html` e as constantes `CACHE` e `V` no `sw.js`,
que é o que faz o aparelho baixar os arquivos novos. Para testar sem cache
nenhum, abra com `?nosw=1` na URL.

**Memória.** O circuito inteiro é desenhado uma vez numa textura em cache.
Como as pistas são grandes, a nitidez dessa textura se ajusta a um orçamento
de pixels (`LAYER_PIXEL_BUDGET` em [`js/render.js`](js/render.js)) para ficar
em ~25 MB por pista. Subir esse número dá zebras mais nítidas e gasta mais
memória do aparelho.
