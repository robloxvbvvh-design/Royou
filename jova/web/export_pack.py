"""Выгрузка собственной модели в JSON для браузера (веса в float16)."""
import base64, glob, json, os, re, sys
import numpy as np
HERE = os.path.dirname(__file__); OWN = os.path.join(HERE, '..', 'own')
sys.path.insert(0, OWN)
from tokenizer import Tokenizer
tok = Tokenizer.load(os.path.join(OWN, 'models/tokenizer.json')); z = np.load(os.path.join(OWN, 'models/jova-own.npz'))
known = [m.group(1).strip() for f in glob.glob(os.path.join(OWN, 'data/*.txt')) for m in re.finditer(r'^Q:\s*(.+)$', open(f, encoding='utf-8').read(), re.M)]
pack = {'merges': tok.merges, 'd': int(z['_d']), 'H': int(z['_H']), 'known': known,
        'w': {k: base64.b64encode(z[k].astype('<f2').tobytes()).decode() for k in ['E', 'Q', 'W1', 'b1', 'W2', 'b2']}}
out = os.path.join(HERE, 'pack.json'); json.dump(pack, open(out, 'w'))
print('pack.json', os.path.getsize(out) // 1024, 'КБ')
