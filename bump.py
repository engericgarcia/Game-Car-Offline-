#!/usr/bin/env python3
"""Sobe a versão dos arquivos em index.html e sw.js.

O navegador e o celular guardam css/js em cache pela URL. Sem trocar o
?v=N eles continuam com a cópia antiga mesmo depois de um push.
    python3 bump.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).parent
html = ROOT / 'index.html'
sw = ROOT / 'sw.js'

atual = int(re.search(r"const V = 'v=(\d+)';", sw.read_text(encoding='utf-8')).group(1))
nova = atual + 1

h = html.read_text(encoding='utf-8').replace('?v=%d' % atual, '?v=%d' % nova)
html.write_text(h, encoding='utf-8')

s = sw.read_text(encoding='utf-8')
s = s.replace("const V = 'v=%d';" % atual, "const V = 'v=%d';" % nova)
s = s.replace("const CACHE = 'driftgp-v%d';" % atual, "const CACHE = 'driftgp-v%d';" % nova)
sw.write_text(s, encoding='utf-8')

# o jogo compara APP_VERSION com o version.json do servidor para
# descobrir sozinho que o aparelho está com versão atrasada
game = ROOT / 'js' / 'game.js'
g = game.read_text(encoding='utf-8')
g = re.sub(r'const APP_VERSION = \d+;', 'const APP_VERSION = %d;' % nova, g, count=1)
game.write_text(g, encoding='utf-8')

(ROOT / 'version.json').write_text('{"version": %d}\n' % nova, encoding='utf-8')

# A lista de arquivos do service worker é gerada a partir do index.html.
# Feita à mão ela sai de sincronia: já aconteceu de dois módulos novos
# ficarem de fora e o jogo não abrir offline.
h2 = html.read_text(encoding='utf-8')
assets = ["'./'", "'./index.html'", "'./manifest.webmanifest'"]
for m in re.finditer(r'(?:src|href)="((?:js/|style)[^"]*?)\?v=\d+"', h2):
    assets.append("'./%s?' + V" % m.group(1))
for icon in ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']:
    assets.append("'./icons/%s'" % icon)

corpo = ',\n  '.join(assets)
s2 = sw.read_text(encoding='utf-8')
s2 = re.sub(r'const ASSETS = \[.*?\];',
            'const ASSETS = [\n  %s\n];' % corpo, s2, flags=re.S)
sw.write_text(s2, encoding='utf-8')
print('lista do service worker: %d arquivos' % len(assets))

print('versão v%d -> v%d (index.html, sw.js, game.js, version.json)' % (atual, nova))
