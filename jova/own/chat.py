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


# ---------- ответ по найденным источникам ----------
import re as _re
_WORD = _re.compile(r'\w{3,}', _re.UNICODE)
def _stems(text): return {w.lower()[:5] for w in _WORD.findall(text)}

def split_sentences(text):
    return [s.strip() for s in _re.split(r'(?<=[.!?])\s+', text) if 25 <= len(s.strip()) <= 400]

def compose(model, tok, query, sources, max_tokens=130, sentences=3, rng=None):
    """Модель не знает фактов: ответ собирается из текста найденных источников.
    Выбираются самые подходящие к вопросу предложения, дальше они выводятся токенами
    своего токенизатора. Это извлечение текста, а не пересказ."""
    q = _stems(query)
    cands = []
    for si, s in enumerate(sources):
        for sent in split_sentences(s.get('title', '') + '. ' + s.get('snippet', '')):
            sc = len(q & _stems(sent))
            if sc: cands.append((sc, si, sent))
    cands.sort(key=lambda x: (-x[0], x[1]))
    chosen = []
    for sc, si, sent in cands:
        if sent not in chosen: chosen.append(sent)
        if len(chosen) == sentences: break
    n_in = len(tok.encode(query)[:PROMPT])
    out = 0
    for k, sent in enumerate(chosen):
        for tid in tok.encode(sent + (' ' if k < len(chosen) - 1 else '')):
            if out >= max_tokens: return
            out += 1
            yield tid, n_in
