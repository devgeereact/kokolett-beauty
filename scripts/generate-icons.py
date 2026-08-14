"""Regenerate public/icons/*.png from docs/design/logo.png's mark.

One-time (or re-run-on-demand) script — not part of the build pipeline.
"""
from PIL import Image

SRC = "docs/design/logo.png"
BG = (28, 36, 51, 255)  # #1c2433 — src/index.css:75 --background (dark)
MARK_BOX = (45, 30, 787, 698)  # hair-silhouette mark only, wordmark excluded


def build_icon(size: int, mark_fraction: float, out_path: str) -> None:
    canvas = Image.new("RGBA", (size, size), BG)
    mark = Image.open(SRC).convert("RGBA").crop(MARK_BOX)
    mark_w = int(size * mark_fraction)
    mark_h = int(mark_w * mark.height / mark.width)
    mark = mark.resize((mark_w, mark_h), Image.LANCZOS)
    canvas.paste(mark, ((size - mark_w) // 2, (size - mark_h) // 2), mark)
    canvas.convert("RGB").save(out_path)


build_icon(512, 0.78, "public/icons/pwa-512.png")
build_icon(192, 0.78, "public/icons/pwa-192.png")
build_icon(512, 0.60, "public/icons/pwa-maskable-512.png")
build_icon(32, 0.82, "public/icons/favicon-32.png")
print("done")
