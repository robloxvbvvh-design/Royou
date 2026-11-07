#!/usr/bin/env python3
"""«Красная таблетка» — песня про Матрицу, полностью локальный синтез.

Голоса: espeak-ng (русский, мужской + женский тембр), подогнанные под мелодию
через ffmpeg/rubberband. Музыка: numpy (бит, бас, пэд, арпеджио, «цифровой дождь»).
Никаких внешних сервисов.

Запуск:  python3 make_song.py   ->  red_pill.wav / red_pill.mp3
"""
import io
import os
import re
import subprocess
import zlib
import random
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache")
os.makedirs(CACHE, exist_ok=True)

# ---------------------------------------------------------------- текст песни
V1 = [
    "Просыпаюсь в тишине, а мир как будто не такой",
    "Строки кода на стене, зелёный дождь над головой",
    "Кто-то шепчет: не спеши, ответ внутри, ты не один",
    "Выбор сделан за секунду, Нео, посмотри",
]
CH = [
    "Красная таблетка, синий сон",
    "Выбирай, где правда, а где фон",
    "Матрица вокруг, но я иду",
    "Сквозь стекло и ложь я свет найду",
    "Красная таблетка, дверь в рассвет",
    "Ложки нет, и страха тоже нет",
]
V2 = [
    "Агент в чёрном за спиной, но время замедляет бег",
    "Пули тают надо мной, как капли в падающий снег",
    "Мир из нулей и единиц, я вижу всё насквозь",
    "Ни стен, ни рамок, ни границ, и верю я всерьёз",
]
BR = [
    "Что реально, что из снов",
    "Просто выбери любовь",
    "Каждый шаг ломает код",
    "Каждый вдох ведёт вперёд",
]
FIN = [
    "Я проснулся, я не сплю",
    "Я не вписан в чей-то план",
    "Матрица осталась позади",
    "А впереди только океан",
]

# (название, баров, строки, голоса)
#   голоса: "m" — мужской лид, "f" — женский (октавой выше)
SECTIONS = [
    ("intro", 4, [], ""),
    ("verse1", 8, V1, "m"),
    ("chorus", 12, CH, "mf"),
    ("verse2", 8, V2, "m"),
    ("chorus", 12, CH, "mf"),
    ("bridge", 8, BR, "f"),
    ("final", 8, FIN, "mf"),
    ("chorus", 12, CH, "mf"),
    ("outro", 2, [], ""),
]

# Am  F  C  G
CHORDS = [
    (55.00, [220.00, 261.63, 329.63]),   # Am
    (43.65, [174.61, 220.00, 261.63]),   # F
    (65.41, [261.63, 329.63, 392.00]),   # C
    (49.00, [196.00, 246.94, 293.66]),   # G
]
# допустимые ноты мелодии (полутоны от A3 = 220 Гц) по аккордам
MELODY_NOTES = [
    [0, 3, 7, 5],        # Am
    [-4, 0, 3, 5, 8],    # F
    [3, 7, 10, 5],       # C
    [-2, 2, 5, 7],       # G
]
A3 = 220.0

# ------------------------------------------------------------------- голоса
VOICES = {
    "m": dict(espeak=["-v", "ru", "-p", "35"], f0=None),
    "f": dict(espeak=["-v", "ru+f3", "-p", "70"], f0=None),
}


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def espeak_wav(text, extra, speed=130):
    key = f"{zlib.crc32((text + ''.join(extra) + str(speed)).encode()):08x}"
    path = os.path.join(CACHE, key + ".wav")
    if not os.path.exists(path):
        run(["espeak-ng", *extra, "-s", str(speed), "-a", "180", text, "-w", path])
    sr, data = wavfile.read(path)
    data = data.astype(np.float32) / 32768
    return sr, data


def trim(data, thr=0.02, pad=200):
    idx = np.where(np.abs(data) > thr)[0]
    if len(idx) == 0:
        return data
    return data[max(0, idx[0] - pad): idx[-1] + pad]


def measure_f0(extra):
    """Оценка основного тона голоса espeak по автокорреляции."""
    sr, d = espeak_wav("а а а а а", extra, speed=90)
    d = trim(d)
    seg = d[len(d) // 4: len(d) // 4 + 4096]
    seg = seg - seg.mean()
    ac = np.correlate(seg, seg, "full")[len(seg) - 1:]
    lo, hi = int(sr / 400), int(sr / 70)
    lag = lo + int(np.argmax(ac[lo:hi]))
    return sr / lag


for k, v in VOICES.items():
    v["f0"] = measure_f0(v["espeak"])
    print(f"голос {k}: f0 ≈ {v['f0']:.0f} Гц")


def sing_word(word, voice, freq, dur):
    """Слово → моно-массив 44.1кГц нужной высоты и длительности."""
    v = VOICES[voice]
    sr, d = espeak_wav(word, v["espeak"], speed=120)
    d = trim(d)
    nat = len(d) / sr
    tempo = max(nat / dur, 0.05)
    pitch = freq / v["f0"]
    tag = f"{zlib.crc32(f'{word}{voice}{freq:.1f}{dur:.3f}'.encode()):08x}"
    src = os.path.join(CACHE, f"s_{tag}.wav")
    out = os.path.join(CACHE, f"o_{tag}.wav")
    if not os.path.exists(out):
        wavfile.write(src, sr, (d * 32767).astype(np.int16))
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ar", str(SR), "-af",
             f"rubberband=tempo={tempo:.4f}:pitch={pitch:.4f}:formant=preserved:transients=smooth",
             out])
    sr2, o = wavfile.read(out)
    o = o.astype(np.float32) / 32768
    n = int(dur * SR)
    o = o[:n] if len(o) >= n else np.pad(o, (0, n - len(o)))
    # короткие фейды против щелчков
    f = min(300, n // 4)
    o[:f] *= np.linspace(0, 1, f)
    o[-f:] *= np.linspace(1, 0, f)
    return o


def syllables(word):
    return max(1, len(re.findall(r"[аеёиоуыэюя]", word.lower())))


def melody_for(line, voice, bar_in_line_start, words, durs):
    """Детерминированная мелодия: одна и та же строка → один и тот же мотив."""
    rnd = random.Random(zlib.crc32(line.encode()))
    notes = []
    t = 0.0
    prev = 0
    for i, (w, d) in enumerate(zip(words, durs)):
        chord = int(((bar_in_line_start + t // BAR)) % 4)
        pool = MELODY_NOTES[chord]
        # шаги небольшие, чтобы звучало «пропето»
        pool_sorted = sorted(pool, key=lambda n: abs(n - prev) + rnd.random() * 3)
        n = pool_sorted[0]
        if i == len(words) - 1:
            n = pool[0]   # финал строки — устойчивая нота
        notes.append(n)
        prev = n
        t += d
    return notes


def render_line(line, voice, bar_start_idx):
    """Возвращает массив длиной в 2 такта с пропетой строкой."""
    words = re.findall(r"[А-Яа-яЁё\-]+", line)
    syl = [syllables(w) for w in words]
    total_syl = sum(syl)
    window = BAR * 2 - 0.5
    per_syl = min(window / total_syl, 0.5)
    durs = [s * per_syl for s in syl]
    notes = melody_for(line, voice, bar_start_idx, words, durs)
    octave = 1.0 if voice == "m" else 2.0
    jobs = []
    for w, n, d in zip(words, notes, durs):
        freq = A3 * 2 ** (n / 12) * octave / (2 if voice == "m" else 1)
        jobs.append((w, voice, freq, d * 0.94))
    with ThreadPoolExecutor(8) as ex:
        parts = list(ex.map(lambda a: sing_word(*a), jobs))
    out = np.zeros(int(BAR * 2 * SR))
    pos = int(0.12 * SR)
    for p, d in zip(parts, durs):
        out[pos: pos + len(p)] += p[: len(out) - pos]
        pos += int(d * SR)
    return out


# --------------------------------------------------------------- инструменты
def lp(x, fc, order=4):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)


def hp(x, fc, order=4):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def env_ad(n, a=0.005, decay=0.2):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / decay)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 25)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9)


def snare():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    noise = hp(np.random.randn(n), 1500) * np.exp(-t * 18)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return 0.6 * noise + 0.4 * tone


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return hp(np.random.randn(n), 7000) * np.exp(-t * (25 if open_ else 90))


def saw(freq, n, detune=0.0):
    t = np.arange(n) / SR
    return 2 * ((t * freq * (1 + detune)) % 1) - 1


def pluck(freq, dur=0.25):
    n = int(dur * SR)
    x = saw(freq, n) * 0.6 + saw(freq, n, 0.004) * 0.4
    x = lp(x, 3500, 2)
    return x * env_ad(n, 0.002, 0.09)


def bass_note(freq, dur):
    n = int(dur * SR)
    x = lp(saw(freq, n), 400, 2) + 0.6 * np.sin(2 * np.pi * freq * np.arange(n) / SR)
    return x * np.minimum(np.arange(n) / SR / 0.01, 1) * np.exp(-np.arange(n) / SR / (dur * 1.2))


def pad_chord(freqs, dur):
    n = int(dur * SR)
    x = sum(saw(f, n) + saw(f, n, 0.006) + saw(f, n, -0.006) for f in freqs) / (len(freqs) * 3)
    x = lp(x, 1800, 2)
    t = np.arange(n) / SR
    e = np.minimum(t / 0.6, 1) * np.minimum((dur - t) / 0.4, 1)
    return x * np.clip(e, 0, 1)


def put(buf, sig, t):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def digital_rain(buf, t0, t1, density=10, vol=0.05):
    rnd = random.Random(7)
    scale = [A3 * 2 ** (n / 12) for n in (12, 15, 19, 24, 27, 31)]
    t = t0
    while t < t1:
        f = rnd.choice(scale) * rnd.choice([1, 2])
        n = int(0.12 * SR)
        s = np.sin(2 * np.pi * f * np.arange(n) / SR) * env_ad(n, 0.002, 0.04)
        put(buf, s * vol, t)
        t += rnd.uniform(0.05, 1 / density * 2)


def reverb(x, secs=1.8, wet=0.35):
    n = int(secs * SR)
    rng = np.random.RandomState(3)
    ir = rng.randn(n) * np.exp(-np.arange(n) / SR / (secs / 4))
    ir = lp(ir, 5000, 2)
    ir /= np.sqrt(np.sum(ir ** 2))
    w = fftconvolve(x, ir)[: len(x)]
    return x * (1 - wet) + w * wet


def delay(x, time=BEAT * 0.75, fb=0.35, mix=0.25):
    d = int(time * SR)
    y = x.copy()
    for k in range(1, 5):
        sh = d * k
        if sh >= len(x):
            break
        y[sh:] += x[:-sh] * (fb ** k)
    return x * (1 - mix) + y * mix


# ------------------------------------------------------------------- сборка
def build():
    total_bars = sum(s[1] for s in SECTIONS)
    N = int((total_bars * BAR + 4) * SR)
    music = np.zeros(N)
    vocal_m = np.zeros(N)
    vocal_f = np.zeros(N)
    fx = np.zeros(N)

    K, S, H, HO = kick(), snare(), hat(), hat(True)
    np.random.seed(1)

    bar = 0
    for name, nbars, lines, voices in SECTIONS:
        level = {"intro": 0, "verse1": 1, "verse2": 1, "chorus": 2, "bridge": 0,
                 "final": 1, "outro": 0}[name]
        for b in range(nbars):
            gb = bar + b
            t0 = gb * BAR
            root, chord = CHORDS[gb % 4]
            # пэд
            pv = {0: 0.20, 1: 0.14, 2: 0.18}[level]
            put(music, pad_chord(chord, BAR) * pv, t0)
            # арпеджио (16-е)
            if name != "outro" or b == 0:
                av = {0: 0.16, 1: 0.10, 2: 0.14}[level]
                pattern = [0, 1, 2, 1, 2, 1, 0, 1] * 2
                for s in range(16):
                    f = chord[pattern[s]] * (2 if (s // 4) % 2 else 1)
                    put(music, pluck(f * 2 if level == 2 else f) * av, t0 + s * BEAT / 4)
            # бас
            if level >= 1 or (name == "bridge" and b % 2 == 1):
                bv = 0.55 if level == 2 else 0.4
                for e in range(8):
                    if level == 2 or e in (0, 3, 4, 6):
                        put(music, bass_note(root * 2 if e % 4 == 3 else root, BEAT / 2) * bv, t0 + e * BEAT / 2)
            # ударные
            if level >= 1:
                kv = 0.8 if level == 2 else 0.55
                kicks = [0, 1, 2, 3] if level == 2 else [0, 2.5]
                for kb in kicks:
                    put(music, K * kv, t0 + kb * BEAT)
                for sb in (1, 3):
                    put(music, S * (0.45 if level == 2 else 0.3), t0 + sb * BEAT)
                for hb in range(8):
                    put(music, H * (0.12 if level == 2 else 0.08), t0 + hb * BEAT / 2)
                if level == 2:
                    for hb in (0.5, 1.5, 2.5, 3.5):
                        put(music, HO * 0.1, t0 + hb * BEAT)
            elif name == "bridge" and b % 2 == 0:
                put(music, K * 0.5, t0)
                put(music, K * 0.4, t0 + 2 * BEAT)
            # свуш перед припевом
            if name == "verse1" or name == "verse2" or name == "bridge":
                if b == nbars - 1:
                    n = int(BAR * SR)
                    sw = hp(np.random.randn(n), 1000) * np.linspace(0, 1, n) ** 2 * 0.15
                    put(fx, sw, t0)
        # «цифровой дождь»
        digital_rain(fx, bar * BAR, (bar + nbars) * BAR,
                     density={"intro": 14, "bridge": 10}.get(name, 4),
                     vol={"intro": 0.06, "outro": 0.06}.get(name, 0.025))
        # вокал
        for li, line in enumerate(lines):
            lbar = bar + li * 2
            if lbar + 2 > bar + nbars:
                break
            for v in voices:
                seg = render_line(line, v, lbar)
                tgt = vocal_m if v == "m" else vocal_f
                put(tgt, seg, lbar * BAR)
        bar += nbars

    # --- голоса-«кадры» из фильма
    def spoken(text, t, extra, speed, gain, pitch_ratio=1.0):
        sr, d = espeak_wav(text, extra, speed=speed)
        d = trim(d)
        tag = f"{zlib.crc32((text + str(pitch_ratio)).encode()):08x}"
        src, out = os.path.join(CACHE, f"p_{tag}.wav"), os.path.join(CACHE, f"q_{tag}.wav")
        if not os.path.exists(out):
            wavfile.write(src, sr, (d * 32767).astype(np.int16))
            run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ar", str(SR), "-af",
                 f"rubberband=pitch={pitch_ratio}:formant=preserved", out])
        _, o = wavfile.read(out)
        put(fx, o.astype(np.float32) / 32768 * gain, t)

    spoken("Проснись, Нео", 0.4 * BAR, ["-v", "ru+whisper", "-p", "20"], 95, 1.2, 0.85)
    spoken("Матрица имеет тебя", 1.9 * BAR, ["-v", "ru+whisper", "-p", "20"], 95, 1.2, 0.85)
    spoken("Следуй за белым кроликом", 2.9 * BAR, ["-v", "ru+whisper", "-p", "20"], 95, 1.2, 0.85)
    # «ложки нет» в бридже
    br_start = sum(s[1] for s in SECTIONS[:5]) * BAR
    spoken("Ложки нет", br_start + 7.0 * BAR, ["-v", "ru+whisper", "-p", "15"], 70, 1.3, 0.8)
    # финальный шёпот
    out_start = sum(s[1] for s in SECTIONS[:-1]) * BAR
    spoken("Добро пожаловать в реальный мир", out_start + 0.1 * BAR,
           ["-v", "ru+whisper", "-p", "20"], 85, 1.2, 0.85)

    # --- обработка
    vm = reverb(delay(vocal_m), 1.4, 0.25)
    vf = reverb(delay(vocal_f, BEAT * 0.5), 1.8, 0.35)
    fxr = reverb(fx, 2.2, 0.4)

    mix = music * 0.9 + vm * 1.0 + vf * 0.7 + fxr * 1.0
    # лёгкий сайдчейн-эффект от вокала не нужен; общий лимитер
    mix = np.tanh(mix * 1.3) / np.tanh(1.3)
    mix /= np.max(np.abs(mix)) + 1e-9
    mix *= 0.85
    # обрезка хвоста
    end = int((total_bars * BAR + 2.5) * SR)
    mix = mix[:end]
    fade = int(2 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    # стерео: мужской по центру, женский чуть вправо, арпеджио шире
    left = mix.copy()
    right = mix.copy()
    sh = int(0.012 * SR)
    right[sh:] = mix[:-sh] * 0.98
    stereo = np.stack([left, right], axis=1)
    return stereo


if __name__ == "__main__":
    st = build()
    wav = os.path.join(HERE, "red_pill.wav")
    wavfile.write(wav, SR, (st * 32767).astype(np.int16))
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame",
         "-q:a", "2", "-metadata", "title=Красная таблетка",
         "-metadata", "artist=Claude (espeak + numpy)", os.path.join(HERE, "red_pill.mp3")])
    print("готово:", st.shape[0] / SR, "сек")
