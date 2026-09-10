# Drift GP 🏁

Jogo de corrida **offline** para celular, com visão de cima, carros que derrapam
e circuitos inspirados nos da Fórmula 1. Roda direto no navegador do celular e,
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
| Acelerar | **GÁS** | ↑ |
| Frear / dar ré | **FREIO** | ↓ |
| Derrapar (freio de mão) | **DRIFT** | espaço |
| Pausar | botão ‖ | P ou Esc |

**O segredo do drift:** chegue rápido, segure **DRIFT** na entrada da curva e
mantenha o **GÁS** durante a derrapagem. Quanto mais tempo atravessado, maior o
multiplicador de pontos. Sair da pista zera o combo.

Em **Ajustes** dá para ligar o *acelerador automático* (aí você só dirige e
derrapa) e a *ajuda de contra-esterço*, que endireita o carro sozinho.

---

## O que tem no jogo

**5 circuitos** — Monza, Mônaco, Interlagos, Spa e uma Arena de Drift para treino livre.

**4 carros** com características diferentes: `Sprinter` (equilibrado),
`Kaido AE` (rei do drift), `Bruto V8` (potência) e `Kappa GT` (aderência).

**3 modos** — Corrida (até 7 adversários com IA), Contra-relógio e Ataque de Drift
(90 segundos para fazer o máximo de pontos).

Recordes de volta e de drift ficam salvos no aparelho, por pista.

---

## Como o código está organizado

```
index.html              telas, HUD e botões de toque
style.css               interface (respeita o notch do iPhone)
js/utils.js             matemática, splines e suavização de traçado
js/tracks.js            os 5 circuitos + geometria derivada
js/car.js               física de drift
js/ai.js                pilotos do computador
js/render.js            desenho do circuito, carros e efeitos
js/game.js              laço principal, telas e regras
sw.js                   cache offline (service worker)
build.py                gera dist/index.html (arquivo único)
tools_make_icons.py     gera os ícones PNG do app
```

### Duas decisões que valem explicar

**Traçado.** Cada pista é uma lista curta de pontos desenhados à mão, suavizada
por spline Catmull-Rom. Pontos feitos à mão criam "bicos" — curvas de raio 15 que
nenhum carro consegue fazer. Por isso `relaxCurvature()` passa depois arredondando
só os trechos que estouram um raio mínimo, sem mexer no resto do desenho.

**Drift.** A velocidade é separada em componente frontal e lateral. A lateral é
consumida pela aderência a cada quadro; o freio de mão derruba essa aderência.
O truque está em recompor a velocidade **com o ângulo antigo** antes de girar o
carro: é essa defasagem de um quadro que faz a traseira sair.

### Mexendo no jogo

Depois de editar qualquer arquivo, suba a versão em **dois** lugares para o
celular não continuar com a cópia antiga em cache:

- `index.html` — os `?v=N` nas tags `<link>` e `<script>`
- `sw.js` — as constantes `CACHE` e `V`

Para testar sem cache nenhum, abra com `?nosw=1` na URL.
