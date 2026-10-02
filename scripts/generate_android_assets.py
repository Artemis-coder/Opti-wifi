#!/usr/bin/env python3
"""Generate Android launcher icons and splash screens for OptiSpace.

Pure stdlib (zlib + struct) PNG encoder/decoder so the build has no
dependency on Pillow or a working ImageMagick binary.

Design: the OptiSpace icon (Icon app/OptiSpace.jpg) is full bleed, the
adaptive foreground keeps it inside the 72dp mask with the secondary green
(#84C865) as the background layer, and the splash shows it as a circular
badge on the brand chrome canvas (#1B3F2B).
Run from the repository root:  python3 scripts/generate_android_assets.py
"""

from __future__ import annotations

import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
LOGO = os.path.join(ROOT, "Icon app", "OptiSpace.jpg")

CHROME = (0x1B, 0x3F, 0x2B)  # BRAND.chrome
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


def make_circle_badge(
    canvas_w: int,
    canvas_h: int,
    badge_ratio: float,
    icon: bytes,
    iw: int,
    ih: int,
    bg: tuple[int, int, int] | None,
) -> bytearray:
    """Mask the icon into a circle centred on the canvas."""
    if bg is None:
        canvas = bytearray(canvas_w * canvas_h * 4)
    else:
        canvas = fill(bg, canvas_w, canvas_h)

    diameter = int(min(canvas_w, canvas_h) * badge_ratio)
    cx, cy = canvas_w // 2, canvas_h // 2
    left, top = cx - diameter // 2, cy - diameter // 2
    radius = diameter / 2.0
    mark = resize(icon, iw, ih, diameter, diameter)

    for y in range(diameter):
        for x in range(diameter):
            dx, dy = x + 0.5 - radius, y + 0.5 - radius
            dist = (dx * dx + dy * dy) ** 0.5
            if dist > radius + 1:
                continue
            alpha = 255 if dist <= radius else int(255 * (radius + 1 - dist))
            so = (y * diameter + x) * 4
            o = ((top + y) * canvas_w + left + x) * 4
            canvas[o : o + 4] = bytes(
                (
                    mark[so],
                    mark[so + 1],
                    mark[so + 2],
                    int(mark[so + 3] * alpha / 255),
                )
            )
    return canvas


# ------------------------------------------------------------------- generation


def make_legacy_icon(size: int, icon: bytes, iw: int, ih: int) -> bytearray:
    """Full bleed square icon: the launcher applies its own shape mask."""
    big = size * SS
    return resize(icon, iw, ih, big, big)


def make_adaptive_foreground(size: int, icon: bytes, iw: int, ih: int) -> bytearray:
    """108dp canvas with the icon centred inside the 72dp visible mask."""
    canvas = bytearray(size * size * 4)
    inner = int(size * 72 / 108)
    mark = resize(icon, iw, ih, inner, inner)
    offset = (size - inner) // 2
    for y in range(inner):
        do = ((offset + y) * size + offset) * 4
        so = y * inner * 4
        canvas[do : do + inner * 4] = mark[so : so + inner * 4]
    return canvas


def make_splash(w: int, h: int, icon: bytes, iw: int, ih: int) -> bytearray:
    big_w, big_h = w * SS, h * SS
    canvas = make_circle_badge(big_w, big_h, 0.34, icon, iw, ih, CHROME)
    return resize(canvas, big_w, big_h, w, h)


def main() -> int:
    png_icon = os.path.join(os.path.dirname(LOGO), "_icon_tmp.png")
    os.system(f'sips -s format png "{LOGO}" --out "{png_icon}" >/dev/null')
    iw, ih, icon = read_png(png_icon)
    os.remove(png_icon)

    for density, scale in DENSITIES.items():
        folder = os.path.join(RES, f"mipmap-{density}")
        legacy = int(48 * scale)
        write_png(
            os.path.join(folder, "ic_launcher.png"),
            legacy,
            legacy,
            make_legacy_icon(legacy, icon, iw, ih),
        )
        write_png(
            os.path.join(folder, "ic_launcher_round.png"),
            legacy,
            legacy,
            make_legacy_icon(legacy, icon, iw, ih),
        )
        # Adaptive foreground: 108dp canvas, artwork inside the 72dp mask.
        foreground = int(108 * scale)
        write_png(
            os.path.join(folder, "ic_launcher_foreground.png"),
            foreground,
            foreground,
            make_adaptive_foreground(foreground, icon, iw, ih),
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
            os.path.join(RES, folder, "splash.png"), w, h, make_splash(w, h, icon, iw, ih)
        )
        print(f"{folder}/splash.png: {w}x{h}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
