#!/usr/bin/env python3

from __future__ import annotations

import math
import pathlib
import struct
import zlib


ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD_DIR = ROOT / "build"
ICON_DIR = BUILD_DIR / "icons"

SIZES = [16, 32, 48, 64, 128, 256, 512]


def clamp(value: float) -> int:
    return max(0, min(255, int(round(value))))


def blend(bottom: tuple[int, int, int], top: tuple[int, int, int], alpha: float) -> tuple[int, int, int]:
    return tuple(
        clamp(bottom[index] * (1.0 - alpha) + top[index] * alpha)
        for index in range(3)
    )


def background_color(x: float, y: float) -> tuple[int, int, int]:
    top = (20, 48, 74)
    bottom = (240, 123, 74)
    mix = 0.55 * x + 0.45 * y
    base = tuple(clamp(top[index] * (1.0 - mix) + bottom[index] * mix) for index in range(3))

    glow_left = math.exp(-(((x - 0.18) ** 2) + ((y - 0.18) ** 2)) / 0.018)
    glow_right = math.exp(-(((x - 0.8) ** 2) + ((y - 0.78) ** 2)) / 0.028)
    base = blend(base, (255, 158, 126), 0.22 * glow_left)
    base = blend(base, (107, 144, 255), 0.16 * glow_right)
    return base


def rounded_square_mask(x: float, y: float, center: float = 0.5, half_size: float = 0.39, radius: float = 0.11) -> float:
    dx = abs(x - center) - (half_size - radius)
    dy = abs(y - center) - (half_size - radius)
    qx = max(dx, 0.0)
    qy = max(dy, 0.0)
    outside = math.sqrt(qx * qx + qy * qy)
    inside = min(max(dx, dy), 0.0)
    distance = outside + inside - radius
    feather = 0.01
    return max(0.0, min(1.0, 0.5 - distance / feather))


def circle_mask(x: float, y: float, cx: float, cy: float, radius: float, feather: float = 0.01) -> float:
    distance = math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - radius
    return max(0.0, min(1.0, 0.5 - distance / feather))


def segment_mask(
    x: float,
    y: float,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    radius: float,
    feather: float = 0.01,
) -> float:
    px = x - x1
    py = y - y1
    dx = x2 - x1
    dy = y2 - y1
    segment_length_sq = dx * dx + dy * dy
    projection = 0.0 if segment_length_sq == 0 else max(0.0, min(1.0, (px * dx + py * dy) / segment_length_sq))
    closest_x = x1 + projection * dx
    closest_y = y1 + projection * dy
    distance = math.sqrt((x - closest_x) ** 2 + (y - closest_y) ** 2) - radius
    return max(0.0, min(1.0, 0.5 - distance / feather))


def draw_icon(size: int) -> bytes:
    rows = []

    for py in range(size):
      row = bytearray([0])
      y = py / (size - 1) if size > 1 else 0
      for px in range(size):
        x = px / (size - 1) if size > 1 else 0
        color = background_color(x, y)

        plate_mask = rounded_square_mask(x, y)
        if plate_mask > 0:
            plate = blend((255, 249, 239), (255, 255, 255), 0.35 * y)
            color = blend(color, plate, 0.9 * plate_mask)

        stroke = (17, 48, 66)
        line_left = segment_mask(x, y, 0.24, 0.68, 0.24, 0.34, 0.02)
        diag_left = segment_mask(x, y, 0.24, 0.34, 0.5, 0.6, 0.025)
        diag_right = segment_mask(x, y, 0.76, 0.34, 0.5, 0.6, 0.025)
        line_right = segment_mask(x, y, 0.76, 0.68, 0.76, 0.34, 0.02)
        line_center = segment_mask(x, y, 0.5, 0.74, 0.5, 0.58, 0.02)

        for mask in [line_left, diag_left, diag_right, line_right, line_center]:
            if mask > 0:
                color = blend(color, stroke, mask)

        dot_orange = circle_mask(x, y, 0.24, 0.24, 0.055)
        dot_blue = circle_mask(x, y, 0.76, 0.24, 0.055)
        dot_green = circle_mask(x, y, 0.5, 0.78, 0.06)

        if dot_orange > 0:
            color = blend(color, (255, 122, 89), dot_orange)
        if dot_blue > 0:
            color = blend(color, (79, 124, 255), dot_blue)
        if dot_green > 0:
            color = blend(color, (31, 175, 143), dot_green)

        row.extend((color[0], color[1], color[2], 255))
      rows.append(bytes(row))

    return png_bytes(size, size, b"".join(rows))


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    )


def png_bytes(width: int, height: int, raw_data: bytes) -> bytes:
    header = png_chunk(
        b"IHDR",
        struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0),
    )
    body = png_chunk(b"IDAT", zlib.compress(raw_data, level=9))
    footer = png_chunk(b"IEND", b"")
    return b"\x89PNG\r\n\x1a\n" + header + body + footer


def main() -> None:
    BUILD_DIR.mkdir(exist_ok=True)
    ICON_DIR.mkdir(exist_ok=True)

    for size in SIZES:
        png_data = draw_icon(size)
        icon_path = ICON_DIR / f"{size}x{size}.png"
        icon_path.write_bytes(png_data)
        if size == 512:
            (BUILD_DIR / "icon.png").write_bytes(png_data)


if __name__ == "__main__":
    main()
