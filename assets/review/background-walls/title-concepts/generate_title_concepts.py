from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
FONT_PATH = Path(r"C:/Windows/Fonts/msyhbd.ttc")
SOURCES = {
    "classic": ROOT / "assets/review/background-walls/candidates/classic-animated-feature.png",
    "wild": ROOT / "assets/review/background-walls/candidates/wild-cinematic-3d.png",
}
EXPECTED = {
    "classic": "7a7ff5d84bcca32293725faa743487951619316ca76ff8939c5beb24d0fa14eb",
    "wild": "746dbc326e6f037b7197b571e26729bf8467e3e80aad21d803631a2a4caa38a7",
}
MODES = {
    "classic": ("经典模式", "CLASSIC MODE"),
    "wild": ("猩风作浪", "GORILLAS GONE WILD"),
}
CONCEPTS = ("A", "B", "C")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def fit_font(text: str, max_width: int, start: int, minimum: int = 28) -> ImageFont.FreeTypeFont:
    for size in range(start, minimum - 1, -2):
        f = font(size)
        if f.getbbox(text)[2] <= max_width:
            return f
    return font(minimum)


def centered(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt, fill, **kwargs):
    box = draw.textbbox((0, 0), text, font=fnt, stroke_width=kwargs.get("stroke_width", 0))
    draw.text((xy[0] - (box[2] - box[0]) // 2, xy[1] - (box[3] - box[1]) // 2 - box[1]), text, font=fnt, fill=fill, **kwargs)


def rounded_gradient(size, top, bottom, radius, border=None, border_width=3):
    w, h = size
    layer = Image.new("RGBA", size)
    px = layer.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
        for x in range(w):
            px[x, y] = c
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
    if border:
        ImageDraw.Draw(layer).rounded_rectangle((1, 1, w - 2, h - 2), radius=radius, outline=border, width=border_width)
    return layer


def dashed_rect(draw, box, fill, width=2, dash=14, gap=9):
    x0, y0, x1, y1 = box
    for x in range(x0, x1, dash + gap):
        draw.line((x, y0, min(x + dash, x1), y0), fill=fill, width=width)
        draw.line((x, y1, min(x + dash, x1), y1), fill=fill, width=width)
    for y in range(y0, y1, dash + gap):
        draw.line((x0, y, x0, min(y + dash, y1)), fill=fill, width=width)
        draw.line((x1, y, x1, min(y + dash, y1)), fill=fill, width=width)


def add_review_guides(im: Image.Image):
    w, h = im.size
    guide = Image.new("RGBA", im.size)
    d = ImageDraw.Draw(guide)
    safe = (round(w * .08), round(h * .07), round(w * .92), round(h * .48))
    dashed_rect(d, safe, (104, 238, 255, 175), max(2, w // 700))
    label_f = font(max(18, w // 64))
    d.rounded_rectangle((safe[0] + 8, safe[1] + 8, safe[0] + 205, safe[1] + 40), radius=8, fill=(3, 18, 25, 175))
    d.text((safe[0] + 17, safe[1] + 10), "标题安全区 / TITLE SAFE", font=label_f, fill=(151, 244, 255, 230))
    # Bottom reservation communicates where future room lobby / game table UI remains unobstructed.
    y = round(h * .68)
    d.rectangle((0, y, w, h), fill=(0, 9, 16, 48))
    d.line((round(w * .08), y, round(w * .92), y), fill=(255, 255, 255, 120), width=max(2, w // 800))
    d.text((round(w * .09), y + 12), "预留：房间大厅 / 游戏桌叠加区", font=label_f, fill=(255, 255, 255, 190))
    im.alpha_composite(guide)


def concept_a(base: Image.Image, title: str, subtitle: str):
    w, h = base.size
    pw, ph = round(w * .66), round(h * .24)
    plate = rounded_gradient((pw, ph), (79, 61, 30, 245), (17, 18, 20, 247), ph // 9, (226, 180, 74, 255), max(3, w // 450))
    pd = ImageDraw.Draw(plate)
    inset = max(9, pw // 85)
    pd.rounded_rectangle((inset, inset, pw - inset, ph - inset), radius=ph // 12, outline=(255, 225, 143, 105), width=max(2, w // 700))
    for x, y in ((20, 20), (pw - 20, 20), (20, ph - 20), (pw - 20, ph - 20)):
        pd.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(226, 187, 103, 255), outline=(40, 28, 12, 255), width=2)
    tf = fit_font(title, round(pw * .75), round(ph * .40))
    sf = fit_font(subtitle, round(pw * .64), round(ph * .105), 16)
    centered(pd, (pw // 2, round(ph * .43)), title, tf, (255, 224, 142, 255), stroke_width=max(1, w // 1000), stroke_fill=(54, 31, 8, 255))
    centered(pd, (pw // 2, round(ph * .76)), subtitle, sf, (211, 185, 125, 230))
    shadow = Image.new("RGBA", base.size)
    x, y = (w - pw) // 2, round(h * .14)
    shadow.paste(Image.new("RGBA", (pw, ph), (0, 0, 0, 190)), (x + 10, y + 14), plate.getchannel("A"))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(8, w // 100)))
    base.alpha_composite(shadow)
    base.alpha_composite(plate, (x, y))


def concept_b(base: Image.Image, title: str, subtitle: str):
    w, h = base.size
    layer = Image.new("RGBA", base.size)
    d = ImageDraw.Draw(layer)
    tf = fit_font(title, round(w * .72), round(h * .115))
    sf = fit_font(subtitle, round(w * .55), round(h * .036), 16)
    cx, cy = w // 2, round(h * .23)
    # Neon tubes are built from blurred strokes plus a crisp white-hot core.
    glow = Image.new("RGBA", base.size)
    gd = ImageDraw.Draw(glow)
    box = d.textbbox((0, 0), title, font=tf, stroke_width=2)
    tx = cx - (box[2] - box[0]) // 2
    ty = cy - (box[3] - box[1]) // 2 - box[1]
    for sw, alpha in ((18, 45), (10, 95), (5, 180)):
        gd.text((tx, ty), title, font=tf, fill=(92, 247, 255, alpha), stroke_width=sw, stroke_fill=(0, 183, 210, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(max(5, w // 180)))
    base.alpha_composite(glow)
    d.text((tx, ty), title, font=tf, fill=(224, 255, 255, 255), stroke_width=max(2, w // 700), stroke_fill=(26, 219, 232, 255))
    centered(d, (cx, round(h * .35)), subtitle, sf, (188, 250, 255, 245), stroke_width=1, stroke_fill=(0, 43, 53, 255))
    d.line((round(w * .27), round(h * .39), round(w * .73), round(h * .39)), fill=(76, 232, 244, 210), width=max(2, w // 700))
    base.alpha_composite(layer)


def concept_c(base: Image.Image, title: str, subtitle: str):
    w, h = base.size
    veil = Image.new("RGBA", base.size)
    vd = ImageDraw.Draw(veil)
    vd.rectangle((0, round(h * .08), w, round(h * .48)), fill=(19, 0, 4, 92))
    base.alpha_composite(veil)
    layer = Image.new("RGBA", base.size)
    d = ImageDraw.Draw(layer)
    tf = fit_font(title, round(w * .74), round(h * .13))
    sf = fit_font(subtitle, round(w * .52), round(h * .034), 16)
    cx, cy = w // 2, round(h * .25)
    centered(d, (cx + 5, cy + 7), title, tf, (12, 0, 0, 210), stroke_width=max(4, w // 380), stroke_fill=(12, 0, 0, 230))
    centered(d, (cx, cy), title, tf, (222, 198, 148, 255), stroke_width=max(2, w // 650), stroke_fill=(91, 8, 10, 255))
    centered(d, (cx, round(h * .38)), subtitle, sf, (255, 221, 184, 245))
    line_y = round(h * .42)
    d.line((round(w * .22), line_y, round(w * .78), line_y), fill=(173, 35, 28, 230), width=max(3, w // 550))
    d.line((round(w * .35), line_y + 7, round(w * .65), line_y + 7), fill=(222, 174, 101, 180), width=max(1, w // 1000))
    base.alpha_composite(layer)


def glyph_check():
    chars = "经典模式猩风作浪"
    try:
        from fontTools.ttLib import TTFont, TTCollection
        if FONT_PATH.suffix.lower() == ".ttc":
            fonts = TTCollection(str(FONT_PATH)).fonts
        else:
            fonts = [TTFont(str(FONT_PATH))]
        cmap = {}
        for face in fonts:
            cmap.update(face.getBestCmap() or {})
        return "fontTools cmap", {ch: (ord(ch) in cmap) for ch in chars}
    except (ImportError, OSError):
        f = font(96)
        replacement = f.getmask("\ufffd").getbbox()
        result = {}
        for ch in chars:
            mask = f.getmask(ch)
            bbox = mask.getbbox()
            result[ch] = bool(bbox and (bbox != replacement or bytes(mask) != bytes(f.getmask("\ufffd"))))
        return "Pillow mask bbox/bitmap vs U+FFFD", result


def main():
    if not FONT_PATH.is_file():
        raise FileNotFoundError(f"Required font missing: {FONT_PATH}")
    before = {key: sha256(path) for key, path in SOURCES.items()}
    if before != EXPECTED:
        raise RuntimeError(f"Source hash mismatch: {before}")
    method, glyphs = glyph_check()
    if not all(glyphs.values()):
        raise RuntimeError(f"Font lacks required glyphs: {glyphs}")

    outputs = []
    thumbs = []
    for concept in CONCEPTS:
        for key, source in SOURCES.items():
            with Image.open(source) as src:
                src.load()
                preview = src.convert("RGBA")
            add_review_guides(preview)
            title, subtitle = MODES[key]
            {"A": concept_a, "B": concept_b, "C": concept_c}[concept](preview, title, subtitle)
            name = f"{concept.lower()}-{key}-title-preview.png"
            path = OUT / name
            preview.convert("RGB").save(path, "PNG", optimize=True)
            outputs.append((name, preview.size))
            thumbs.append((concept, key, preview.convert("RGB")))

    cell_w, cell_h = 640, 390
    sheet = Image.new("RGB", (cell_w * 2, cell_h * 3), (10, 13, 17))
    sd = ImageDraw.Draw(sheet)
    lf = font(42)
    mf = font(23)
    for idx, (concept, key, im) in enumerate(thumbs):
        row, col = divmod(idx, 2)
        thumb = im.copy()
        thumb.thumbnail((cell_w - 20, cell_h - 54), Image.Resampling.LANCZOS)
        x = col * cell_w + (cell_w - thumb.width) // 2
        y = row * cell_h + 48 + (cell_h - 54 - thumb.height) // 2
        sheet.paste(thumb, (x, y))
        sd.rounded_rectangle((col * cell_w + 12, row * cell_h + 7, col * cell_w + 72, row * cell_h + 45), radius=8, fill=(218, 174, 74))
        sd.text((col * cell_w + 28, row * cell_h + 4), concept, font=lf, fill=(19, 20, 22))
        label = "经典模式" if key == "classic" else "猩风作浪"
        sd.text((col * cell_w + 86, row * cell_h + 13), label, font=mf, fill=(238, 242, 245))
    sheet_path = OUT / "abc-title-concepts-contact-sheet.png"
    sheet.save(sheet_path, "PNG", optimize=True)
    outputs.append((sheet_path.name, sheet.size))

    after = {key: sha256(path) for key, path in SOURCES.items()}
    if before != after:
        raise RuntimeError(f"Source files changed: before={before}, after={after}")

    verified = {}
    for name, expected_size in outputs:
        path = OUT / name
        with Image.open(path) as check:
            check.verify()
        with Image.open(path) as check:
            verified[name] = {"size": list(check.size), "mode": check.mode, "normal": check.size == expected_size and min(check.size) > 0}
    print(json.dumps({
        "font": str(FONT_PATH), "font_check_method": method, "glyphs": glyphs,
        "source_sha256_before": before, "source_sha256_after": after,
        "outputs": verified,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
