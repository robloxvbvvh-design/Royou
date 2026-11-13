"""Сервер собственной модели: POST /generate {"text": "...", "max_tokens": 200} → поток SSE с токенами."""
import json, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import codecs, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from tokenizer import Tokenizer
from model import LM
from chat import generate, compose, _stems
import re, glob, time

HERE = os.path.dirname(__file__)
tok = Tokenizer.load(os.path.join(HERE, 'models/tokenizer.json'))
net = LM.load(os.path.join(HERE, 'models/jova-own.npz'))

# вопросы, на которые модель обучена (приветствия, она сама, продукт). Всё остальное она ищет в интернете.
KNOWN = []
for f in glob.glob(os.path.join(HERE, 'data/*.txt')):
    for m in re.finditer(r'^Q:\s*(.+)$', open(f, encoding='utf-8').read(), re.M): KNOWN.append(_stems(m.group(1)) | {'#' + m.group(1).lower().strip()})
def is_known(text):
    t = text.lower().strip().strip('?!. ')
    st = _stems(text)
    return any(('#' + t) in k or (len(k) > 1 and len(st) and len(st & k) / max(len(st | k), 1) >= .75) for k in KNOWN)

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('content-length', 0))) or b'{}')
        text = str(body.get('text', ''))
        if self.path == '/known':
            data = json.dumps({'known': is_known(text)}).encode()
            self.send_response(200); self.send_header('content-type', 'application/json'); self.end_headers(); return self.wfile.write(data)
        if self.path != '/generate': return self.send_error(404)
        self.send_response(200); self.send_header('content-type', 'text/event-stream'); self.end_headers()
        send = lambda o: (self.wfile.write(('data: ' + json.dumps(o, ensure_ascii=False) + '\n\n').encode()), self.wfile.flush())
        n_in, ids = 0, []
        gen = generate(net, tok, text, int(body.get('max_tokens', 200)), float(body.get('temperature', .8))) if is_known(text) \
            else compose(net, tok, text, body.get('sources') or [], int(body.get('max_tokens', 200)))
        # Фаза 1: «мысли цифрами» — настоящие номера токенов, которые модель выбрала.
        for t, n_in in gen:
            ids.append(t); send({'think': [t]}); time.sleep(.012)
        # Фаза 2: те же токены превращаются в текст.
        dec = codecs.getincrementaldecoder('utf-8')('ignore'); txt = ''
        for t in ids: txt += dec.decode(tok.piece(t))
        if not ids:
            txt = 'Не нашла в интернете подходящего ответа. Попробуйте переформулировать вопрос.'
        for i in range(0, len(txt), 3): send({'delta': txt[i:i + 3]}); time.sleep(.02)
        send({'usage': {'input': n_in, 'output': len(ids)}})

if __name__ == '__main__':
    port = int(os.environ.get('OWN_PORT', 8765))
    print(f'Собственная модель Jova на http://localhost:{port}  (словарь {tok.size} токенов)')
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
