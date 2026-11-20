/* Tip jar pop-up for the quiz boards: shared by every quiz page (/quiz-1/, /quiz-2/, and any quiz added later).
   Styles: the "Tip pop-up" section of /assets/board/board.css. Needs /assets/board-intro.css and /assets/board-intro.js,
   whose pop-up frame and chasing bulbs it reuses.

   WHAT IT DOES
   When a board is finished (all 25 squares played, or the rest lifted with Shift+Enter), about two seconds later a pop-up
   thanks the players and offers the tip jar: a "Leave a tip" button, plus a QR code so a room watching a TV can scan it
   (the QR is hidden on phones). Closing it, or tapping the button, pauses it for 24 hours across every BollyQuiz page.
   It never shows on a page reload, and while it is open it owns the keyboard, so a stray Space can't open a square.

   A NEW QUIZ NEEDS NOTHING EXTRA: board.js switches it on for every quiz, tagging the Ko-fi link with the quiz's appId.
   Copying a quiz page already includes the script tag (before board.js). To customise, in window.BOARD_CONFIG:
     tipRef: "bollyquiz-my-quiz"      tags the Ko-fi link so tips can be told apart (default: the quiz's appId)
     tipPopup: false                  no pop-up for this quiz
     tipPopup: { message: "...", title: "...", pauseHours: 12 }     override any text or timing in DEFAULTS below

   HOW THE ENGINE USES IT (board.js)
     BoardTip.init(config, hooks)   once; hooks = { boardName(id), boardDone(id), allDone(), idle(), track(name, data) }
     BoardTip.schedule(boardId)     when a board has just been finished
     BoardTip.reset()               on New game: drops anything waiting (the 24-hour pause is deliberately kept)

   CHANGING THE TIP JAR ADDRESS: edit DEFAULTS.url and regenerate QR_SVG with tools/make-tip-qr.py. The QR is a fixed picture
   of DEFAULTS.url, so it is hidden automatically if a quiz overrides url. */
(function () {
  "use strict";

  const DEFAULTS = {
    url: "https://ko-fi.com/kavyaj",
    urlLabel: "ko-fi.com/kavyaj",
    title: "Had fun?",
    message: "I'm Kavya, and I built BollyQuiz on my own. It's free, with no sign-up. If you enjoyed it, a small tip helps me build the next quiz.",
    button: "Leave a tip",
    later: "Maybe later",
    scan: "Scan to tip on Ko-fi",
    pauseHours: 24,          // quiet period after a player closes it
    delayMs: 2200            // lets the last tile lift and the photo show first
  };

  // QR code for DEFAULTS.url. Generated, not hand-written: see tools/make-tip-qr.py.
  const QR_SVG = '<svg class="bq-tip__qrcode" viewBox="0 0 29 29" shape-rendering="crispEdges" role="img" aria-label="QR code for ko-fi.com/kavyaj"><path fill="currentColor" d="M0 0h7v1h-7zM8 0h1v1h-1zM10 0h2v1h-2zM14 0h2v1h-2zM17 0h3v1h-3zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM14 1h7v1h-7zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM9 2h1v1h-1zM11 2h4v1h-4zM20 2h1v1h-1zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM10 3h1v1h-1zM12 3h1v1h-1zM14 3h3v1h-3zM18 3h2v1h-2zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM11 4h1v1h-1zM13 4h1v1h-1zM15 4h6v1h-6zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM12 5h1v1h-1zM14 5h3v1h-3zM19 5h2v1h-2zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM9 7h1v1h-1zM11 7h2v1h-2zM15 7h3v1h-3zM20 7h1v1h-1zM2 8h1v1h-1zM4 8h3v1h-3zM8 8h1v1h-1zM10 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM18 8h4v1h-4zM25 8h1v1h-1zM28 8h1v1h-1zM1 9h3v1h-3zM5 9h1v1h-1zM8 9h5v1h-5zM14 9h1v1h-1zM20 9h3v1h-3zM26 9h1v1h-1zM28 9h1v1h-1zM5 10h2v1h-2zM8 10h2v1h-2zM12 10h2v1h-2zM15 10h2v1h-2zM23 10h1v1h-1zM27 10h2v1h-2zM0 11h4v1h-4zM5 11h1v1h-1zM9 11h1v1h-1zM11 11h1v1h-1zM13 11h3v1h-3zM18 11h2v1h-2zM21 11h2v1h-2zM24 11h1v1h-1zM27 11h1v1h-1zM1 12h3v1h-3zM5 12h4v1h-4zM12 12h1v1h-1zM17 12h4v1h-4zM22 12h2v1h-2zM0 13h1v1h-1zM2 13h2v1h-2zM5 13h1v1h-1zM9 13h1v1h-1zM11 13h2v1h-2zM14 13h3v1h-3zM20 13h4v1h-4zM27 13h2v1h-2zM1 14h4v1h-4zM6 14h3v1h-3zM10 14h1v1h-1zM14 14h1v1h-1zM16 14h1v1h-1zM23 14h1v1h-1zM26 14h1v1h-1zM28 14h1v1h-1zM2 15h1v1h-1zM11 15h6v1h-6zM18 15h1v1h-1zM22 15h2v1h-2zM1 16h1v1h-1zM4 16h3v1h-3zM8 16h1v1h-1zM10 16h1v1h-1zM13 16h3v1h-3zM19 16h1v1h-1zM21 16h2v1h-2zM25 16h1v1h-1zM2 17h4v1h-4zM10 17h3v1h-3zM14 17h1v1h-1zM17 17h2v1h-2zM20 17h4v1h-4zM25 17h1v1h-1zM27 17h2v1h-2zM0 18h1v1h-1zM2 18h1v1h-1zM5 18h2v1h-2zM8 18h2v1h-2zM15 18h1v1h-1zM18 18h1v1h-1zM20 18h2v1h-2zM23 18h3v1h-3zM27 18h2v1h-2zM1 19h1v1h-1zM8 19h5v1h-5zM14 19h4v1h-4zM20 19h1v1h-1zM22 19h1v1h-1zM24 19h1v1h-1zM27 19h1v1h-1zM0 20h1v1h-1zM2 20h1v1h-1zM4 20h3v1h-3zM9 20h1v1h-1zM14 20h3v1h-3zM18 20h1v1h-1zM20 20h5v1h-5zM8 21h1v1h-1zM10 21h1v1h-1zM14 21h1v1h-1zM16 21h2v1h-2zM19 21h2v1h-2zM24 21h1v1h-1zM27 21h2v1h-2zM0 22h7v1h-7zM9 22h1v1h-1zM12 22h4v1h-4zM19 22h2v1h-2zM22 22h1v1h-1zM24 22h1v1h-1zM26 22h3v1h-3zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h1v1h-1zM12 23h1v1h-1zM18 23h1v1h-1zM20 23h1v1h-1zM24 23h1v1h-1zM27 23h2v1h-2zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM8 24h1v1h-1zM11 24h2v1h-2zM14 24h1v1h-1zM16 24h2v1h-2zM20 24h6v1h-6zM27 24h2v1h-2zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM10 25h1v1h-1zM12 25h1v1h-1zM15 25h3v1h-3zM20 25h2v1h-2zM24 25h1v1h-1zM26 25h1v1h-1zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM8 26h1v1h-1zM15 26h3v1h-3zM19 26h1v1h-1zM23 26h3v1h-3zM28 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM12 27h1v1h-1zM14 27h1v1h-1zM16 27h2v1h-2zM20 27h2v1h-2zM23 27h1v1h-1zM27 27h1v1h-1zM0 28h7v1h-7zM9 28h1v1h-1zM11 28h1v1h-1zM13 28h1v1h-1zM18 28h5v1h-5zM24 28h1v1h-1zM27 28h2v1h-2z"/></svg>';

  const PAUSE_KEY = "bollyquiz:tip-popup-dismissed";   // shared by every quiz page, so a player isn't asked twice in a day

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let cfg = null, opts = null, hooks = null, enabled = false;
  let root = null, pop = null, timer = null;
  let isOpen = false;
  let swallow = null;      // key held down while closing the pop-up; ignored until released

  const paused = () => {
    try {
      const at = +localStorage.getItem(PAUSE_KEY);
      return at > 0 && Date.now() >= at && Date.now() - at < opts.pauseHours * 3600 * 1000;
    } catch (e) { return false; }
  };
  const startPause = () => { try { localStorage.setItem(PAUSE_KEY, String(Date.now())); } catch (e) { /* private mode: this page view only */ } };
  const bulbs = () => { if (window.BoardIntro) BoardIntro.layoutBulbs(root.querySelector(".bq-intro__bulbs"), pop); };

  function link() {
    return opts.url + (opts.url.indexOf("?") < 0 ? "?" : "&") + "ref=" + encodeURIComponent(cfg.tipRef);
  }

  function build() {
    const withQr = opts.url === DEFAULTS.url;
    root = document.createElement("div");
    root.className = "bq-intro bq-tip";
    root.hidden = true;
    root.innerHTML =
      `<div class="bq-intro__pop bq-tip__pop${withQr ? "" : " bq-tip__pop--no-qr"}" role="dialog" aria-modal="true" aria-labelledby="bq-tip-title" tabindex="-1">
        <div class="bq-intro__bulbs" aria-hidden="true"></div>
        <div class="bq-intro__card bq-tip__card${withQr ? "" : " bq-tip__card--no-qr"}">
          <div class="bq-tip__main">
            <span class="bq-intro__kicker" id="bq-tip-kicker"></span>
            <h2 class="bq-intro__title" id="bq-tip-title">${esc(opts.title)}</h2>
            <p class="bq-intro__sub">${esc(opts.message)}</p>
            <div class="bq-intro__act">
              <a class="bq-intro__go bq-tip__go" href="${esc(link())}" target="_blank" rel="noopener" data-umami-event="tip-jar-click" data-umami-event-location="endscreen-popup">${esc(opts.button)}</a>
              <button type="button" class="bq-tip__later">${esc(opts.later)}</button>
            </div>
          </div>
          ${withQr ? `<figure class="bq-tip__qr">
            <div class="bq-tip__qrbox">${QR_SVG}</div>
            <figcaption>${esc(opts.scan)}<small>${esc(opts.urlLabel)}</small></figcaption>
          </figure>` : ""}
        </div>
      </div>`;
    document.body.appendChild(root);
    pop = root.querySelector(".bq-intro__pop");
    root.querySelector(".bq-tip__later").addEventListener("click", close);
    root.querySelector(".bq-tip__go").addEventListener("click", () => setTimeout(close, 0));   // the link opens in a new tab
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
    root.querySelector("#bq-tip-kicker").textContent = hooks.allDone() ? "Every square played" : hooks.boardName(boardId) + " done";
    isOpen = true;
    root.hidden = false;
    bulbs();
    pop.focus({ preventScroll: true });
    hooks.track("tip-popup-shown", { board: boardId });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.hidden = true;
    startPause();                                                     // dismissed or tipped: no more asking for a while
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // keep focus off the board's buttons
  }

  window.BoardTip = {
    /* Once, after the engine's state exists. */
    init(config, engineHooks) {
      cfg = config; hooks = engineHooks;
      const custom = config.tipPopup && typeof config.tipPopup === "object" ? config.tipPopup : {};
      opts = Object.assign({}, DEFAULTS, custom);
      enabled = config.tipPopup !== false && !!config.tipRef;
    },

    /* Call when a board has just been finished (its last square played, or the rest lifted). */
    schedule(boardId) {
      if (!enabled || isOpen || paused()) return;
      clearTimeout(timer);
      let tries = 0;
      const wait = ms => { timer = setTimeout(() => {
        if (isOpen || paused() || !hooks.boardDone(boardId)) return;     // dismissed meanwhile, or the lift was undone
        if (!hooks.idle()) { if (++tries < 15) wait(1500); return; }     // help, a prompt or a square is open: try again shortly
        open(boardId);
      }, ms); };
      wait(opts.delayMs);
    },

    /* New game: drop anything waiting to show. (The pause is deliberately kept.) */
    reset() {
      clearTimeout(timer);
      if (isOpen) { isOpen = false; root.hidden = true; }
    }
  };
})();
