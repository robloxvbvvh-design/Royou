"""Генерация ответа собственной моделью, токен за токеном."""
import numpy as np
from model import LM, CTX, PROMPT

def build_prompt(tok, text):
    ids = tok.encode(text.strip())[-PROMPT:]
    return ids + [-1] * (PROMPT - len(ids))

def generate(model, tok, user_text, max_tokens=200, temp=.8, top_k=24, rng=None):
    rng = rng or np.random.default_rng()
    prm = build_prompt(tok, user_text)
    n_in = sum(1 for i in prm if i >= 0)
    seq = [tok.USER] + [i for i in prm if i >= 0] + [tok.JOVA]
    out = []
    for _ in range(max_tokens):
        win = ([tok.PAD] * CTX + seq)[-CTX:]
        pr = model.probs(win, prm, temp, top_k)
        for t in set(out[-30:]): pr[t] *= .7          # лёгкий штраф за повторы
        pr /= pr.sum()
        t = int(rng.choice(len(pr), p=pr))
        if t == tok.END: break
        out.append(t); seq.append(t)
        yield t, n_in
