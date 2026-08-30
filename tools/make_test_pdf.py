#!/usr/bin/env python3
"""Writes the sample PDFs the PDF reader is tested against.

Nothing here is a real engraving -- it is the *shape* of one: a page whose
staff lines are vector rectangles and whose noteheads are filled curves, sitting
at coordinates a reader has to recover through the current transform. That is
what tools/pdf_probe.js and check_pdfread.js measure themselves against while
we have no real files to try.

Six files, because the reader has to tell them apart:

    sample-engraved.pdf   vectors and text, Flate-compressed streams
    sample-plain.pdf      the same page with no compression at all
    sample-scan.pdf       one image covering the page -- a scan, nothing to read
    sample-ascii85.pdf    the engraved page through ASCII85 + Flate with a PNG
                          predictor in the second /DecodeParms slot, which is
                          what Ghostscript emits and what catches a reader that
                          reads parameters by name instead of by position
    sample-stamped.pdf    a scan with a vector watermark stamped over it, in two
                          content parts filtered differently -- a page that must
                          still be called a scan and not an engraving
    sample-locked.pdf     /Encrypt, so the reader has to say "protected" instead
                          of tripping over bytes that are not deflate

Written by hand rather than with a library, for the same reason the app unpacks
a .mxl by hand: this repository vendors what it needs and installs nothing.

    python3 tools/make_test_pdf.py [outdir]     # default: tools/samples
"""

import os
import sys
import zlib

# A5-ish page, in points.
W, H = 420, 300

# Three systems down the page, so a reader has to separate them. Five lines
# each, 8 pt apart, counted from the top line of the system.
STAFF_X0, STAFF_X1 = 40, 380
STAFF_TOPS = [250, 170, 90]
STEP = 8


def staff_lines():
    """Rectangles 0.8 pt thick -- how engravers actually emit staff lines."""
    out = []
    for top in STAFF_TOPS:
        for i in range(5):
            y = top - i * STEP
            out.append("%.2f %.2f %.2f %.2f re f" % (STAFF_X0, y, STAFF_X1 - STAFF_X0, 0.8))
    return out


def notehead(x, y):
    """A filled ellipse, tilted the way a notehead is, drawn as four curves."""
    rx, ry = 5.0, 3.6
    k = 0.5523
    return (
        "q 1 0 0.30 1 %.2f %.2f cm "
        "0 %.2f m "
        "%.2f %.2f %.2f %.2f %.2f 0 c "
        "%.2f %.2f %.2f %.2f 0 %.2f c "
        "%.2f %.2f %.2f %.2f %.2f 0 c "
        "%.2f %.2f %.2f %.2f 0 %.2f c "
        "f Q"
    ) % (
        x, y,
        ry,
        rx * k, ry, rx, ry * k, rx,
        rx, -ry * k, rx * k, -ry, -ry,
        -rx * k, -ry, -rx, -ry * k, -rx,
        -rx, ry * k, -rx * k, ry, ry,
    )


def stem(x, y):
    return "%.2f %.2f %.2f %.2f re f" % (x + 4.6, y, 0.9, 26)


# Eight notes per system, half a step apart, walking up from the bottom line --
# the same shape as a scale, which is what makes a misread obvious.
NOTES = []
for _top in STAFF_TOPS:
    for _i in range(8):
        NOTES.append((70 + _i * 40, _top - 4 * STEP + _i * (STEP / 2.0)))


def page_content():
    parts = ["0 g"]
    parts += staff_lines()
    for x, y in NOTES:
        parts.append(notehead(x, y))
        parts.append(stem(x, y))
    # barlines at both ends of every system, and a title in a real (non-music) font
    for top in STAFF_TOPS:
        for x in (STAFF_X0, STAFF_X1 - 1.2):
            parts.append("%.2f %.2f %.2f %.2f re f" % (x, top - 4 * STEP, 1.2, 4 * STEP + 0.8))
    parts.append("BT /F1 13 Tf 40 280 Td (Sample) Tj ET")
    parts.append("BT /F1 9 Tf 1 0 0 1 40 268 Tm [(spa) -120 (ced)] TJ ET")
    return "\n".join(parts).encode("latin-1")


def image_content():
    return b"q 420 0 0 300 0 0 cm /Im0 Do Q"


def gray_image(w, h):
    """A tiny grey gradient, Flate-compressed, one byte per pixel."""
    raw = bytearray()
    for y in range(h):
        for x in range(w):
            raw.append((x * 255) // max(1, w - 1))
    return zlib.compress(bytes(raw), 6)


def build(objects, root_num):
    """Serialise numbered objects into a PDF with a classic xref table."""
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = {}
    for num in sorted(objects):
        offsets[num] = len(out)
        out += ("%d 0 obj\n" % num).encode("latin-1")
        out += objects[num]
        out += b"\nendobj\n"

    start = len(out)
    top = max(objects) + 1
    out += ("xref\n0 %d\n" % top).encode("latin-1")
    out += b"0000000000 65535 f \n"
    for num in range(1, top):
        out += ("%010d 00000 n \n" % offsets.get(num, 0)).encode("latin-1")
    out += ("trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n"
            % (top, root_num, start)).encode("latin-1")
    return bytes(out)


def stream_obj(dict_body, data, compress):
    if compress:
        data = zlib.compress(data, 6)
        dict_body = dict_body + " /Filter /FlateDecode"
    head = ("<< %s /Length %d >>\nstream\n" % (dict_body, len(data))).encode("latin-1")
    return head + data + b"\nendstream"


def engraved(compress):
    content = page_content()
    return build({
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: ("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
            "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
            % (W, H)).encode("latin-1"),
        4: stream_obj("", content, compress),
        5: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }, 1)


def scan():
    w, h = 210, 150
    return build({
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: ("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
            "/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>"
            % (W, H)).encode("latin-1"),
        4: stream_obj("", image_content(), True),
        5: (b"<< /Type /XObject /Subtype /Image /Width %d /Height %d "
            b"/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length %d >>"
            b"\nstream\n" % (w, h, len(gray_image(w, h)))) + gray_image(w, h) + b"\nendstream",
    }, 1)


# ---------- the awkward encodings ----------

def png_up(data, columns):
    """PNG predictor 12: every row carries tag 2 and the difference from above.

    Only object and cross-reference streams normally use this, but it rides in
    /DecodeParms next to a filter, and getting the slot wrong is invisible until
    a file arrives with more than one filter -- which is the point of the sample
    that uses it."""
    data = data + b"\x00" * ((-len(data)) % columns)
    out = bytearray()
    prev = bytes(columns)
    for i in range(0, len(data), columns):
        row = data[i:i + columns]
        out.append(2)
        out += bytes((row[j] - prev[j]) & 0xff for j in range(columns))
        prev = row
    return bytes(out)


def a85(data):
    out = bytearray()
    for i in range(0, len(data), 4):
        chunk = data[i:i + 4]
        pad = 4 - len(chunk)
        chunk = chunk + b"\x00" * pad
        n = int.from_bytes(chunk, "big")
        if n == 0 and pad == 0:
            out += b"z"
            continue
        group = bytearray()
        for _ in range(5):
            group.append(n % 85 + 33)
            n //= 85
        group.reverse()
        out += group[:5 - pad]
    return bytes(out) + b"~>"


def ahx(data):
    return data.hex().encode("ascii") + b">"


def rle(data):
    """Run-length as PDF spells it: literal runs, then repeats, then 128."""
    out = bytearray()
    i = 0
    while i < len(data):
        run = 1
        while i + run < len(data) and data[i + run] == data[i] and run < 127:
            run += 1
        if run > 2:
            out.append(257 - run)
            out.append(data[i])
            i += run
        else:
            start = i
            while i < len(data) and (i + 2 >= len(data) or not (data[i] == data[i+1] == data[i+2])) and i - start < 127:
                i += 1
            chunk = data[start:i]
            out.append(len(chunk) - 1)
            out += chunk
    out.append(128)
    return bytes(out)


def ascii85_page():
    """The engraved page, encoded the way Ghostscript would leave it."""
    columns = 4
    body = a85(zlib.compress(png_up(page_content(), columns), 6))
    head = ("<< /Filter [ /ASCII85Decode /FlateDecode ] "
            "/DecodeParms [ null << /Predictor 12 /Columns %d >> ] /Length %d >>\nstream\n"
            % (columns, len(body))).encode("latin-1")
    content = head + body + b"\nendstream"
    return build({
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: ("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
            "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
            % (W, H)).encode("latin-1"),
        4: content,
        5: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }, 1)


# A library stamp: enough vector marks that counting them first would call this
# page an engraving.
def watermark():
    parts = ["0.6 g"]
    for row in range(8):
        for col in range(8):
            parts.append("%.2f %.2f 6 6 re f" % (30 + col * 20, 30 + row * 12))
    return "\n".join(parts).encode("latin-1")


def stamped():
    """A scan with something drawn over it, in two content parts.

    The parts also carry different filters, which is the cheapest way to prove
    that a chain is decoded per part and that the parts are joined with the
    separator the spec asks for rather than glued token to token."""
    w, h = 210, 150
    img = gray_image(w, h)
    part_a = ahx(image_content())
    part_b = rle(watermark())
    return build({
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: ("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
            "/Resources << /XObject << /Im0 5 0 R >> >> /Contents [ 4 0 R 6 0 R ] >>"
            % (W, H)).encode("latin-1"),
        4: ("<< /Filter /ASCIIHexDecode /Length %d >>\nstream\n" % len(part_a)).encode("latin-1")
           + part_a + b"\nendstream",
        5: (b"<< /Type /XObject /Subtype /Image /Width %d /Height %d "
            b"/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length %d >>"
            b"\nstream\n" % (w, h, len(img))) + img + b"\nendstream",
        6: ("<< /Filter /RunLengthDecode /Length %d >>\nstream\n" % len(part_b)).encode("latin-1")
           + part_b + b"\nendstream",
    }, 1)


def locked():
    """A file that says it is encrypted, with a stream that is not readable.

    Nothing here is really encrypted -- the bytes are simply not deflate, which
    is exactly what an encrypted stream looks like to a reader that missed the
    /Encrypt entry. That is the mistake being tested for: the structure parses,
    and the failure surfaces far away from its cause."""
    junk = bytes((i * 37 + 11) & 0xff for i in range(120))
    body = build({
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: ("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Contents 4 0 R >>"
            % (W, H)).encode("latin-1"),
        4: ("<< /Filter /FlateDecode /Length %d >>\nstream\n" % len(junk)).encode("latin-1")
           + junk + b"\nendstream",
        6: (b"<< /Filter /Standard /V 2 /R 3 /Length 128 /P -44 /O <"
            + b"41" * 32 + b"> /U <" + b"42" * 32 + b"> >>"),
    }, 1)
    return body.replace(b"/Root 1 0 R >>", b"/Root 1 0 R /Encrypt 6 0 R "
                        b"/ID [ <0102030405060708090a0b0c0d0e0f10> <0102030405060708090a0b0c0d0e0f10> ] >>")


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "samples")
    os.makedirs(outdir, exist_ok=True)
    files = {
        "sample-engraved.pdf": engraved(True),
        "sample-plain.pdf": engraved(False),
        "sample-scan.pdf": scan(),
        "sample-ascii85.pdf": ascii85_page(),
        "sample-stamped.pdf": stamped(),
        "sample-locked.pdf": locked(),
    }
    for name, data in files.items():
        path = os.path.join(outdir, name)
        with open(path, "wb") as fh:
            fh.write(data)
        print("%-22s %6d bytes" % (name, len(data)))
    print("staves: top lines at %s, step %d, %d noteheads"
          % (", ".join(str(t) for t in STAFF_TOPS), STEP, len(NOTES)))


main()
