"""Сервер собственной модели: POST /generate {"text": "...", "max_tokens": 200} → поток SSE с токенами."""
import json, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import codecs, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from tokenizer import Tokenizer
from model import LM
from chat import generate

HERE = os.path.dirname(__file__)
tok = Tokenizer.load(os.path.join(HERE, 'models/tokenizer.json'))
net = LM.load(os.path.join(HERE, 'models/jova-own.npz'))

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        if self.path != '/generate': return self.send_error(404)
        body = json.loads(self.rfile.read(int(self.headers.get('content-length', 0))) or b'{}')
        self.send_response(200); self.send_header('content-type', 'text/event-stream'); self.end_headers()
        dec = codecs.getincrementaldecoder('utf-8')('ignore'); n_in = n_out = 0
        for t, n_in in generate(net, tok, str(body.get('text', '')), int(body.get('max_tokens', 200)), float(body.get('temperature', .8))):
            n_out += 1
            s = dec.decode(tok.piece(t))
            if s: self.wfile.write(('data: ' + json.dumps({'delta': s}, ensure_ascii=False) + '\n\n').encode()); self.wfile.flush()
        self.wfile.write(('data: ' + json.dumps({'usage': {'input': n_in, 'output': n_out}}) + '\n\n').encode())

if __name__ == '__main__':
    port = int(os.environ.get('OWN_PORT', 8765))
    print(f'Собственная модель Jova на http://localhost:{port}  (словарь {tok.size} токенов)')
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
