"""Обучение: python train.py [--steps N] [--files data/*.txt]. Результат — models/jova-own.npz и токенизатор."""
import argparse, glob, os, re, time, numpy as np
from tokenizer import Tokenizer
from model import LM, CTX, PROMPT
from chat import build_prompt

ap = argparse.ArgumentParser()
ap.add_argument('--files', nargs='*', default=sorted(glob.glob('data/*.txt')))
ap.add_argument('--steps', type=int, default=1500)
ap.add_argument('--vocab', type=int, default=1200)
ap.add_argument('--batch', type=int, default=256)
a = ap.parse_args()

raw = '\n\n'.join(open(f, encoding='utf-8').read() for f in a.files)
pairs = []
for blk in re.split(r'\n\s*\n(?=Q:)', raw.strip()):
    m = re.match(r'Q:\s*(.+?)\nA:\s*(.+)', blk.strip(), re.S)
    if m: pairs.append((m.group(1).strip(), m.group(2).strip()))
print(f'диалогов: {len(pairs)}')

tok = Tokenizer(); tok.train('\n'.join(q + ' ' + ans for q, ans in pairs), a.vocab)
os.makedirs('models', exist_ok=True); tok.save('models/tokenizer.json')
print(f'словарь токенов: {tok.size}')

W, P, T = [], [], []
for q, ans in pairs:
    prm = build_prompt(tok, q)
    seq = [tok.USER] + [i for i in prm if i >= 0] + [tok.JOVA]
    start = len(seq)
    seq += tok.encode(ans) + [tok.END]
    for t in range(start, len(seq)):
        W.append(([tok.PAD] * CTX + seq[:t])[-CTX:]); P.append(prm); T.append(seq[t])
W, P, T = np.array(W), np.array(P), np.array(T)
print(f'обучающих примеров (токенов): {len(T)}')

model = LM(tok.size); rng = np.random.default_rng(1); t0 = time.time()
for s in range(1, a.steps + 1):
    ix = rng.integers(0, len(T), a.batch)
    lr = 3e-3 * (0.5 * (1 + np.cos(np.pi * s / a.steps))) + 2e-4
    loss = model.step(W[ix], P[ix], T[ix], lr=lr)
    if s % 100 == 0 or s == 1: print(f'шаг {s}/{a.steps}  loss {loss:.3f}  {time.time()-t0:.0f}с')
model.save('models/jova-own.npz')
print('готово: models/jova-own.npz')
