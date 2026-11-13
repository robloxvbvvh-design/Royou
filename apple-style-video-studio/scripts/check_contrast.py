#!/usr/bin/env python3
"""Проверка контраста пар цветов (WCAG).

Использование:
  python3 check_contrast.py "#F5F5F7" "#111111" ["#0071E3" "#000000" ...]
Цвета передаются парами: текст, фон. Выводит коэффициент и вердикт.
"""
import sys


def lum(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a: str, b: str) -> float:
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def main(argv):
    if len(argv) < 2 or len(argv) % 2:
        print(__doc__)
        return 2
    bad = False
    for fg, bg in zip(argv[::2], argv[1::2]):
        r = ratio(fg, bg)
        verdict = "OK" if r >= 4.5 else ("только крупный текст" if r >= 3 else "ПЛОХО")
        bad |= r < 3
        print(f"{fg} на {bg}: {r:.2f}:1 — {verdict}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
