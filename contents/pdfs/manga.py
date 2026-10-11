#!/usr/bin/env python3
# Turns contents/reels/reels_script.txt into manga-style chapter PDFs in this folder,
# one per reel: every dialogue line becomes a panel with a face and a speech bubble.
# Needs Pillow. Run it, then render.sh, and commit the PDFs and pages/.
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
SCRIPT = HERE.parent / "reels" / "reels_script.txt"

# Reel title -> chapter slug (data/chapters.json in the learn feature).
SLUGS = {
    "Needs vs Wants": "budget-needs-vs-wants",
    "The 50-30-20 Rule": "budget-pocket-money-plan",
    "The No-Cost EMI Trap": "budget-no-cost-emi",
    "The Chai Math": "save-chai-math",
    "The Emergency Fund": "save-emergency-fund",
    "The Credit Card Minimum Due Trap": "save-credit-card-trap",
    "Compounding": "save-magic-of-compounding",
    "Risk and Diversification": "invest-risk-and-return",
    "Inflation": "invest-inflation",
    "Never Share Your OTP": "safety-upi-and-otp",
    "Spot the Scam": "safety-spot-the-scam",
    "The Money Mule": "safety-money-mule",
}
# side: which edge the face sits on; hair/shirt colours tell speakers apart.
CAST = {
    "Peter": dict(side="L", hair="#5b3a1e", shirt="#ffffff", spiky=False),
    "Stewie": dict(side="R", hair="#c8a165", shirt="#e04848", spiky=False),
    "Morty": dict(side="L", hair="#6b4423", shirt="#f2d230", spiky=False),
    "Rick": dict(side="R", hair="#9fd6f0", shirt="#e8f4fb", spiky=True),
}

W, H, M, GAP = 1080, 1528, 36, 22  # A5 ratio
FACE = 190
FONT = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
text_f, name_f = ImageFont.truetype(FONT, 40), ImageFont.truetype(BOLD, 30)
title_f, sub_f = ImageFont.truetype(BOLD, 64), ImageFont.truetype(BOLD, 32)
LINE = 54
TEXT_W = W - 2 * M - FACE - 140  # bubble text width, shared by sizing and drawing


def parse(path):
    reels, module = [], ""
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if m := re.match(r"Module \d+: (.+?) \(", line):
            module = m[1]
        elif m := re.match(r"(?:Hard )?Reel \d+: (.+)", line):
            reels.append(dict(title=m[1], module=module, lines=[]))
        elif reels and (m := re.match(r"(\w+): (.+)", line)) and m[1] in CAST:
            reels[-1]["lines"].append((m[1], m[2]))
    return reels


def wrap(draw, text, font, width):
    lines = [""]
    for word in text.split():
        trial = f"{lines[-1]} {word}".strip()
        if draw.textlength(trial, font=font) <= width:
            lines[-1] = trial
        else:
            lines.append(word)
    return lines


def face(d, cx, cy, who):
    c = CAST[who]
    d.rectangle([cx - 70, cy + 55, cx + 70, cy + 95], fill=c["shirt"], outline="black", width=5)
    d.ellipse([cx - 62, cy - 62, cx + 62, cy + 62], fill="#ffe0bd", outline="black", width=5)
    if c["spiky"]:
        pts = [(cx - 66 + 22 * i, cy - (95 if i % 2 else 40)) for i in range(7)]
        d.polygon([(cx - 66, cy - 15), *pts, (cx + 66, cy - 15)], fill=c["hair"], outline="black")
    else:
        d.chord([cx - 64, cy - 66, cx + 64, cy + 30], 180, 360, fill=c["hair"], outline="black", width=4)
    for ex in (cx - 24, cx + 24):
        d.ellipse([ex - 9, cy + 2, ex + 9, cy + 20], fill="black")
    d.arc([cx - 22, cy + 18, cx + 22, cy + 44], 20, 160, fill="black", width=4)


def panel_height(d, text):
    return max(FACE + 70, len(wrap(d, text, text_f, TEXT_W)) * LINE + 70)


def draw_panel(img, d, top, who, text):
    x0, x1 = M, W - M
    bottom = top + panel_height(d, text)
    d.rectangle([x0, top, x1, bottom], fill="white")
    for y in range(top + 8, bottom, 16):  # screentone
        for x in range(x0 + 8 + (y // 16 % 2) * 8, x1, 16):
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill="#d9d9d9")
    d.rectangle([x0, top, x1, bottom], outline="black", width=7)

    left = CAST[who]["side"] == "L"
    fx = x0 + 30 + FACE // 2 if left else x1 - 30 - FACE // 2
    face(d, fx, top + 110, who)
    tw = d.textlength(who.upper(), font=name_f)
    d.text((fx - tw / 2, top + 210), who.upper(), font=name_f, fill="black")

    bx0 = x0 + FACE + 60 if left else x0 + 30
    bx1 = x1 - 30 if left else x1 - FACE - 60
    lines = wrap(d, text, text_f, TEXT_W)
    by0 = top + 25
    by1 = by0 + len(lines) * LINE + 20
    tail_x = bx0 if left else bx1
    d.polygon([(tail_x, by0 + 22), (tail_x, by0 + 58), (fx + (70 if left else -70), top + 90)],
              fill="white", outline="black")
    shout = text.endswith("!")  # shouted lines get a heavier, squarer bubble
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=8 if shout else 36, fill="white", outline="black", width=11 if shout else 5)
    d.line([(tail_x, by0 + 24), (tail_x, by0 + 56)], fill="white", width=7)  # open the tail into the bubble
    for i, ln in enumerate(lines):
        d.text((bx0 + 25, by0 + 10 + i * LINE), ln, font=text_f, fill="black")
    return bottom


def new_page():
    img = Image.new("RGB", (W, H), "#f4f1ea")
    return img, ImageDraw.Draw(img)


def build(reel):
    pages = []
    img, d = new_page()
    title = wrap(d, reel["title"], title_f, W - 2 * M - 60)
    head = 110 + 76 * len(title)
    d.rectangle([M, M, W - M, M + head], fill="black")
    d.text((M + 30, M + 22), reel["module"].upper(), font=sub_f, fill="#f2d230")
    for i, ln in enumerate(title):
        d.text((M + 30, M + 66 + i * 76), ln, font=title_f, fill="white")
    y = M + head + GAP
    for who, text in reel["lines"]:
        if y + panel_height(d, text) > H - 60:
            pages.append(img)
            img, d = new_page()
            y = M
        y = draw_panel(img, d, y, who, text) + GAP
    d.text((W - M - 180, H - 55), "THE END", font=sub_f, fill="black")
    pages.append(img)
    for n, p in enumerate(pages, 1):
        ImageDraw.Draw(p).text((M, H - 55), f"{n} / {len(pages)}", font=sub_f, fill="#555")
    return pages


if __name__ == "__main__":
    reels = parse(SCRIPT)
    assert {r["title"] for r in reels} == set(SLUGS), "reel titles changed; update SLUGS"
    for reel in reels:
        pages = build(reel)
        out = HERE / f"{SLUGS[reel['title']]}.en.pdf"
        pages[0].save(out, save_all=True, append_images=pages[1:], resolution=W / 5.83, quality=80)
        print(out.name, len(pages), "pages")
