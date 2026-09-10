#!/usr/bin/env python3
"""Gera dist/index.html: o jogo inteiro num arquivo só.

Use quando quiser mandar o jogo por WhatsApp/AirDrop ou abrir direto
do gerenciador de arquivos do celular, sem precisar de servidor.
    python3 build.py
"""
import base64, os, re, pathlib

ROOT = pathlib.Path(__file__).parent
SCRIPTS = ['utils', 'tracks', 'car', 'ai', 'audio', 'render', 'game']

def read(p):
    return (ROOT / p).read_text(encoding='utf-8')

def data_uri(p):
    return 'data:image/png;base64,' + base64.b64encode((ROOT / p).read_bytes()).decode()

html = read('index.html')

# 1. remove manifesto e service worker (não fazem sentido em arquivo solto)
html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)

# 2. ícones viram data URI
icon = data_uri('icons/icon-192.png')
html = re.sub(r'href="icons/[^"]*"', 'href="%s"' % icon, html)

# 3. CSS embutido
html = re.sub(r'<link rel="stylesheet" href="style\.css[^"]*">',
              '<style>\n%s\n</style>' % read('style.css'), html)

# 4. JS embutido, na mesma ordem
js = '\n'.join('/* ===== %s.js ===== */\n%s' % (n, read('js/%s.js' % n)) for n in SCRIPTS)
html = re.sub(r'(<script src="js/utils\.js[^"]*"></script>\s*)'
              r'(<script src="js/[^"]*"></script>\s*)*',
              '<script>window.__STANDALONE__=true;</script>\n<script>\n%s\n</script>\n'
              % js.replace('</script>', '<\\/script>'), html)

out = ROOT / 'dist' / 'index.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print('gerado %s (%.0f KB)' % (out, out.stat().st_size / 1024))
