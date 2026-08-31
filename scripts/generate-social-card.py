"""Build public/icons/social-card.png, the 1200x630 Open Graph card.

One-time (or re-run-on-demand) script, not part of the build pipeline, the
same as scripts/generate-icons.py.

Every share of the site used to preview with the square PWA app icon, which
reads as an app install rather than a salon. A 1200x630 card is what Facebook,
WhatsApp, Instagram, X and LinkedIn all crop from.
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (28, 36, 51)  # #1c2433, src/index.css --background (dark)
BRAND = (224, 93, 56)  # #e05d38, the terracotta
INK = (245, 243, 240)
MUTED = (168, 175, 189)

SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SERIF_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"

canvas = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(canvas)

# Terracotta rule down the left edge, the same accent the site uses.
draw.rectangle([0, 0, 12, H], fill=BRAND)

# The hair mark, lifted from the icon that already exists.
mark = Image.open("public/icons/pwa-512.png").convert("RGB")
mark_size = 300
mark = mark.resize((mark_size, mark_size), Image.LANCZOS)
canvas.paste(mark, (96, (H - mark_size) // 2))

x = 96 + mark_size + 72
draw.text((x, 214), "Kokolett", font=ImageFont.truetype(SERIF_BOLD, 76), fill=INK)
draw.text((x, 296), "Beauty UK", font=ImageFont.truetype(SERIF_BOLD, 76), fill=BRAND)
draw.text(
    (x, 402),
    "Women's hair salon",
    font=ImageFont.truetype(SERIF, 34),
    fill=INK,
)
draw.text(
    (x, 448),
    "Thamesmead, South East London",
    font=ImageFont.truetype(SERIF, 30),
    fill=MUTED,
)

canvas.save("public/icons/social-card.png")
print("wrote public/icons/social-card.png", canvas.size)
