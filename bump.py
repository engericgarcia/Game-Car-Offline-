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

print('versão v%d -> v%d' % (atual, nova))
