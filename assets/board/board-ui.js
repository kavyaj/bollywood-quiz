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

   THE PAGE KEEPS ONLY (as static HTML, so search engines see it):
     <div id="help" hidden><div class="help-card frame"><div id="help-content"></div> <nav class="help-more">...</nav></div></div>
   where the footer page list inside the nav is kept in sync across the whole site by tools/site.py. */
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

  window.BoardUI = { mount };
})();
