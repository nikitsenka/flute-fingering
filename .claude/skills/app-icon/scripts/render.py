"""Rasterize an SVG to PNG at an exact pixel size.

  python3 render.py icon.svg out.png --size 192
  python3 render.py icon.svg zoom.png --size 32 --scale 8
  python3 render.py icon.svg check.png --size 32 --bg "#2b2b2b"

Backends, in preference order: headless Chrome, rsvg-convert, magick, cairosvg.
Prints the real dimensions and alpha of what it wrote, so the caller can verify
without a second tool.
"""

import argparse
import os
import shutil
import struct
import subprocess
import sys
import tempfile

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
]


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        if os.path.isfile(candidate):
            return candidate
        found = shutil.which(candidate)
        if found:
            return found
    return None


def strip_xml_decl(markup):
    if markup.lstrip().startswith("<?xml"):
        return markup.split("?>", 1)[1]
    return markup


def render_chrome(chrome, svg, out, size, scale, bg):
    markup = strip_xml_decl(open(svg).read())
    background = bg or "transparent"
    html = (
        '<!doctype html><meta charset="utf-8"><style>'
        f"html,body{{margin:0;padding:0;width:{size}px;height:{size}px;"
        f"overflow:hidden;background:{background}}}"
        f"svg{{display:block;width:{size}px;height:{size}px}}"
        f"</style>{markup}"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as fh:
        fh.write(html)
        page = fh.name

    cmd = [
        chrome,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--force-device-scale-factor={scale}",
        f"--window-size={size},{size}",
        f"--screenshot={out}",
    ]
    if not bg:
        cmd.append("--default-background-color=00000000")
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.append("--no-sandbox")
    cmd.append(page)

    try:
        subprocess.run(cmd, capture_output=True, timeout=120)
    finally:
        os.unlink(page)
    return os.path.exists(out)


def render_rsvg(tool, svg, out, size, scale, bg):
    px = size * scale
    cmd = [tool, "-w", str(px), "-h", str(px)]
    if bg:
        cmd += ["-b", bg]
    cmd += [svg, "-o", out]
    subprocess.run(cmd, capture_output=True, timeout=120)
    return os.path.exists(out)


def render_magick(tool, svg, out, size, scale, bg):
    px = size * scale
    cmd = [tool] if tool.endswith("magick") else [tool]
    cmd += ["-background", bg or "none", svg, "-resize", f"{px}x{px}", out]
    subprocess.run(cmd, capture_output=True, timeout=120)
    return os.path.exists(out)


def render_cairosvg(svg, out, size, scale, bg):
    import cairosvg

    px = size * scale
    cairosvg.svg2png(url=svg, write_to=out, output_width=px, output_height=px,
                     background_color=bg)
    return os.path.exists(out)


def png_info(path):
    with open(path, "rb") as fh:
        header = fh.read(26)
    if header[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    width, height = struct.unpack(">II", header[16:24])
    has_alpha = header[25] in (4, 6)
    return width, height, has_alpha


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("svg")
    ap.add_argument("out")
    ap.add_argument("--size", type=int, required=True, help="logical size in px (square)")
    ap.add_argument("--scale", type=int, default=1, help="multiplier, for zoomed review renders")
    ap.add_argument("--bg", default=None, help="CSS colour; omit for a transparent background")
    args = ap.parse_args()

    out = os.path.abspath(args.out)
    svg = os.path.abspath(args.svg)
    ok = False

    chrome = find_chrome()
    if chrome:
        ok = render_chrome(chrome, svg, out, args.size, args.scale, args.bg)
        backend = "chrome"
    if not ok:
        for name, fn in (("rsvg-convert", render_rsvg), ("magick", render_magick),
                         ("convert", render_magick)):
            tool = shutil.which(name)
            if tool:
                ok = fn(tool, svg, out, args.size, args.scale, args.bg)
                backend = name
                if ok:
                    break
    if not ok:
        try:
            ok = render_cairosvg(svg, out, args.size, args.scale, args.bg)
            backend = "cairosvg"
        except ImportError:
            pass

    if not ok:
        sys.exit(
            "No SVG rasterizer found. Install one of: Google Chrome/Chromium, "
            "librsvg (rsvg-convert), ImageMagick, or `pip install cairosvg`. "
            "The SVG itself is still valid and can be handed over as-is."
        )

    info = png_info(out)
    if info:
        w, h, alpha = info
        print(f"{out}  {w}x{h}  alpha={'yes' if alpha else 'no'}  via {backend}")
    else:
        print(f"{out}  (written via {backend}, not a readable PNG header)")


if __name__ == "__main__":
    main()
