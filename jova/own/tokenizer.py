"""Собственный токенизатор Jova: байтовый BPE, написан с нуля, без библиотек."""
import json, re
from collections import Counter

SPECIALS = ['<pad>', '<|user|>', '<|jova|>', '<|end|>']
PRE = re.compile(r" ?\w+| ?[^\w\s]+|\s+", re.UNICODE)

class Tokenizer:
    def __init__(self, merges=None):
        self.merges = [tuple(m) for m in (merges or [])]
        self._build()

    def _build(self):
        self.vocab = {i: bytes([i]) for i in range(256)}          # 0..255 — сырые байты
        self.rank = {}
        for i, (a, b) in enumerate(self.merges):
            self.vocab[256 + i] = self.vocab[a] + self.vocab[b]
            self.rank[(a, b)] = 256 + i
        base = 256 + len(self.merges)
        self.special = {s: base + i for i, s in enumerate(SPECIALS)}
        self.size = base + len(SPECIALS)
        self.PAD, self.USER, self.JOVA, self.END = (self.special[s] for s in SPECIALS)
        self._cache = {}

    def train(self, text, vocab_size=1400):
        words = Counter(PRE.findall(text))
        seqs = {w: list(w.encode('utf-8')) for w in words}
        self.merges = []
        while 256 + len(self.merges) + len(SPECIALS) < vocab_size:
            pairs = Counter()
            for w, s in seqs.items():
                for a, b in zip(s, s[1:]):
                    pairs[(a, b)] += words[w]
            if not pairs: break
            (a, b), n = pairs.most_common(1)[0]
            if n < 2: break
            new = 256 + len(self.merges); self.merges.append((a, b))
            for w, s in seqs.items():
                i, out = 0, []
                while i < len(s):
                    if i < len(s) - 1 and s[i] == a and s[i + 1] == b: out.append(new); i += 2
                    else: out.append(s[i]); i += 1
                seqs[w] = out
        self._build()

    def _word(self, w):
        if w in self._cache: return self._cache[w]
        s = list(w.encode('utf-8'))
        while len(s) > 1:
            cand = [(self.rank[p], i) for i, p in enumerate(zip(s, s[1:])) if p in self.rank]
            if not cand: break
            r, i = min(cand); s[i:i + 2] = [r]
        self._cache[w] = s
        return s

    def encode(self, text):
        out = []
        for w in PRE.findall(text): out += self._word(w)
        return out

    def piece(self, i):
        return self.vocab.get(i, b'')

    def decode(self, ids):
        return b''.join(self.piece(i) for i in ids).decode('utf-8', errors='ignore')

    def save(self, path): json.dump({'merges': self.merges}, open(path, 'w'))
    @staticmethod
    def load(path): return Tokenizer(json.load(open(path))['merges'])
