#!/usr/bin/env python3
"""Makes the QR code shown in the quiz boards' tip pop-up (QR_SVG in assets/board/board-ui.js).

    pip install segno
    python tools/make-tip-qr.py                      # prints the SVG for https://ko-fi.com/kavyaj
    python tools/make-tip-qr.py https://ko-fi.com/x  # a different address

Paste the printed line over the QR_SVG string in assets/board/board-ui.js, and update the "ko-fi.com/kavyaj" text under the
QR in the same file. The QR is drawn in the page's own dark colour (currentColor) with a white tile and quiet zone from CSS.
"""
import sys

try:
    import segno
except ImportError:
    sys.exit("This needs the segno package: pip install segno")

url = sys.argv[1] if len(sys.argv) > 1 else "https://ko-fi.com/kavyaj"
qr = segno.make(url, error="q", micro=False)
n = qr.symbol_size(border=0)[0]
parts = []
for y, row in enumerate(qr.matrix):
    x = 0
    while x < n:
        if row[x]:
            start = x
            while x < n and row[x]:
                x += 1
            parts.append("M%d %dh%dv1h-%dz" % (start, y, x - start, x - start))
        else:
            x += 1
label = url.replace("https://", "").replace("http://", "")
print('<svg class="bq-tip__qrcode" viewBox="0 0 %d %d" shape-rendering="crispEdges" role="img" aria-label="QR code for %s"><path fill="currentColor" d="%s"/></svg>'
      % (n, n, label, "".join(parts)))
