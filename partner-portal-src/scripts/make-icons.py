#!/usr/bin/env python3
"""
Генерує іконки застосунку без зовнішніх залежностей.

Мотив зображення — гори з логотипа бренду («З самого серця Карпат»)
у фірмових кольорах Pantone 300 C і 7724 C.

Запуск:  python3 scripts/make-icons.py
"""

import struct
import zlib
from pathlib import Path

BLUE = (0x00, 0x5E, 0xB8)
GREEN = (0x00, 0x96, 0x6C)
WHITE = (0xFF, 0xFF, 0xFF)

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"


def fill_polygon(pixels, size, points, color):
    """Заливка багатокутника скануванням рядків."""
    ys = [p[1] for p in points]
    for y in range(max(0, int(min(ys))), min(size, int(max(ys)) + 1)):
        crossings = []
        for i in range(len(points)):
            x1, y1 = points[i]
            x2, y2 = points[(i + 1) % len(points)]
            if (y1 <= y < y2) or (y2 <= y < y1):
                t = (y - y1) / (y2 - y1)
                crossings.append(x1 + t * (x2 - x1))
        crossings.sort()
        for i in range(0, len(crossings) - 1, 2):
            for x in range(max(0, int(crossings[i])), min(size, int(crossings[i + 1]) + 1)):
                pixels[y][x] = color


def rounded_background(pixels, size, color, radius):
    """Фон із заокругленими кутами — щоб іконка гарно лягала на Android."""
    for y in range(size):
        for x in range(size):
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            if dx < radius and dy < radius:
                if (radius - dx) ** 2 + (radius - dy) ** 2 > radius**2:
                    continue
            pixels[y][x] = color


def write_png(path, pixels, size):
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("BBB", *px) for px in row) for row in pixels
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    print(f"  {path.name}  {size}×{size}  {len(png) / 1024:.1f} КБ")


def build(size, padding_ratio, rounded):
    """padding_ratio — вільне поле по краях; для maskable потрібне більше."""
    pixels = [[(0xF2, 0xF6, 0xFA) for _ in range(size)] for _ in range(size)]

    if rounded:
        rounded_background(pixels, size, BLUE, int(size * 0.22))
    else:
        for row in pixels:
            for x in range(size):
                row[x] = BLUE

    pad = size * padding_ratio
    inner = size - 2 * pad
    base = pad + inner * 0.78  # лінія «води»

    # Задня гора — світліша, зі зміщенням праворуч
    fill_polygon(
        pixels,
        size,
        [
            (pad + inner * 0.38, base),
            (pad + inner * 0.68, pad + inner * 0.20),
            (pad + inner * 1.00, base),
        ],
        GREEN,
    )

    # Передня гора
    fill_polygon(
        pixels,
        size,
        [
            (pad, base),
            (pad + inner * 0.36, pad + inner * 0.06),
            (pad + inner * 0.72, base),
        ],
        WHITE,
    )

    # Смуга води під горами
    fill_polygon(
        pixels,
        size,
        [
            (pad, base + inner * 0.06),
            (pad + inner, base + inner * 0.06),
            (pad + inner, base + inner * 0.16),
            (pad, base + inner * 0.16),
        ],
        WHITE,
    )

    return pixels


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("Генерую іконки:")
    for name, size, pad, rounded in [
        ("icon-192.png", 192, 0.12, True),
        ("icon-512.png", 512, 0.12, True),
        # maskable: система може обрізати до 20% з кожного боку
        ("icon-maskable-512.png", 512, 0.26, False),
    ]:
        write_png(OUT / name, build(size, pad, rounded), size)


if __name__ == "__main__":
    main()
