/* Quiz board screens: builds the header, the help screen, the new-game prompt, the toast and the end-of-quiz tip.
   Shared by every quiz page. board.js calls BoardUI.mount() once, before the engine starts. Styles: /assets/board/board.css.

   WHAT A QUIZ PAGE SUPPLIES (window.BOARD_CONFIG, plus QUIZ.meta.title and QUIZ.meta.subtitle for the heading)
     answersLink   { href: "answers/", label: "Title list" }   the header link to the host's answer page (optional)
     tipRef        "bollyquiz-my-quiz"      tags the end-of-quiz tip-jar link, so its clicks can be told apart
     resetNote     "clears the game"        finishes "This puts every tile back on all three boards and ..."
     help          { sections: [...], notes: [...] }          what is specific to this quiz's help screen:
                     sections: [{ title: "Question", keys: [["<kbd>Space</kbd>", "Next clue"], ...] }, ...]
                     notes:    ["<b>How a turn goes:</b> ...", ...]   paragraphs under the key lists (HTML)
   The Board section of the help screen is the same for every quiz and lives here.

   TIP POP-UP: when a board is finished (all 25 squares played, or lifted with Shift+Enter), a pop-up thanks the players and
   links to the tip jar (Ko-fi, tagged with tipRef). It shows about two seconds after the board's last square lifts. Once a
   player closes it, or taps Leave a tip, it stays away for 24 hours on every BollyQuiz page (the pause is kept in this
   browser, under "bollyquiz:tip-popup-dismissed"). It never shows on a page reload and is only built if the quiz has a
   tipRef. The engine drives it through BoardUI.tip (see board.js). It is framed like the category pop-up, so
   /assets/board-intro.css and board-intro.js must load.
   Beside the button it shows a QR code for the tip jar, so a room watching a TV can scan it. The QR is a fixed picture of
   https://ko-fi.com/kavyaj (QR_SVG below), made by tools/make-tip-qr.py. If that address ever changes, run the tool and
   paste its output over QR_SVG. The QR is hidden on phones, where the button does the job. */
(function () {
  "use strict";

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const HOME_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/></svg>';

  // The same for every quiz. [keys, what it does]
  const BOARD_KEYS = [
    ["<kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd>", "Move highlight"],
    ["<kbd>Enter</kbd> / <kbd>Space</kbd>", "Open square"],
    ["<kbd>U</kbd>", "Undo last lift"],
    ["<kbd>Ctrl</kbd>+<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>", "Switch board (plain <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> also works)"],
    ["<kbd>Shift</kbd>+<kbd>Enter</kbd>", "Lift all remaining tiles"],
    ["<kbd>S</kbd>", "Save a backup file to Downloads"],
    ["<kbd>L</kbd>", "Load a backup file"],
    ["<kbd>Shift</kbd>+<kbd>N</kbd>", "New game (asks first)"],
    ["<kbd>C</kbd>", "What's on this board (the categories)"],
    ["<kbd>H</kbd>", "Toggle this help"]
  ];

  const section = (title, keys) =>
    `<section>
        <h3 class="display">${esc(title)}</h3>
        <dl>
          ${keys.map(([k, d]) => `<dt>${k}</dt><dd>${d}</dd>`).join("\n          ")}
        </dl>
      </section>`;

  function header(cfg, quiz) {
    const meta = quiz.meta || {};
    const tabs = quiz.boards.map((b, i) =>
      `<button class="board-tab" role="tab" tabindex="-1" data-board="${b.id}"><span class="bt-label">Board ${i + 1}</span><span class="bt-bar"><i></i></span></button>`).join("\n        ");
    const hasIntro = !!window.BoardIntro;
    const answers = cfg.answersLink
      ? `<a class="key-hint answers-link" href="${esc(cfg.answersLink.href)}" target="_blank" rel="noopener" data-umami-event="answer-sheet-click" data-umami-event-location="board">${esc(cfg.answersLink.label)}</a>`
      : "";
    return `<header class="board-header">
    <div class="board-left">
      <a class="home-link" href="/" aria-label="BollyQuiz home" title="BollyQuiz home" data-umami-event="home-click" data-umami-event-location="board">${HOME_ICON}</a>
      <nav class="board-switch display" role="tablist" aria-label="Boards">
        ${tabs}
      </nav>
    </div>
    <div class="title-block">
      <div class="kicker display" id="kicker">${esc(meta.subtitle || "")}</div>
      <h1 class="display" id="title">${esc(meta.title || "")}</h1>
    </div>
    <div class="board-status">
      <span class="key-hint"><kbd>H</kbd> keys</span>
      ${hasIntro ? '<button type="button" class="key-hint cats-link" data-board-intro-open>Categories</button>' : ""}
      ${answers}
      <span class="readout display" id="readout">0 / 25 lifted</span>
    </div>
  </header>
  <div id="boards"></div>
  ${cfg.tipRef ? `<p class="end-tip" id="end-tip" hidden>Had fun? <a href="https://ko-fi.com/kavyaj?ref=${encodeURIComponent(cfg.tipRef)}" target="_blank" rel="noopener" data-umami-event="tip-jar-click" data-umami-event-location="endscreen">The tip jar keeps the next quiz coming.</a></p>` : '<p class="end-tip" id="end-tip" hidden></p>'}`;
  }

  function help(cfg) {
    const h = cfg.help || {};
    const sections = [["Board", BOARD_KEYS.filter(r => window.BoardIntro || r[0] !== "<kbd>C</kbd>")]]
      .concat((h.sections || []).map(s => [s.title, s.keys]));
    return `<h2 class="display">Host keys</h2>
    <div class="help-grid">
      ${sections.map(([t, k]) => section(t, k)).join("\n      ")}
    </div>
    ${(h.notes || []).map(n => `<p class="help-foot">${n}</p>`).join("\n    ")}`;
  }

  function mount(cfg, quiz) {
    const need = sel => {
      const el = document.querySelector(sel);
      if (!el) throw new Error("board-ui.js: the page needs an element matching " + sel + " (see the notes at the top of board-ui.js).");
      return el;
    };
    need("#board-view").innerHTML = header(cfg, quiz);
    need("#help-content").innerHTML = help(cfg);

    const extra = document.createElement("div");
    extra.innerHTML =
      `<div id="confirm" hidden>
  <div class="confirm-card frame">
    <h2 class="display">Start a new game?</h2>
    <p>This puts every tile back on all three boards and ${esc(cfg.resetNote || "clears the game")}. Save a backup first with <kbd>S</kbd> if you might want this session back.</p>
    <div class="confirm-keys"><kbd>Enter</kbd> start new game &nbsp;·&nbsp; <kbd>Esc</kbd> cancel</div>
  </div>
</div>
<div id="toast" role="status"></div>
<input type="file" id="load-file" accept=".json,application/json" hidden>`;
    while (extra.firstChild) document.body.appendChild(extra.firstChild);
  }

  // ------------------------------------------------------------ tip pop-up, after each finished board
  // QR code for https://ko-fi.com/kavyaj. Generated, not hand-written: see tools/make-tip-qr.py.
  const QR_SVG = '<svg class="bq-tip__qrcode" viewBox="0 0 29 29" shape-rendering="crispEdges" role="img" aria-label="QR code for ko-fi.com/kavyaj"><path fill="currentColor" d="M0 0h7v1h-7zM8 0h1v1h-1zM10 0h2v1h-2zM14 0h2v1h-2zM17 0h3v1h-3zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM14 1h7v1h-7zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM9 2h1v1h-1zM11 2h4v1h-4zM20 2h1v1h-1zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM10 3h1v1h-1zM12 3h1v1h-1zM14 3h3v1h-3zM18 3h2v1h-2zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM11 4h1v1h-1zM13 4h1v1h-1zM15 4h6v1h-6zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM12 5h1v1h-1zM14 5h3v1h-3zM19 5h2v1h-2zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM9 7h1v1h-1zM11 7h2v1h-2zM15 7h3v1h-3zM20 7h1v1h-1zM2 8h1v1h-1zM4 8h3v1h-3zM8 8h1v1h-1zM10 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM18 8h4v1h-4zM25 8h1v1h-1zM28 8h1v1h-1zM1 9h3v1h-3zM5 9h1v1h-1zM8 9h5v1h-5zM14 9h1v1h-1zM20 9h3v1h-3zM26 9h1v1h-1zM28 9h1v1h-1zM5 10h2v1h-2zM8 10h2v1h-2zM12 10h2v1h-2zM15 10h2v1h-2zM23 10h1v1h-1zM27 10h2v1h-2zM0 11h4v1h-4zM5 11h1v1h-1zM9 11h1v1h-1zM11 11h1v1h-1zM13 11h3v1h-3zM18 11h2v1h-2zM21 11h2v1h-2zM24 11h1v1h-1zM27 11h1v1h-1zM1 12h3v1h-3zM5 12h4v1h-4zM12 12h1v1h-1zM17 12h4v1h-4zM22 12h2v1h-2zM0 13h1v1h-1zM2 13h2v1h-2zM5 13h1v1h-1zM9 13h1v1h-1zM11 13h2v1h-2zM14 13h3v1h-3zM20 13h4v1h-4zM27 13h2v1h-2zM1 14h4v1h-4zM6 14h3v1h-3zM10 14h1v1h-1zM14 14h1v1h-1zM16 14h1v1h-1zM23 14h1v1h-1zM26 14h1v1h-1zM28 14h1v1h-1zM2 15h1v1h-1zM11 15h6v1h-6zM18 15h1v1h-1zM22 15h2v1h-2zM1 16h1v1h-1zM4 16h3v1h-3zM8 16h1v1h-1zM10 16h1v1h-1zM13 16h3v1h-3zM19 16h1v1h-1zM21 16h2v1h-2zM25 16h1v1h-1zM2 17h4v1h-4zM10 17h3v1h-3zM14 17h1v1h-1zM17 17h2v1h-2zM20 17h4v1h-4zM25 17h1v1h-1zM27 17h2v1h-2zM0 18h1v1h-1zM2 18h1v1h-1zM5 18h2v1h-2zM8 18h2v1h-2zM15 18h1v1h-1zM18 18h1v1h-1zM20 18h2v1h-2zM23 18h3v1h-3zM27 18h2v1h-2zM1 19h1v1h-1zM8 19h5v1h-5zM14 19h4v1h-4zM20 19h1v1h-1zM22 19h1v1h-1zM24 19h1v1h-1zM27 19h1v1h-1zM0 20h1v1h-1zM2 20h1v1h-1zM4 20h3v1h-3zM9 20h1v1h-1zM14 20h3v1h-3zM18 20h1v1h-1zM20 20h5v1h-5zM8 21h1v1h-1zM10 21h1v1h-1zM14 21h1v1h-1zM16 21h2v1h-2zM19 21h2v1h-2zM24 21h1v1h-1zM27 21h2v1h-2zM0 22h7v1h-7zM9 22h1v1h-1zM12 22h4v1h-4zM19 22h2v1h-2zM22 22h1v1h-1zM24 22h1v1h-1zM26 22h3v1h-3zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h1v1h-1zM12 23h1v1h-1zM18 23h1v1h-1zM20 23h1v1h-1zM24 23h1v1h-1zM27 23h2v1h-2zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM8 24h1v1h-1zM11 24h2v1h-2zM14 24h1v1h-1zM16 24h2v1h-2zM20 24h6v1h-6zM27 24h2v1h-2zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM10 25h1v1h-1zM12 25h1v1h-1zM15 25h3v1h-3zM20 25h2v1h-2zM24 25h1v1h-1zM26 25h1v1h-1zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM8 26h1v1h-1zM15 26h3v1h-3zM19 26h1v1h-1zM23 26h3v1h-3zM28 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM12 27h1v1h-1zM14 27h1v1h-1zM16 27h2v1h-2zM20 27h2v1h-2zM23 27h1v1h-1zM27 27h1v1h-1zM0 28h7v1h-7zM9 28h1v1h-1zM11 28h1v1h-1zM13 28h1v1h-1zM18 28h5v1h-5zM24 28h1v1h-1zM27 28h2v1h-2z"/></svg>';

  const tip = (function () {
    const PAUSE_KEY = "bollyquiz:tip-popup-dismissed";   // shared by every quiz page, so a player isn't asked twice in a day
    const PAUSE_MS = 24 * 60 * 60 * 1000;
    const DELAY = 2200;      // lets the last tile lift and the photo show first
    let cfg = null, opts = null, root = null, pop = null, timer = null;
    let isOpen = false;
    let swallow = null;      // key held down while closing the pop-up; ignored until released

    const pausedUntilTomorrow = () => {
      try {
        const at = +localStorage.getItem(PAUSE_KEY);
        return at > 0 && Date.now() >= at && Date.now() - at < PAUSE_MS;
      } catch (e) { return false; }
    };
    const startPause = () => { try { localStorage.setItem(PAUSE_KEY, String(Date.now())); } catch (e) { /* private mode: only this page view */ } };
    const bulbs = () => { if (window.BoardIntro) BoardIntro.layoutBulbs(root.querySelector(".bq-intro__bulbs"), pop); };

    function build() {
      root = document.createElement("div");
      root.className = "bq-intro bq-tip";
      root.hidden = true;
      root.innerHTML =
        `<div class="bq-intro__pop bq-tip__pop" role="dialog" aria-modal="true" aria-labelledby="bq-tip-title" tabindex="-1">
          <div class="bq-intro__bulbs" aria-hidden="true"></div>
          <div class="bq-intro__card bq-tip__card">
            <div class="bq-tip__main">
              <span class="bq-intro__kicker" id="bq-tip-kicker"></span>
              <h2 class="bq-intro__title" id="bq-tip-title">Had fun?</h2>
              <p class="bq-intro__sub">I'm Kavya, and I built BollyQuiz on my own. It's free, with no sign-up. If you enjoyed it, a small tip helps me build the next quiz.</p>
              <div class="bq-intro__act">
                <a class="bq-intro__go bq-tip__go" href="https://ko-fi.com/kavyaj?ref=${encodeURIComponent(cfg.tipRef)}" target="_blank" rel="noopener" data-umami-event="tip-jar-click" data-umami-event-location="endscreen-popup">Leave a tip</a>
                <button type="button" class="bq-tip__later">Maybe later</button>
              </div>
            </div>
            <figure class="bq-tip__qr">
              <div class="bq-tip__qrbox">${QR_SVG}</div>
              <figcaption>Scan to tip on Ko-fi<small>ko-fi.com/kavyaj</small></figcaption>
            </figure>
          </div>
        </div>`;
      document.body.appendChild(root);
      pop = root.querySelector(".bq-intro__pop");
      root.querySelector(".bq-tip__later").addEventListener("click", close);
      root.querySelector(".bq-tip__go").addEventListener("click", () => setTimeout(close, 0));   // Ko-fi opens in a new tab
      root.addEventListener("click", e => { if (e.target === root) close(); });
      // The pop-up owns the keyboard while it is open, so a stray Space can't open a square behind it.
      window.addEventListener("keydown", e => {
        if (isOpen) {
          if (e.altKey || e.metaKey || e.ctrlKey || e.key === "Tab" || /^F\d+$/.test(e.key)) return;   // browser shortcuts and Tab work as normal
          const onControl = e.target.closest && e.target.closest(".bq-tip a, .bq-tip button");
          if (onControl && (e.key === "Enter" || e.key === " ")) { e.stopImmediatePropagation(); return; }   // activates the focused link or button
          if (!e.shiftKey && !e.repeat && (e.key === "Enter" || e.key === " " || e.key === "Escape" || e.key === "Backspace")) { swallow = e.code; close(); }
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        if (swallow && e.code === swallow) { e.preventDefault(); e.stopImmediatePropagation(); }   // still held from closing it
      }, true);
      window.addEventListener("keyup", e => { if (swallow && e.code === swallow) { swallow = null; e.stopImmediatePropagation(); } }, true);
      window.addEventListener("resize", () => { if (isOpen) bulbs(); });
    }

    function open(boardId) {
      if (!root) build();
      root.querySelector("#bq-tip-kicker").textContent = opts.allDone() ? "Every square played" : opts.boardName(boardId) + " done";
      isOpen = true;
      root.hidden = false;
      bulbs();
      pop.focus({ preventScroll: true });
      opts.track("tip-popup-shown", { board: boardId });
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      root.hidden = true;
      startPause();                                                     // dismissed or tipped: no more asking for 24 hours
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // keep focus off the board's buttons
    }

    return {
      /* Once, after the engine's state exists.
         options: { boardName(id), boardDone(id), allDone(), idle(), track(name, data) } */
      init(config, options) { cfg = config; opts = options; },

      /* Call when a board has just been finished (its last square played, or the rest lifted). */
      schedule(boardId) {
        if (!cfg || !cfg.tipRef || isOpen || pausedUntilTomorrow()) return;
        clearTimeout(timer);
        let tries = 0;
        const wait = ms => { timer = setTimeout(() => {
          if (isOpen || pausedUntilTomorrow() || !opts.boardDone(boardId)) return;   // dismissed meanwhile, or the lift was undone
          if (!opts.idle()) { if (++tries < 15) wait(1500); return; }               // help, a prompt or a square is open: try again shortly
          open(boardId);
        }, ms); };
        wait(DELAY);
      },

      /* New game: drop anything waiting to show. (The 24-hour pause is deliberately kept.) */
      reset() {
        clearTimeout(timer);
        if (isOpen) { isOpen = false; root.hidden = true; }
      }
    };
  })();

  window.BoardUI = { mount, tip };
})();
