"""Renders the site footer as plain HTML. Used by tools/site.py; nothing here touches files.

The footer is one component with two themes (dark and light, set by the page's marker comment). Its words come from
tools/site-footer.json and its links from tools/site-pages.json (each entry's "group" says which section it belongs to).
Styles: /assets/footer.css.
"""
import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
THEMES = ("dark", "light")


def load_config():
    return json.loads((HERE / "site-footer.json").read_text(encoding="utf-8"))


def esc(s):
    return html.escape(str(s), quote=True)


# A small tip jar with coins. Colours come from the theme through CSS (see footer.css).
JAR_SVG = (
    '<svg class="sf-jar" viewBox="0 0 96 110" aria-hidden="true" focusable="false">'
    '<ellipse cx="48" cy="105" rx="30" ry="4" fill="currentColor" opacity=".12"/>'
    '<path class="jar-glass" d="M30 24h36v8c0 4 4 6 8 9 6 5 8 12 8 22v28c0 9-6 15-15 15H29c-9 0-15-6-15-15V63c0-10 2-17 8-22 4-3 8-5 8-9z"/>'
    '<rect class="jar-lid" x="28" y="14" width="40" height="9" rx="4"/>'
    '<ellipse class="coin" cx="36" cy="94" rx="14" ry="5"/><ellipse class="coin" cx="58" cy="92" rx="14" ry="5"/>'
    '<ellipse class="coin" cx="46" cy="87" rx="14" ry="5"/>'
    '<circle class="coin" cx="48" cy="40" r="15"/><text class="coin-mark" x="48" y="45" text-anchor="middle">₹</text>'
    '</svg>'
)


def slug(url):
    return "home" if url == "/" else url.strip("/").replace("/", "-")


def link_item(entry, current):
    cur = ' aria-current="page"' if entry["href"] == current else ""
    tag = '<span class="sf-tag">%s</span>' % esc(entry["tag"]) if entry.get("tag") else ""
    return '<li><a href="%s"%s>%s%s</a></li>' % (esc(entry["href"]), cur, tag, esc(entry["label"]))


def render(theme, url, pages, credit=None, config=None):
    """The footer for the page at `url`, in `theme` ("dark" or "light"). `credit` names an extra line from the config."""
    if theme not in THEMES:
        raise ValueError("footer theme must be one of %s, not %r" % (", ".join(THEMES), theme))
    cfg = config or load_config()
    quizzes = [p for p in pages if p.get("group") == "quiz"]
    others = [p for p in pages if p.get("group") == "page"]
    legal, sup, ph = cfg["legal"], cfg["support"], cfg["support"].get("producthunt")

    out = []
    add = out.append
    add('<footer class="site-footer site-footer--%s">' % theme)
    add('  <div class="sf-inner">')
    add('    <a class="sf-brand" href="/"><img src="/assets/logo.svg" alt="BollyQuiz" width="680" height="142" loading="lazy"></a>')
    add('    <div class="sf-grid">')

    for key, items in (("quizzes", quizzes), ("pages", others)):
        add('      <nav class="sf-col" aria-labelledby="sf-h-%s">' % key)
        add('        <h2 class="sf-h" id="sf-h-%s">%s</h2>' % (key, esc(cfg[key]["title"])))
        add('        <ul class="sf-list">')
        for entry in items:
            add("          " + link_item(entry, url))
        add("        </ul>")
        add("      </nav>")

    add('      <div class="sf-col sf-legal">')
    add('        <h2 class="sf-h" id="sf-h-legal">%s</h2>' % esc(legal["title"]))
    for para in legal["paragraphs"]:
        add("        <p>%s</p>" % para)          # trusted text from site-footer.json, links included
    if credit:
        add('        <p class="sf-credit">%s</p>' % legal["credits"][credit])
    add("      </div>")

    tip = "%s?ref=footer-%s" % (sup["url"], slug(url))
    add('      <aside class="sf-col sf-support" aria-labelledby="sf-h-support">')
    add('        <h2 class="sf-h" id="sf-h-support">%s</h2>' % esc(sup["title"]))
    add("        " + JAR_SVG)
    add("        <p>%s</p>" % esc(sup["text"]))
    add('        <a class="sf-tip" href="%s" target="_blank" rel="noopener" data-umami-event="tip-jar-click" data-umami-event-location="footer">%s</a>'
        % (esc(tip), esc(sup["button"])))
    if ph:
        add('        <a class="sf-ph" href="%s" target="_blank" rel="noopener noreferrer" data-umami-event="outbound-click" data-umami-event-target="producthunt">'
            '<img alt="%s" width="250" height="54" loading="lazy" src="%s"></a>' % (esc(ph["href"]), esc(ph["alt"]), esc(ph["image"])))
    add("      </aside>")

    add("    </div>")
    add("  </div>")
    add("</footer>")
    return "\n".join(out)
