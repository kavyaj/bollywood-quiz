#!/usr/bin/env python3
"""BollyQuiz site tool. Plain Python 3, no installs. Run from anywhere:

    python tools/site.py sync    rewrite the site footer on every page, and the board help lists, from the files below
    python tools/site.py check   verify the site, exit 1 if anything is wrong (run it before every commit)

WHY: the footer is repeated on every page as plain HTML, so search engines see its links without running JavaScript.
This tool generates every copy from one source, so a change is one edit and the pages can't drift apart.

  tools/site-pages.json    the pages and which footer section each belongs to (quiz, page or home)
  tools/site-footer.json   the footer's words, the tip jar link and the Product Hunt badge
  tools/site_footer.py     turns those into the footer HTML (dark or light theme)
  assets/footer.css        its styles

A page opts in with a marker comment where the footer goes, and loads /assets/footer.css:
    <!-- site-footer:start theme=light -->     (theme=dark for the dark pages; credit=minibinder adds that credit line)
    <!-- site-footer:end -->
The quiz boards have no footer. Their Host keys help card holds a folded list of the pages (marked "Footer page list") and
two copyright lines instead.

NEW PAGE:  1. add it to tools/site-pages.json (group "page")   2. add it to sitemap.xml
           3. put the footer marker comments in the page and link /assets/footer.css   4. python tools/site.py sync
           5. python tools/site.py check

WHAT check LOOKS AT
  - every footer and board help list matches the source files, with aria-current on the page itself
  - every listed page exists and is in sitemap.xml
  - every public page (indexable, with a canonical link) is in sitemap.xml and in site-pages.json (except /terms/, which every
    footer links to), and every public page except the quiz boards has the footer and its stylesheet
  - every quiz board also has the copyright line with the Terms link
  - every quiz page (/quiz-N/) has valid data (3 boards of 5 x 5, a blurb on each category, hidden images that exist),
    its own settings (appId and storageKey not shared with another quiz) and the shared scripts in the right order
"""
import io, json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import site_footer

ROOT = Path(__file__).resolve().parent.parent
PAGES_FILE = ROOT / "tools" / "site-pages.json"
SITE = "https://bollyquiz.com"
COMMENT = "<!-- Footer page list: generated from tools/site-pages.json. Edit that file, then run: python tools/site.py sync -->"
# Pages linked from every footer's terms paragraph instead of from the page list
NOT_IN_LIST = {"/terms/"}
NOTICE_LINK = 'href="/terms/"'
FOOTER_RE = re.compile(r"<!-- site-footer:start([^>]*?)-->\n(.*?)<!-- site-footer:end -->", re.S)
FOOTER_NOTE = "<!-- Footer: generated from tools/site-footer.json and tools/site-pages.json by tools/site.py. Edit those, then run: python tools/site.py sync -->"
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


def footer_attrs(marker):
    return dict(re.findall(r"(\w+)=(\w+)", marker))


def render_footer(marker, path):
    a = footer_attrs(marker)
    html = site_footer.render(a.get("theme", "light"), url_of(path), pages(), credit=a.get("credit"))
    return "<!-- site-footer:start%s-->\n%s\n%s\n<!-- site-footer:end -->" % (marker, FOOTER_NOTE, html)


def synced(text, path):
    text = LIST_RE.sub(lambda m: render_list(m.group(1), url_of(path)), text)
    return FOOTER_RE.sub(lambda m: render_footer(m.group(1), path), text)


def sync():
    changed = 0
    for f in html_files():
        s = read(f)
        if not (LIST_RE.search(s) or FOOTER_RE.search(s)):
            continue
        n = synced(s, f)
        if n != s:
            write(f, n)
            changed += 1
            print("updated", f.relative_to(ROOT).as_posix())
    print("footers and lists in sync (%d page%s changed)" % (changed, "" if changed == 1 else "s"))


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
    needs_tip = not re.search(r"tipPopup:\s*false", s)     # the tip jar pop-up is on for every quiz unless it opts out
    wanted = ['/assets/board-intro.js"', '/assets/board/board-ui.js"'] + (['/assets/board/tip-popup.js"'] if needs_tip else []) + ['/assets/board/board.js"']
    order = [s.find(t) for t in wanted]
    if -1 in order or order != sorted(order):
        errors.append("%s: scripts must load in this order: board-intro.js, board-ui.js%s, board.js" % (name, ", tip-popup.js" if needs_tip else ""))
    for b in boards:                                          # each board's hidden photo or reveal card must exist
        img = b.get("hiddenImage")
        if img and not (path.parent / img).exists():
            errors.append("%s: board %s hiddenImage %s doesn't exist" % (name, b.get("id"), img))
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
        try:
            stale = (LIST_RE.search(s) or FOOTER_RE.search(s)) and synced(s, f) != s
        except (ValueError, KeyError) as e:       # a bad theme or credit name in the marker comment
            errors.append("%s: can't build the footer (%s)" % (f.relative_to(ROOT).as_posix(), e))
            stale = False
        if stale:
            errors.append("%s: footer is out of date. Run: python tools/site.py sync" % f.relative_to(ROOT).as_posix())
        m = FOOTER_RE.search(s)
        if m:
            theme = footer_attrs(m.group(1)).get("theme")
            if theme not in site_footer.THEMES:
                errors.append("%s: footer marker needs theme=dark or theme=light" % f.relative_to(ROOT).as_posix())
            if '/assets/footer.css' not in s:
                errors.append("%s: link /assets/footer.css (the footer's styles)" % f.relative_to(ROOT).as_posix())
            if s.count("<footer") != 1:
                errors.append("%s: expected only the generated <footer>, found %d" % (f.relative_to(ROOT).as_posix(), s.count("<footer")))

    for p in listed:
        if not file_of(p["href"]).exists():
            errors.append("site-pages.json: %s has no page file" % p["href"])
        if "<loc>%s%s</loc>" % (SITE, p["href"]) not in sitemap:
            errors.append("sitemap.xml: %s is missing" % p["href"])

    hrefs = {p["href"] for p in listed}
    for f in html_files():
        s = read(f)
        public = "rel=\"canonical\"" in s and 'content="noindex' not in s and f.name == "index.html"
        if public and url_of(f) not in hrefs and url_of(f) not in NOT_IN_LIST:
            errors.append("%s is a public page but isn't in tools/site-pages.json" % url_of(f))
        if public and "<loc>%s%s</loc>" % (SITE, url_of(f)) not in sitemap:
            errors.append("sitemap.xml: %s is missing" % url_of(f))
        is_quiz = re.fullmatch(r"quiz-\d+/index\.html", f.relative_to(ROOT).as_posix())
        if public and not is_quiz and not FOOTER_RE.search(s):
            errors.append("%s is a public page without the site footer (add the site-footer marker comments)" % url_of(f))
        if (LIST_RE.search(s) or is_quiz) and NOTICE_LINK not in s:
            errors.append("%s: the help card needs the copyright line with the Terms link (see NOTICE_LINK in tools/site.py)" % f.relative_to(ROOT).as_posix())

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
