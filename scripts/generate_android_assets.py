#!/usr/bin/env python3
"""Generate Android launcher icons and splash screens for Opti Wi-Fi.

Pure stdlib (zlib + struct) PNG encoder/decoder so the build has no
dependency on Pillow or a working ImageMagick binary.

Design: navy #0B1A3A canvas, white circular badge, Opti Wi-Fi logo centred.
Run from the repository root:  python3 scripts/generate_android_assets.py
"""

from __future__ import annotations

import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
LOGO = os.path.join(ROOT, "public", "assets", "logo.jpg")

NAVY = (0x0B, 0x1A, 0x3A)
WHITE = (0xFF, 0xFF, 0xFF)
SS = 4  # supersampling factor for anti-aliasing

DENSITIES = {
    "mdpi": 1.0,
    "hdpi": 1.5,
    "xhdpi": 2.0,
    "xxhdpi": 3.0,
    "xxxhdpi": 4.0,
}


# --------------------------------------------------------------------------- PNG


def read_png(path: str) -> tuple[int, int, bytearray]:
    """Decode an 8-bit non-interlaced PNG into (w, h, rgb)."""
    data = open(path, "rb").read()
    pos, idat, width, height, depth, ctype = 8, bytearray(), 0, 0, 0, 0
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        ctag = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        if ctag == b"IHDR":
            width, height, depth, ctype = struct.unpack(">IIBB", chunk[:10])
        elif ctag == b"IDAT":
            idat += chunk
        pos += 12 + length

    if depth != 8:
        raise ValueError(f"unsupported bit depth {depth} in {path}")

    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    out = bytearray()
    prev = bytearray(stride)
    pos = 0
    for _ in range(height):
        ftype = raw[pos]
        pos += 1
        line = bytearray(raw[pos : pos + stride])
        pos += stride
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if ftype == 1:
                line[x] = (line[x] + a) & 255
            elif ftype == 2:
                line[x] = (line[x] + b) & 255
            elif ftype == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif ftype == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 255
        out += line
        prev = line

    rgba = bytearray()
    for i in range(0, len(out), channels):
        px = out[i : i + channels]
        if channels == 4:
            rgba += bytes(px)
        elif channels == 3:
            rgba += bytes(px) + b"\xff"
        elif channels == 2:
            rgba += bytes([px[0]] * 3) + bytes([px[1]])
        else:
            rgba += bytes([px[0]] * 3) + b"\xff"
    return width, height, rgba


def write_png(path: str, width: int, height: int, rgba: bytes) -> None:
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw += rgba[y * stride : (y + 1) * stride]

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    body = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(body)


# ----------------------------------------------------------------------- resize


def resize(src: bytes, sw: int, sh: int, dw: int, dh: int) -> bytearray:
    """Box-filter resize of RGBA pixel data."""
    out = bytearray(dw * dh * 4)
    for y in range(dh):
        y0, y1 = (y * sh) // dh, max(((y + 1) * sh) // dh, (y * sh) // dh + 1)
        for x in range(dw):
            x0, x1 = (x * sw) // dw, max(((x + 1) * sw) // dw, (x * sw) // dw + 1)
            r = g = b = a = n = 0
            for sy in range(y0, min(y1, sh)):
                base = sy * sw * 4
                for sx in range(x0, min(x1, sw)):
                    o = base + sx * 4
                    r += src[o]
                    g += src[o + 1]
                    b += src[o + 2]
                    a += src[o + 3]
                    n += 1
            o = (y * dw + x) * 4
            out[o] = r // n
            out[o + 1] = g // n
            out[o + 2] = b // n
            out[o + 3] = a // n
    return out


def fill(color: tuple[int, int, int], w: int, h: int) -> bytearray:
    return bytearray(bytes((*color, 255)) * (w * h))


# -------------------------------------------------------------------------- draw


def draw_badge(
    canvas_w: int,
    canvas_h: int,
    badge_ratio: float,
    bg: tuple[int, int, int] | None,
) -> tuple[bytearray, int, int, int]:
    """Draw the white circular badge. Returns (canvas, cx, cy, diameter)."""
    if bg is None:
        canvas = bytearray(canvas_w * canvas_h * 4)
    else:
        canvas = fill(bg, canvas_w, canvas_h)

    diameter = int(min(canvas_w, canvas_h) * badge_ratio)
    cx, cy = canvas_w // 2, canvas_h // 2
    radius = diameter / 2.0
    left, top = cx - diameter // 2, cy - diameter // 2

    for y in range(canvas_h):
        row = y * canvas_w * 4
        for x in range(canvas_w):
            dx, dy = x + 0.5 - (left + radius), y + 0.5 - (top + radius)
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= radius:
                alpha = 255
            elif dist <= radius + 1:
                alpha = int(255 * (radius + 1 - dist))
            else:
                continue
            o = row + x * 4
            canvas[o : o + 4] = bytes((WHITE[0], WHITE[1], WHITE[2], alpha))
    return canvas, cx, cy, diameter


def paste(dst: bytearray, dst_w: int, src: bytes, sw: int, sh: int, ox: int, oy: int) -> None:
    for y in range(sh):
        do = ((oy + y) * dst_w + ox) * 4
        so = y * sw * 4
        dst[do : do + sw * 4] = src[so : so + sw * 4]


# ------------------------------------------------------------------- generation


def make_logo_canvas(size: int, logo: bytes, lw: int, lh: int, bg=None) -> bytearray:
    big = size * SS
    canvas, cx, cy, diameter = draw_badge(big, big, 0.72, bg)
    inner = int(diameter * 0.94)
    mark = resize(logo, lw, lh, inner, inner)
    paste(canvas, big, mark, inner, inner, cx - inner // 2, cy - inner // 2)
    return resize(canvas, big, big, size, size)


def make_splash(w: int, h: int, logo: bytes, lw: int, lh: int) -> bytearray:
    big_w, big_h = w * 2, h * 2
    canvas, cx, cy, diameter = draw_badge(big_w, big_h, 0.34, NAVY)
    inner = int(diameter * 0.94)
    mark = resize(logo, lw, lh, inner, inner)
    paste(canvas, big_w, mark, inner, inner, cx - inner // 2, cy - inner // 2)
    return resize(canvas, big_w, big_h, w, h)


def main() -> int:
    png_logo = os.path.join(os.path.dirname(LOGO), "_logo_tmp.png")
    os.system(f'sips -s format png "{LOGO}" --out "{png_logo}" >/dev/null')
    lw, lh, logo = read_png(png_logo)
    os.remove(png_logo)

    for density, scale in DENSITIES.items():
        folder = os.path.join(RES, f"mipmap-{density}")
        legacy = int(48 * scale)
        write_png(
            os.path.join(folder, "ic_launcher.png"),
            legacy,
            legacy,
            make_logo_canvas(legacy, logo, lw, lh, NAVY),
        )
        write_png(
            os.path.join(folder, "ic_launcher_round.png"),
            legacy,
            legacy,
            make_logo_canvas(legacy, logo, lw, lh, NAVY),
        )
        # Adaptive foreground: 108dp canvas, badge kept inside the 72dp mask.
        foreground = int(108 * scale)
        write_png(
            os.path.join(folder, "ic_launcher_foreground.png"),
            foreground,
            foreground,
            make_logo_canvas(foreground, logo, lw, lh, None),
        )
        print(f"mipmap-{density}: {legacy}px legacy, {foreground}px foreground")

    splashes = {"drawable": (480, 320)}
    for orientation, base in (("port", (320, 480)), ("land", (480, 320))):
        for density, scale in DENSITIES.items():
            splashes[f"drawable-{orientation}-{density}"] = (
                int(base[0] * scale),
                int(base[1] * scale),
            )

    for folder, (w, h) in splashes.items():
        write_png(
            os.path.join(RES, folder, "splash.png"), w, h, make_splash(w, h, logo, lw, lh)
        )
        print(f"{folder}/splash.png: {w}x{h}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
