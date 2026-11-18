#!/usr/bin/env python3
"""BollyQuiz site tool. Plain Python 3, no installs. Run from anywhere:

    python tools/site.py sync    rewrite the footer page list on every page from tools/site-pages.json
    python tools/site.py check   verify the site, exit 1 if anything is wrong (run it before every commit)

WHY: the footer list of pages is repeated on every page, as plain HTML so search engines see the links without
running JavaScript. This tool keeps all those copies identical from one list, so adding a page is one edit.

NEW PAGE:  1. add it to tools/site-pages.json   2. add it to sitemap.xml   3. python tools/site.py sync
           4. python tools/site.py check

WHAT check LOOKS AT
  - every footer list matches site-pages.json, with aria-current on the page itself
  - every listed page exists and is in sitemap.xml
  - every public page (indexable, with a canonical link) is in the footer list
  - every quiz page (/quiz-N/) has valid data (3 boards of 5 x 5, a blurb on each category), its own settings
    (appId and storageKey not shared with another quiz) and the shared scripts in the right order
"""
import io, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES_FILE = ROOT / "tools" / "site-pages.json"
SITE = "https://bollyquiz.com"
COMMENT = "<!-- Footer page list: generated from tools/site-pages.json. Edit that file, then run: python tools/site.py sync -->"
LIST_RE = re.compile(r"^([ \t]*)<!-- Footer page list[^\n]*-->\n[ \t]*<ul>\n.*?\n[ \t]*</ul>", re.S | re.M)

read = lambda p: io.open(p, encoding="utf-8", newline="").read()
write = lambda p, s: io.open(p, "w", encoding="utf-8", newline="").write(s)


def html_files():
    return sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts and "node_modules" not in p.parts and "tools" not in p.parts)


def url_of(path):
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return "/"
    return "/" + rel[: -len("index.html")] if rel.endswith("/index.html") else "/" + rel


def file_of(href):
    return ROOT / "index.html" if href == "/" else ROOT / href.strip("/") / "index.html"


def pages():
    return json.loads(read(PAGES_FILE))


def render_list(indent, current):
    inner = indent + "  "
    items = []
    for p in pages():
        cur = ' aria-current="page"' if p["href"] == current else ""
        items.append('%s<li><a href="%s"%s>%s</a></li>' % (inner, p["href"], cur, p["label"]))
    return "%s%s\n%s<ul>\n%s\n%s</ul>" % (indent, COMMENT, indent, "\n".join(items), indent)


def synced(text, path):
    return LIST_RE.sub(lambda m: render_list(m.group(1), url_of(path)), text)


def sync():
    changed = 0
    for f in html_files():
        s = read(f)
        if not LIST_RE.search(s):
            continue
        n = synced(s, f)
        if n != s:
            write(f, n)
            changed += 1
            print("updated", f.relative_to(ROOT).as_posix())
    print("footer lists in sync (%d page%s changed)" % (changed, "" if changed == 1 else "s"))


# ---------------------------------------------------------------------------- check
def check_quiz(path, errors):
    name = path.relative_to(ROOT).as_posix()
    s = read(path)
    m = re.search(r"const QUIZ = (\{.*?\n\});\n// ===== QUIZ DATA END", s, re.S)
    if not m:
        errors.append("%s: can't find the QUIZ data block" % name)
        return None
    try:
        quiz = json.loads(m.group(1))
    except ValueError as e:
        errors.append("%s: the QUIZ data isn't valid JSON (%s)" % (name, e))
        return None
    boards = quiz.get("boards", [])
    if len(boards) != 3:
        errors.append("%s: expected 3 boards, found %d" % (name, len(boards)))
    for b in boards:
        seen_ids = set()   # category ids only need to be unique within a board
        cols = b.get("columns", [])
        if len(cols) != 5:
            errors.append("%s: board %s has %d categories, expected 5" % (name, b.get("id"), len(cols)))
        for c in cols:
            if c["id"] in seen_ids:
                errors.append("%s: board %s uses category id %s twice" % (name, b.get("id"), c["id"]))
            seen_ids.add(c["id"])
            if not (c.get("blurb") or c.get("instruction")):
                errors.append('%s: category "%s" needs a "blurb" (shown in the first-open pop-up)' % (name, c.get("title")))
            cells = c.get("cells", [])
            if [x.get("points") for x in cells] != [10, 20, 30, 40, 50]:
                errors.append('%s: category "%s" should have cells worth 10, 20, 30, 40, 50' % (name, c.get("title")))
            for x in cells:
                if "prompt" not in x or "answer" not in x or "promptType" not in x:
                    errors.append('%s: a cell in "%s" is missing prompt, answer or promptType' % (name, c.get("title")))
    cfg = re.search(r'appId: "([^"]+)",\s*storageKey: "([^"]+)"', s)
    if not cfg:
        errors.append("%s: window.BOARD_CONFIG needs appId and storageKey" % name)
    order = [s.find(t) for t in ('/assets/board-intro.js"', '/assets/board/board-ui.js"', '/assets/board/board.js"')]
    if -1 in order or order != sorted(order):
        errors.append("%s: scripts must load in this order: board-intro.js, board-ui.js, board.js" % name)
    if any(t["promptType"] == "charade" for b in boards for c in b.get("columns", []) for t in c.get("cells", [])):
        if s.find("/assets/board/charades.js") == -1 or s.find("/assets/board/charades.js") > s.find("/assets/board/board.js"):
            errors.append("%s: charade squares need /assets/board/charades.js loaded before board.js" % name)
    return cfg.groups() if cfg else None


def check():
    errors = []
    listed = pages()
    sitemap = read(ROOT / "sitemap.xml")

    for f in html_files():
        s = read(f)
        if LIST_RE.search(s) and synced(s, f) != s:
            errors.append("%s: footer list is out of date. Run: python tools/site.py sync" % f.relative_to(ROOT).as_posix())

    for p in listed:
        if not file_of(p["href"]).exists():
            errors.append("site-pages.json: %s has no page file" % p["href"])
        if "<loc>%s%s</loc>" % (SITE, p["href"]) not in sitemap:
            errors.append("sitemap.xml: %s is missing" % p["href"])

    hrefs = {p["href"] for p in listed}
    for f in html_files():
        s = read(f)
        if "rel=\"canonical\"" in s and 'content="noindex' not in s and url_of(f) not in hrefs and f.name == "index.html":
            errors.append("%s is a public page but isn't in tools/site-pages.json" % url_of(f))

    quiz_cfgs = {}
    for f in html_files():
        if re.fullmatch(r"quiz-\d+/index\.html", f.relative_to(ROOT).as_posix()):
            c = check_quiz(f, errors)
            if c:
                quiz_cfgs[f.relative_to(ROOT).as_posix()] = c
    for idx in (0, 1):
        vals = [c[idx] for c in quiz_cfgs.values()]
        if len(vals) != len(set(vals)):
            errors.append("quiz pages share an %s; each quiz needs its own" % ("appId", "storageKey")[idx])

    if errors:
        print("%d problem%s:" % (len(errors), "" if len(errors) == 1 else "s"))
        for e in errors:
            print("  -", e)
        return 1
    print("site check passed: %d footer pages, %d quiz page%s" % (len(listed), len(quiz_cfgs), "" if len(quiz_cfgs) == 1 else "s"))
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "sync":
        sync()
    elif cmd == "check":
        sys.exit(check())
    else:
        print(__doc__)
        sys.exit(2)
