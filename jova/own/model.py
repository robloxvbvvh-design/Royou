"""Собственная нейросеть Jova: языковая модель на numpy с ручным обратным проходом.
Вход: последние CTX токенов (окно) + усреднённое представление всего вопроса (чтобы ответ держался темы).
Выход: распределение следующего токена. Ответ печатается токен за токеном."""
import numpy as np

CTX, PROMPT = 24, 48

class LM:
    def __init__(self, V, d=64, H=512, seed=0):
        r = np.random.default_rng(seed); self.V, self.d, self.H = V, d, H
        self.p = {
            'E':  r.normal(0, .1, (V, d)),            # эмбеддинги окна
            'Q':  r.normal(0, .1, (V, d)),            # эмбеддинги вопроса
            'W1': r.normal(0, (2 / ((CTX + 1) * d)) ** .5, ((CTX + 1) * d, H)), 'b1': np.zeros(H),
            'W2': r.normal(0, (1 / H) ** .5, (H, V)), 'b2': np.zeros(V),
        }
        self.m = {k: np.zeros_like(v) for k, v in self.p.items()}
        self.v = {k: np.zeros_like(v) for k, v in self.p.items()}
        self.t = 0

    def forward(self, win, prm):
        p = self.p; B = len(win)
        msk = (prm >= 0)[..., None]
        qm = (p['Q'][np.maximum(prm, 0)] * msk).sum(1) / np.maximum(msk.sum(1), 1)
        x = np.concatenate([p['E'][win].reshape(B, -1), qm], 1)
        h = np.tanh(x @ p['W1'] + p['b1'])
        return x, h, h @ p['W2'] + p['b2'], msk

    def step(self, win, prm, tgt, lr=2e-3, drop=.1):
        p = self.p; B = len(win)
        x, h, lg, msk = self.forward(win, prm)
        if drop:
            keep = (np.random.rand(*h.shape) > drop) / (1 - drop)
            lg = (h * keep) @ p['W2'] + p['b2']
        z = lg - lg.max(1, keepdims=True); pr = np.exp(z); pr /= pr.sum(1, keepdims=True)
        loss = -np.log(pr[np.arange(B), tgt] + 1e-9).mean()
        g = pr; g[np.arange(B), tgt] -= 1; g /= B
        hh = h * keep if drop else h
        gr = {'W2': hh.T @ g, 'b2': g.sum(0)}
        gh = (g @ p['W2'].T) * (keep if drop else 1) * (1 - h ** 2)
        gr['W1'] = x.T @ gh; gr['b1'] = gh.sum(0)
        gx = gh @ p['W1'].T
        gE = np.zeros_like(p['E']); np.add.at(gE, win.reshape(-1), gx[:, :CTX * self.d].reshape(-1, self.d))
        gQ = np.zeros_like(p['Q'])
        gq = gx[:, CTX * self.d:] / np.maximum(msk.sum(1), 1)
        np.add.at(gQ, np.maximum(prm, 0).reshape(-1), (gq[:, None, :] * msk).reshape(-1, self.d))
        gr['E'], gr['Q'] = gE, gQ
        self.t += 1
        for k in p:                                    # Adam
            self.m[k] = .9 * self.m[k] + .1 * gr[k]; self.v[k] = .999 * self.v[k] + .001 * gr[k] ** 2
            p[k] -= lr * (self.m[k] / (1 - .9 ** self.t)) / (np.sqrt(self.v[k] / (1 - .999 ** self.t)) + 1e-8)
        return float(loss)

    def probs(self, win, prm, temp=.8, top_k=24):
        lg = self.forward(np.array([win]), np.array([prm]))[2][0] / max(temp, 1e-3)
        if top_k and top_k < len(lg):
            cut = np.partition(lg, -top_k)[-top_k]; lg = np.where(lg < cut, -1e9, lg)
        e = np.exp(lg - lg.max()); return e / e.sum()

    def save(self, path): np.savez(path, **self.p, _d=self.d, _H=self.H)
    @staticmethod
    def load(path):
        z = np.load(path); m = LM(z['E'].shape[0], int(z['_d']), int(z['_H']))
        m.p = {k: z[k] for k in m.p}; return m
