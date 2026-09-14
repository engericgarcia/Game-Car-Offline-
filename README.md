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

Dá para **arrastar o polegar de ◀ para ▶ sem levantar o dedo** — a direção troca
no meio do caminho.

Os pedais são **analógicos**: quanto mais embaixo na placa você encosta, mais
acelera (ou freia), e a placa afunda na proporção. Dá para desligar em Ajustes.

A largada usa as **cinco luzes** da F1: elas acendem uma a uma e a corrida
começa quando todas apagam.

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

**7 circuitos**, com o traçado e a sequência de curvas dos originais:

| Circuito | Volta | Caráter |
|---|---|---|
| 🇮🇹 Monza | ~24 s | retões e chicanes; a mais rápida |
| 🇧🇪 Spa | ~27 s | La Source, Eau Rouge, Kemmel; a mais longa |
| 🇬🇧 Silverstone | ~17 s | esses de Maggotts/Becketts e a arena lenta |
| 🇲🇨 Mônaco | ~20 s | rua estreita, muros, grampo do Grand Hotel |
| 🇳🇱 Zandvoort | ~15 s | dunas, estreita e sem descanso |
| 🇧🇷 Interlagos | ~20 s | S do Senna, Reta Oposta, miolo técnico |
| 🏁 Arena de Drift | ~12 s | pista larguíssima, só para derrapar |

Cada pista é larga o bastante para os seis carros correrem lado a lado.

**10 equipes**, cada uma com dois pilotos e um carro de desempenho próprio —
da `Scuderia Rossa` (a mais rápida) à `Verde Lima` (a mais lenta, e por isso o
modo difícil do jogo). As equipes são inspiradas nas da F1; os nomes são
próprios do projeto e ficam todos em [`js/teams.js`](js/teams.js).

**4 modos:**

- **Modo História** — escolha uma equipe e dispute um campeonato de 7 GPs.
  Cada fim de semana tem **classificação** (3 voltas, a melhor define o grid) e
  corrida, com pontuação 25-18-15-12-10-8-6-4-2-1 e classificação de pilotos e
  de construtores. Dá para pular a classificação e receber um tempo de meio de
  grid.
- **Corrida rápida** — até 19 adversários, voltas e clima ajustáveis.
- **Contra-relógio** — sozinho na pista, contra o **carro-fantasma** da sua
  melhor volta.
- **Ataque de drift** — 90 segundos para somar o máximo de pontos.

A temporada, os recordes de volta, os de drift e os fantasmas ficam salvos no
aparelho.

### O que acontece durante a corrida

**Vácuo.** Colado atrás de outro carro você pega ar limpo e ganha até 26 km/h de
ponta. É o que torna a reta uma oportunidade, e não só um trecho de espera.

**A IA erra.** De vez em quando um adversário trava roda na freada, abre demais
numa curva ou perde a traseira — cerca de um erro a cada 6 s em algum lugar de
um grid de 20. Sem isso o pelotão se ordenava por ritmo na primeira volta e
ficava assim até o fim.

**Desgaste de pneu.** A borracha gasta com o tempo, e muito mais atravessado.
Dirigindo limpo o pneu termina 3 voltas em 70%; derrapando o tempo todo cai para
39%, e a volta passa de 25 s para 32 s. Render pontos de drift custa borracha, e
borracha gasta custa volta.

**Limites de pista.** Passar da zebra por mais de um instante anula a volta — o
tempo fica vermelho no painel. Sem isso dava para cortar curva e bater recorde
sem merecer.

**Chuva.** Menos aderência, freio mais longo, ~2,8 s a mais por volta e spray no
lugar das marcas de pneu. No modo história cada etapa tem o seu clima, sempre o
mesmo para aquela rodada.

---

## Como o código está organizado

```
index.html              telas, HUD e botões de toque
style.css               interface (respeita o notch do iPhone)
js/utils.js             matemática, splines e suavização de traçado
js/teams.js             as 10 equipes, pilotos e desempenho dos carros
js/tracks.js            os 7 circuitos + geometria derivada
js/car.js               física de drift
js/ai.js                pilotos do computador e montagem do grid
js/render.js            circuito, cenário, monopostos e efeitos
js/season.js            campeonato, classificação e grid do modo história
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

Isso troca o `?v=N` no `index.html`, as constantes `CACHE` e `V` no `sw.js`,
o `APP_VERSION` em `js/game.js` e o `version.json` — e **regenera a lista de
arquivos do service worker a partir do `index.html`**. Essa lista feita à mão
sai de sincronia: já aconteceu de dois módulos novos ficarem de fora dela e o
jogo não abrir sem internet.

O jogo compara o `APP_VERSION` com o `version.json` do servidor ao abrir e
toda vez que volta do segundo plano. Se estiver atrasado, limpa o cache e
recarrega sozinho (nunca no meio de uma corrida); se mesmo assim não resolver,
mostra uma barra para tocar e forçar. Para testar sem cache
nenhum, abra com `?nosw=1` na URL.

**Memória.** O circuito inteiro é desenhado uma vez numa textura em cache.
Como as pistas são grandes, a nitidez dessa textura se ajusta a um orçamento
de pixels (`LAYER_PIXEL_BUDGET` em [`js/render.js`](js/render.js)) para ficar
em ~25 MB por pista. Subir esse número dá zebras mais nítidas e gasta mais
memória do aparelho.
