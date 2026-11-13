// Собственная модель Jova в браузере: токенизатор + нейросеть, те же веса, что в own/ (Python).
// Без сервера и без сети. Знает только то, чему обучена: приветствия, ответы о себе и о тарифах.
(function (root) {
  const CTX = 24, PROMPT = 48, PRE = /\s*[\p{L}\p{N}_]+|\s*[^\p{L}\p{N}_\s]+|\s+/gu;
  const PRE2 = / ?[\p{L}\p{N}_]+| ?[^\p{L}\p{N}_\s]+|\s+/gu;           // как в tokenizer.py
  function half(u) { const s = (u >> 15) & 1, e = (u >> 10) & 31, f = u & 1023;
    if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
    if (e === 31) return f ? NaN : (s ? -Infinity : Infinity);
    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024); }
  function decodeF16(b64) { const bin = atob(b64), n = bin.length >> 1, out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = half(bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)); return out; }

  function Engine(pack) {
    const merges = pack.merges, rank = new Map();
    const vocab = [];
    for (let i = 0; i < 256; i++) vocab.push(new Uint8Array([i]));
    merges.forEach(([a, b], i) => { const x = new Uint8Array(vocab[a].length + vocab[b].length); x.set(vocab[a]); x.set(vocab[b], vocab[a].length); vocab.push(x); rank.set(a + ',' + b, 256 + i); });
    const base = 256 + merges.length, PAD = base, USER = base + 1, JOVA = base + 2, END = base + 3, V = base + 4;
    const enc = new TextEncoder(), cache = new Map();
    const P = {}; for (const k of ['E', 'Q', 'W1', 'b1', 'W2', 'b2']) P[k] = decodeF16(pack.w[k]);
    const d = pack.d, H = pack.H;
    function word(w) {
      if (cache.has(w)) return cache.get(w);
      let s = Array.from(enc.encode(w));
      while (s.length > 1) { let best = null, bi = -1;
        for (let i = 0; i < s.length - 1; i++) { const r = rank.get(s[i] + ',' + s[i + 1]); if (r !== undefined && (best === null || r < best)) { best = r; bi = i; } }
        if (best === null) break; s.splice(bi, 2, best); }
      cache.set(w, s); return s; }
    const encode = t => { const o = []; for (const w of (t.match(PRE2) || [])) o.push(...word(w)); return o; };
    function probs(win, prm, temp, topK) {
      const x = new Float32Array((CTX + 1) * d);
      for (let i = 0; i < CTX; i++) x.set(P.E.subarray(win[i] * d, win[i] * d + d), i * d);
      let n = 0; for (const t of prm) if (t >= 0) { n++; for (let j = 0; j < d; j++) x[CTX * d + j] += P.Q[t * d + j]; }
      for (let j = 0; j < d; j++) x[CTX * d + j] /= Math.max(n, 1);
      const h = new Float32Array(H);
      for (let j = 0; j < H; j++) h[j] = P.b1[j];
      for (let i = 0; i < x.length; i++) { const xi = x[i]; if (xi === 0) continue; const o = i * H; for (let j = 0; j < H; j++) h[j] += xi * P.W1[o + j]; }
      for (let j = 0; j < H; j++) h[j] = Math.tanh(h[j]);
      const lg = new Float32Array(V);
      for (let j = 0; j < V; j++) lg[j] = P.b2[j];
      for (let i = 0; i < H; i++) { const hi = h[i], o = i * V; for (let j = 0; j < V; j++) lg[j] += hi * P.W2[o + j]; }
      return { lg, soft(t, k) { const a = Array.from(lg, v => v / Math.max(t, 1e-3));
        if (k && k < a.length) { const cut = a.slice().sort((p, q) => q - p)[k - 1]; for (let i = 0; i < a.length; i++) if (a[i] < cut) a[i] = -1e9; }
        const m = Math.max(...a), e = a.map(v => Math.exp(v - m)), s = e.reduce((p, q) => p + q, 0); return e.map(v => v / s); } };
    }
    function* generate(text, maxTokens = 200, temp = .8, topK = 24, rnd = Math.random) {
      const q = encode(text.trim()).slice(-PROMPT), prm = q.concat(Array(PROMPT - q.length).fill(-1));
      const seq = [USER, ...q, JOVA], out = [];
      for (let step = 0; step < maxTokens; step++) {
        const win = Array(CTX).fill(PAD).concat(seq).slice(-CTX);
        const p = probs(win, prm, temp, topK).soft(temp, topK);
        for (const t of new Set(out.slice(-30))) p[t] *= .7;
        const s = p.reduce((a, b) => a + b, 0); let r = rnd() * s, t = 0; for (; t < p.length - 1; t++) { r -= p[t]; if (r <= 0) break; }
        if (t === END) return; out.push(t); seq.push(t); yield t; } }
    const stems = t => new Set((t.toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) || []).map(w => w.slice(0, 5)));
    const known = pack.known.map(k => ({ raw: k.toLowerCase().trim(), st: stems(k) }));
    function isKnown(text) {
      const t = text.toLowerCase().trim().replace(/^[?!. ]+|[?!. ]+$/g, ''), st = stems(text);
      return known.some(k => { if (k.raw === t) return true; if (k.st.size < 1 || !st.size) return false;
        let inter = 0; st.forEach(w => k.st.has(w) && inter++); return inter / (st.size + k.st.size - inter) >= .75; }); }
    const piece = id => vocab[id] || new Uint8Array(0);
    return { encode, generate, isKnown, piece, END, V, vocabSize: V };
  }
  root.JovaEngine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
