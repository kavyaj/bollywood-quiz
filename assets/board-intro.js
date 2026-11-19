/* Board intro: the pop-up that explains a board's categories the first time that board opens.
   Shared by every quiz board (/quiz-1/, /quiz-2/, ...). Styles: /assets/board-intro.css.

   HOW IT WORKS
   - The pop-up is built from the quiz's own data, so a new quiz only supplies text. No pop-up code to copy.
   - It shows once per board per game. "Seen" boards are remembered in localStorage and cleared by New game.
   - A board that already has lifted tiles is treated as seen, so players with a game in progress aren't interrupted.
   - While it is open it owns the keyboard: Enter, Space or Esc closes it, other keys do nothing,
     so a stray Space can't open a square behind it.
   - Anyone can bring it back with the "Categories" link in the board header, or the C key.

   SET UP A NEW QUIZ BOARD (copying an existing quiz page already includes all the wiring)
   1. In the page <head>:      <link rel="stylesheet" href="/assets/board-intro.css">
      Before the engine script: <script src="/assets/board-intro.js"></script>
   2. In the QUIZ data, give every category a short plain-language line:
        { "id": "c1", "title": "Bare Minimum", "instruction": "Guess the film", "blurb": "A minimalist poster. Guess the film.", ... }
      (No "blurb"? The category's "instruction" is used instead.)
   3. Optional, in QUIZ.meta (or on a single board, to override):
        "intro": { "sub": "Five categories, 10 to 50 points each.",     // line under the title
                   "rule": "Every square: act it out. No talking.",    // a rule that applies to the whole quiz
                   "title": "What's on this board", "button": "Let's play" }
      No "sub"? One is made from the category and points count.
   4. In the engine script (three one-liners):
        BoardIntro.init({ quiz: QUIZ, storageKey: STORAGE_KEY + ":intro-seen",
                          getBoardId: () => state.activeBoard,
                          isBoardView: () => state.view === "board" && !state.help && !confirmOpen,
                          hasProgress: id => state.answered[id].size > 0 });   // before the first renderBoard()
        BoardIntro.boardShown();   // at the end of renderBoard()
        BoardIntro.reset();        // at the start of startNewGame()
      and in the header: <button type="button" class="key-hint cats-link" data-board-intro-open>Categories</button>
   5. Add the quiz to the footer list on every page and to sitemap.xml, as for any new page. */
(function () {
  "use strict";

  var cfg = null, root = null, pop = null;
  var seen = {};            // board id -> true
  var openId = null;        // board shown right now, or null
  var swallow = null;       // key code held down from closing the pop-up; ignored until it is released
  var lastFocus = null;
  var WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function load() { try { return JSON.parse(localStorage.getItem(cfg.storageKey)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(cfg.storageKey, JSON.stringify(seen)); } catch (e) { /* private mode: remembered for this visit only */ } }
  function q(sel) { return root.querySelector(sel); }

  /* What to show for a board, read from the quiz data. Returns null if the board has no categories. */
  function content(id) {
    var quiz = cfg.quiz, meta = quiz.meta || {};
    var idx = -1;
    var board = (quiz.boards || []).filter(function (b, i) { if (b.id === id) { idx = i; return true; } return false; })[0];
    if (!board || !board.columns || !board.columns.length) return null;
    var intro = Object.assign({}, meta.intro, board.intro);        // a board's own intro beats the quiz-wide one
    var pts = [];
    board.columns.forEach(function (c) { (c.cells || []).forEach(function (cell) { if (typeof cell.points === "number") pts.push(cell.points); }); });
    var n = board.columns.length;
    var sub = intro.sub;
    if (!sub) {
      sub = (WORDS[n] || n) + " categor" + (n === 1 ? "y" : "ies");
      if (pts.length) sub += ", " + Math.min.apply(null, pts) + " to " + Math.max.apply(null, pts) + " points each";
      sub += ".";
    }
    return {
      kicker: (meta.title ? meta.title + " · " : "") + "Board " + (idx + 1),
      title: intro.title || "What's on this board",
      sub: sub,
      rule: intro.rule || "",
      button: intro.button || "Let’s play",
      rows: board.columns.map(function (c) {
        if (!c.blurb && !c.instruction && window.console) console.warn("BoardIntro: category \"" + c.title + "\" has no blurb or instruction.");
        return { name: c.title, text: c.blurb || c.instruction || "" };
      })
    };
  }

  /* The chasing bulbs around the frame: same spacing and animation as the homepage hero. */
  function placeBulbs() {
    var host = q(".bq-intro__bulbs");
    if (!host || root.hidden) return;
    layoutBulbs(host, pop);
  }

  /* Lays the bulbs round any pop-up frame (.bq-intro__pop). Also used by the tip pop-up in /assets/board/board-ui.js. */
  function layoutBulbs(host, pop) {
    host.innerHTML = "";
    var u = Math.max(10.5, Math.min(innerWidth * 0.01, innerHeight * 0.018));   // same scale unit as the CSS (--u)
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var inset = parseFloat(getComputedStyle(pop).paddingTop) / 2;
    var gap = Math.max(18, u * 2.2);
    var iw = w - inset * 2, ih = h - inset * 2, per = 2 * (iw + ih), n = Math.round(per / gap), step = per / n;
    var html = "";
    for (var i = 0; i < n; i++) {
      var d = i * step, x, y;
      if (d < iw) { x = d; y = 0; }
      else if (d < iw + ih) { x = iw; y = d - iw; }
      else if (d < 2 * iw + ih) { x = iw - (d - iw - ih); y = ih; }
      else { x = 0; y = ih - (d - 2 * iw - ih); }
      html += '<span class="bq-intro__bulb b' + (i % 3) + '" style="left:' + (x + inset) + 'px;top:' + (y + inset) + 'px"></span>';
    }
    host.innerHTML = html;
  }

  function show(id) {
    var c = content(id);
    if (!c) return false;
    q(".bq-intro__kicker").textContent = c.kicker;
    q(".bq-intro__title").textContent = c.title;
    q(".bq-intro__sub").textContent = c.sub;
    q(".bq-intro__rows").innerHTML = c.rows.map(function (r) {
      return '<div class="bq-intro__row"><span class="bq-intro__cat">' + esc(r.name) + '</span><span class="bq-intro__text">' + esc(r.text) + '</span></div>';
    }).join("");
    var rule = q(".bq-intro__rule");
    rule.hidden = !c.rule; rule.textContent = c.rule;
    q(".bq-intro__go").textContent = c.button;
    openId = id;
    lastFocus = document.activeElement;
    root.hidden = false;
    placeBulbs();
    q(".bq-intro__go").focus({ preventScroll: true });
    return true;
  }

  function dismiss() {
    if (openId === null) return;
    seen[openId] = true; save();
    openId = null;
    root.hidden = true;
    if (lastFocus && lastFocus.blur) lastFocus.blur();   // keep focus off the board, so Space/Enter keep driving it
  }

  var api = {
    layoutBulbs: layoutBulbs,

    /* Call once, before the first renderBoard(). See the set-up notes at the top of this file. */
    init: function (options) {
      cfg = options;
      seen = load();
      root = document.createElement("div");
      root.className = "bq-intro"; root.hidden = true;
      root.innerHTML =
        '<div class="bq-intro__pop" role="dialog" aria-modal="true" aria-labelledby="bq-intro-title">' +
          '<div class="bq-intro__bulbs" aria-hidden="true"></div>' +
          '<div class="bq-intro__card">' +
            '<span class="bq-intro__kicker"></span>' +
            '<h2 class="bq-intro__title" id="bq-intro-title"></h2>' +
            '<p class="bq-intro__sub"></p>' +
            '<div class="bq-intro__rows"></div>' +
            '<p class="bq-intro__rule" hidden></p>' +
            '<div class="bq-intro__act"><button type="button" class="bq-intro__go"></button>' +
            '<span class="bq-intro__hint"><kbd>Enter</kbd> to start. Shown once per board. <kbd>C</kbd> brings it back.</span></div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(root);
      pop = q(".bq-intro__pop");

      q(".bq-intro__go").addEventListener("click", dismiss);

      // The "Categories" link: mouse-down must not steal focus from the board.
      document.addEventListener("mousedown", function (e) { if (e.target.closest && e.target.closest("[data-board-intro-open]")) e.preventDefault(); });
      document.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest("[data-board-intro-open]")) api.open();
      });

      // Runs before the board's own key handler (capture phase), so the pop-up can own the keyboard.
      window.addEventListener("keydown", function (e) {
        if (openId !== null) {
          var plain = !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey;
          if (plain && (e.key === "Enter" || e.key === " " || e.key === "Escape")) {
            if (!e.repeat) { swallow = e.code; dismiss(); }
          }
          // Swallow everything the board would react to. Leave function keys and browser shortcuts alone.
          if (!e.altKey && !e.metaKey && (e.key.length === 1 || /^(Enter|Tab|Escape|Backspace|Arrow\w+)$/.test(e.key))) {
            if (!e.ctrlKey) e.preventDefault();
            e.stopImmediatePropagation();
          }
          return;
        }
        if (swallow && e.code === swallow) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // still held from closing it
        if ((e.key === "c" || e.key === "C") && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && cfg.isBoardView()) {
          e.preventDefault();
          if (!e.repeat) api.open();
        }
      }, true);
      window.addEventListener("keyup", function (e) {
        if (swallow && e.code === swallow) { swallow = null; e.stopImmediatePropagation(); }
      }, true);

      window.addEventListener("resize", placeBulbs);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeBulbs);
    },

    /* Call at the end of every renderBoard(): shows the pop-up the first time a board is on screen. */
    boardShown: function () {
      if (!cfg || openId !== null || !cfg.isBoardView()) return;
      var id = cfg.getBoardId();
      if (seen[id]) return;
      if (cfg.hasProgress && cfg.hasProgress(id)) { seen[id] = true; save(); return; }   // game already under way
      show(id);
    },

    /* Open it for the board on screen, whether or not it has been seen (the Categories link and the C key). */
    open: function () {
      if (!cfg || openId !== null || !cfg.isBoardView()) return;
      show(cfg.getBoardId());
    },

    /* Call at the start of New game: every board counts as unseen again. */
    reset: function () {
      seen = {}; save();
      if (openId !== null) { openId = null; root.hidden = true; }
    }
  };

  window.BoardIntro = api;
})();
