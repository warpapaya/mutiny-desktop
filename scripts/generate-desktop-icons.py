#!/usr/bin/env python3
"""Generate Mutiny desktop icon assets from the canonical 1024px brand mark."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "desktop"
SOURCE = ASSETS / "icon-source.png"
ICON_PNG = ASSETS / "icon.png"
ICON_ICO = ASSETS / "icon.ico"
ICON_ICNS = ASSETS / "icon.icns"
ICONSET = ASSETS / "icon.iconset"


def resample(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def rounded_macos_icon(source: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    inset = 24
    artwork = resample(source, 1024 - inset * 2)
    mask = Image.new("L", artwork.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, artwork.width - 1, artwork.height - 1),
        radius=210,
        fill=255,
    )
    canvas.paste(artwork, (inset, inset), mask)
    return canvas


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (1024, 1024):
        raise SystemExit(f"Expected a 1024x1024 source icon, got {source.size}")

    # Windows, Linux, tray, and window chrome use the full square brand mark.
    resample(source, 512).save(ICON_PNG, optimize=True)
    source.save(
        ICON_ICO,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    # macOS expects rounded app-icon geometry rather than a raw square tile.
    macos = rounded_macos_icon(source)
    shutil.rmtree(ICONSET, ignore_errors=True)
    ICONSET.mkdir()
    for logical in (16, 32, 128, 256, 512):
        resample(macos, logical).save(ICONSET / f"icon_{logical}x{logical}.png")
        resample(macos, logical * 2).save(ICONSET / f"icon_{logical}x{logical}@2x.png")

    subprocess.run(
        ["iconutil", "--convert", "icns", "--output", str(ICON_ICNS), str(ICONSET)],
        check=True,
    )
    shutil.rmtree(ICONSET)

    ico = Image.open(ICON_ICO)
    expected = {(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)}
    if ico.ico.sizes() != expected:
        raise SystemExit(f"ICO sizes mismatch: {sorted(ico.ico.sizes())}")
    if Image.open(ICON_PNG).size != (512, 512):
        raise SystemExit("PNG output is not 512x512")
    if not ICON_ICNS.exists() or ICON_ICNS.stat().st_size < 10_000:
        raise SystemExit("ICNS output is missing or unexpectedly small")

    print(f"Generated {ICON_PNG}, {ICON_ICO}, and {ICON_ICNS}")


if __name__ == "__main__":
    main()
