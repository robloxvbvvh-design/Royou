"""Собирает один HTML-файл: интерфейс + собственная модель внутри (для публикации ссылкой)."""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]
src = open(os.path.join(HERE, '../public/index.html'), encoding='utf-8').read()
style = re.search(r'<style>.*?</style>', src, re.S).group(0)
style = style.replace('#comp{padding:8px 12px calc', '#comp{padding:8px 16px calc').replace('#chat{padding:16px 14px}', '#chat{padding:16px}')
body = src[src.index('<body>') + 6: src.index('<script>')]
body = re.sub(r'<button class="btn ghost" id="install"[^>]*>.*?</button>', '', body, flags=re.S)
app = src[src.index('<script>') + 8: src.rindex('</script>')]
a, b = app.index('// установка на главный экран'), app.index('load().then(')
app = app[:a] + app[b:]
pack = open(os.path.join(HERE, 'pack.json'), encoding='utf-8').read()
eng = open(os.path.join(HERE, 'engine.js'), encoding='utf-8').read()
shim = open(os.path.join(HERE, 'shim.js'), encoding='utf-8').read()
html = f'<title>Jova</title>\n{style}\n{body}\n<script>window.JOVA_PACK={pack};</script>\n<script>{eng}</script>\n<script>{shim}</script>\n<script>{app}</script>\n'
open(out, 'w', encoding='utf-8').write(html)
print(out, len(html) // 1024, 'КБ')
