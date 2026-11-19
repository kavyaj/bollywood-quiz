/* Quiz board engine: shared by every quiz page (/quiz-1/, /quiz-2/, ...). Styles: /assets/board/board.css.
   It runs the three 5x5 boards: opening squares, answers, keyboard and mouse, autosave, backups and new game.
   It reads the quiz from the page's QUIZ data, so a new quiz supplies data and settings, and no engine code.

   THE PIECES (all shared, so a fix or a new feature lands on every quiz)
     board.css            every style
     board-ui.js          builds the header, help screen, new-game prompt, toast and tip line from the settings
     board.js             this file: the game itself
     charades.js/.css     optional plug-in for charade squares (any other special square type is a plug-in too)
     ../board-intro.js    the first-open category pop-up

   SET UP A NEW QUIZ: copy an existing quiz page (e.g. /quiz-2/index.html) to /quiz-N/index.html, then change:
   1. The <head> SEO tags: title, description, canonical, og: and twitter: tags.
   2. The QUIZ data (const QUIZ = { meta: {...}, boards: [...] };). meta.title and meta.subtitle are the heading.
      Every category needs a "blurb" for the first-open pop-up (see /assets/board-intro.js).
   3. window.BOARD_CONFIG, in the script after the data. Use a different appId and storageKey for each quiz, since they
      keep one quiz's saved game apart from another's:
        appId, storageKey         required
        downloadPrefix, answerLabel   optional (defaults "quiz-session" and "Answer")
        answersLink, tipRef, resetNote, help   the quiz's own wording on the screens; see /assets/board/board-ui.js
        (tipRef also switches on the tip-jar pop-up shown after each finished board, then paused for 24 hours once dismissed)
   4. The footer list in the help screen: leave it. Add the quiz to tools/site-pages.json and sitemap.xml, then run
      python tools/site.py sync   and   python tools/site.py check
   5. If the quiz uses charade squares, keep the charades.css link and charades.js script; if not, delete them.
   The scripts must load in this order, at the end of the body: board-intro.js, [plug-ins], board-ui.js, board.js.
   Square types built in: emoji, text, longText, list, clueChain, audio, image. */
(() => {
  "use strict";

  // Per-quiz settings come from the page (see the notes at the top of this file).
  const CFG = Object.assign({ downloadPrefix: "quiz-session", answerLabel: "Answer" }, window.BOARD_CONFIG);
  if (!CFG.appId || !CFG.storageKey) throw new Error("board.js: set window.BOARD_CONFIG = { appId, storageKey } before loading it.");
  // Plug-ins for special square types, registered by their own scripts (see charades.js).
  const plugins = {};
  (window.BOARD_PLUGINS || []).forEach(p => { plugins[p.promptType] = p; });
  const curPlugin = () => (state.current ? plugins[currentCell().cell.promptType] : undefined);

  if (!window.BoardUI) throw new Error("board.js: load /assets/board/board-ui.js before it.");
  BoardUI.mount(CFG, QUIZ);   // builds the header, help, new-game prompt and toast

  const COLS = 5, ROWS = 5;
  const LIFT_STAGGER_MS = 40;

  // ---------------------------------------------------------------- state
  const state = {
    activeBoard: 1,
    answered: { 1: new Set(), 2: new Set(), 3: new Set() },  // ids like "c1-10"
    view: "board",          // board | question | answer
    current: null,          // { board, col, points, colIdx, rowIdx }
    clueStep: 0,
    history: [],            // [{ board, ids: [...] }]
    cursor: { 1: { col: 0, row: 0 }, 2: { col: 0, row: 0 }, 3: { col: 0, row: 0 } },
    help: false
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // Umami event, if the script loaded. Ad blockers or localhost just skip it.
  const track = (name, data) => { try { if (window.umami) window.umami.track(name, data); } catch (e) {} };
  let gameStartTracked = false;
  let nudgeBoard = null, nudgeTimer = null;   // board tab pulsing after the current board is finished
  const clearNudge = () => { clearTimeout(nudgeTimer); nudgeBoard = null; };
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const boardById = id => QUIZ.boards.find(b => b.id === id);
  const cellId = (column, cell) => `${column.id}-${cell.points}`;
  const NAMES = { 1: "Board One", 2: "Board Two", 3: "Board Three" };

  // ------------------------------------------------ one-time data prep
  // shuffleOnLoad: shuffle once, and never leave the items in release order
  // (or reverse release order). Release order is read from the answer string.
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // savedOrders: { "3:c5-10": [...] } from a restored session. A saved order
  // is reused only if it is still a permutation of the current prompt.
  function assignShuffles(savedOrders = {}) {
    const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
    QUIZ.boards.forEach(board => board.columns.forEach(column => column.cells.forEach(cell => {
      cell.display = cell.prompt;
      if (!column.shuffleOnLoad || !Array.isArray(cell.prompt)) return;
      const saved = savedOrders[`${board.id}:${cellId(column, cell)}`];
      if (Array.isArray(saved) && same(saved.slice().sort(), cell.prompt.slice().sort())) {
        cell.display = saved.slice();
        return;
      }
      const chrono = cell.prompt.slice().sort((a, b) => cell.answer.indexOf(a) - cell.answer.indexOf(b));
      let order = shuffle(cell.prompt);
      for (let tries = 0; tries < 30 && (same(order, chrono) || same(order, chrono.slice().reverse())); tries++) {
        order = shuffle(cell.prompt);
      }
      cell.display = order;
    })));
  }

  // ------------------------------------------------ session persistence
  // Autosaves to this browser's localStorage after every change, and can be
  // exported to / imported from a JSON backup file.
  const STORAGE_KEY = CFG.storageKey;

  function validIds(boardId) {
    const board = boardById(boardId);
    return new Set(board.columns.flatMap(column => column.cells.map(cell => cellId(column, cell))));
  }

  function snapshot() {
    const shuffles = {};
    QUIZ.boards.forEach(board => board.columns.forEach(column => {
      if (column.shuffleOnLoad) column.cells.forEach(cell => {
        shuffles[`${board.id}:${cellId(column, cell)}`] = cell.display;
      });
    }));
    return {
      app: CFG.appId,
      version: 1,
      savedAt: new Date().toISOString(),
      activeBoard: state.activeBoard,
      answered: Object.fromEntries(QUIZ.boards.map(b => [b.id, [...state.answered[b.id]]])),
      history: state.history,
      cursor: state.cursor,
      shuffles
    };
  }

  let storageOk = true;
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
      storageOk = true;
    } catch (err) {
      if (storageOk) toast("Autosave isn't available in this browser. Use <kbd>S</kbd> to save backups.", 6000);
      storageOk = false;
    }
  }

  // Returns a cleaned session, or null if the data isn't a usable session.
  function parseSession(raw) {
    if (!raw || raw.app !== CFG.appId || raw.version !== 1) return null;
    const ids = Object.fromEntries(QUIZ.boards.map(b => [b.id, validIds(b.id)]));
    const answered = {};
    QUIZ.boards.forEach(b => {
      const list = raw.answered && Array.isArray(raw.answered[b.id]) ? raw.answered[b.id] : [];
      answered[b.id] = new Set(list.filter(id => ids[b.id].has(id)));
    });
    const history = (Array.isArray(raw.history) ? raw.history : [])
      .filter(h => h && ids[h.board] && Array.isArray(h.ids))
      .map(h => ({ board: h.board, ids: h.ids.filter(id => ids[h.board].has(id)) }))
      .filter(h => h.ids.length);
    const cursor = {};
    QUIZ.boards.forEach(b => {
      const c = raw.cursor && raw.cursor[b.id];
      cursor[b.id] = {
        col: clamp(Number.isInteger(c && c.col) ? c.col : 0, 0, COLS - 1),
        row: clamp(Number.isInteger(c && c.row) ? c.row : 0, 0, ROWS - 1)
      };
    });
    return {
      activeBoard: boardById(raw.activeBoard) ? raw.activeBoard : 1,
      answered, history, cursor,
      shuffles: raw.shuffles && typeof raw.shuffles === "object" ? raw.shuffles : {},
      savedAt: raw.savedAt
    };
  }

  function applySession(session) {
    state.activeBoard = session.activeBoard;
    state.answered = session.answered;
    state.history = session.history;
    state.cursor = session.cursor;
    assignShuffles(session.shuffles);
  }

  function loadStoredSession() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      return text ? parseSession(JSON.parse(text)) : null;
    } catch (err) {
      return null;
    }
  }

  const liftedTotal = () => QUIZ.boards.reduce((n, b) => n + state.answered[b.id].size, 0);

  function saveBackup() {
    const data = snapshot();
    const stamp = data.savedAt.slice(0, 16).replace("T", "_").replace(":", "");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${CFG.downloadPrefix}_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(`Backup saved to Downloads: ${esc(a.download)}`);
  }

  const fileInput = $("#load-file");
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    file.text().then(text => {
      const session = parseSession(JSON.parse(text));
      if (!session) throw new Error("not a quiz session");
      applySession(session);
      persist();
      renderBoard();
      toast(`Loaded ${esc(file.name)}: ${liftedTotal()} squares lifted`);
    }).catch(() => toast(`Couldn't load ${esc(file.name)}. It isn't a quiz session backup.`, 5000));
  });

  function startNewGame() {
    clearNudge();
    if (window.BoardIntro) BoardIntro.reset();
    BoardUI.tip.reset();
    state.activeBoard = 1;
    state.answered = { 1: new Set(), 2: new Set(), 3: new Set() };
    state.history = [];
    state.cursor = { 1: { col: 0, row: 0 }, 2: { col: 0, row: 0 }, 3: { col: 0, row: 0 } };
    assignShuffles();
    persist();
    renderBoard();
    track("new-game");
    gameStartTracked = false; // the first square of the new game counts as a new game-start
    toast("New game. All boards reset.");
  }

  let toastTimer = null;
  function toast(html, ms = 3500) {
    const el = $("#toast");
    el.innerHTML = html;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  }

  // ------------------------------------------------------- build boards
  const boardEls = {};   // id -> { root, cells: [[el]] by row/col, ring }

  function buildBoards() {
    const host = $("#boards");
    QUIZ.boards.forEach(board => {
      const root = document.createElement("section");
      root.className = "board frame";
      root.dataset.board = board.id;

      const headers = document.createElement("div");
      headers.className = "col-headers";
      board.columns.forEach(column => {
        const h = document.createElement("div");
        h.className = "col-h display";
        h.textContent = column.title;
        headers.appendChild(h);
      });

      const wrap = document.createElement("div");
      wrap.className = "grid-wrap";
      wrap.dataset.src = board.hiddenImage;
      const img = document.createElement("img");
      img.className = "hidden-photo";
      img.alt = "";
      img.draggable = false;
      img.addEventListener("error", () => wrap.classList.add("photo-missing"));
      img.src = board.hiddenImage;

      const tiles = document.createElement("div");
      tiles.className = "tiles";
      const cells = [];
      for (let row = 0; row < ROWS; row++) {
        cells[row] = [];
        for (let col = 0; col < COLS; col++) {
          const data = board.columns[col].cells[row];
          const el = document.createElement("div");
          el.className = "cell";
          el.style.gridRow = row + 1;
          el.style.gridColumn = col + 1;
          el.dataset.id = cellId(board.columns[col], data);
          el.innerHTML = `<div class="tile"><span class="num display outlined">${data.points}</span></div>`;
          el.addEventListener("click", () => {
            if (state.view !== "board" || state.help) return;
            state.cursor[board.id] = { col, row };
            openQuestion(col, row);
          });
          tiles.appendChild(el);
          cells[row][col] = el;
        }
      }
      const ring = document.createElement("div");
      ring.className = "cursor-ring";
      tiles.appendChild(ring);

      wrap.append(img, tiles);
      root.append(headers, wrap);
      host.appendChild(root);
      boardEls[board.id] = { root, cells, ring };
    });
  }

  // ------------------------------------------------------- render: board
  // opts.delays: Map(id -> ms) for staggered lifts
  // opts.ringDelay: ms before the cursor ring appears (after a lift)
  function renderBoard(opts = {}) {
    const delays = opts.delays || new Map();
    QUIZ.boards.forEach(board => {
      const { root, cells, ring } = boardEls[board.id];
      root.hidden = board.id !== state.activeBoard;
      const answered = state.answered[board.id];
      const cur = state.cursor[board.id];

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const el = cells[row][col];
          const lifted = answered.has(el.dataset.id) && `${board.id}:${el.dataset.id}` !== opts.hold;
          if (el.classList.contains("lifted") !== lifted) {
            el.style.setProperty("--delay", (delays.get(el.dataset.id) || 0) + "ms");
            el.classList.toggle("lifted", lifted);
          }
          el.classList.toggle("is-cursor", row === cur.row && col === cur.col);
        }
      }

      const onHole = cells[cur.row][cur.col].classList.contains("lifted");
      ring.style.gridRow = cur.row + 1;
      ring.style.gridColumn = cur.col + 1;
      ring.style.transitionDelay = onHole && opts.ringDelay ? opts.ringDelay + "ms" : "0ms";
      ring.classList.toggle("show", onHole);
    });

    document.querySelectorAll(".board-tab").forEach(t => {
      const id = +t.dataset.board, size = state.answered[id] ? state.answered[id].size : 0;
      t.setAttribute("aria-selected", id === state.activeBoard);
      t.classList.toggle("done", size === ROWS * COLS);
      t.classList.toggle("nudge", id === nudgeBoard);
      t.querySelector(".bt-bar i").style.setProperty("--p", size / (ROWS * COLS));
      t.title = `${NAMES[id] || "Board " + id}: ${size} / ${ROWS * COLS} lifted (press ${id})`;
    });
    $("#readout").textContent = `${state.answered[state.activeBoard].size} / ${ROWS * COLS} lifted`;
    $("#end-tip").hidden = liftedTotal() < QUIZ.boards.length * ROWS * COLS;
    if (window.BoardIntro) BoardIntro.boardShown();
  }

  // ---------------------------------------------------- question view
  const qv = $("#question-view");

  function currentCell() {
    const c = state.current;
    const column = boardById(c.board).columns[c.colIdx];
    return { column, cell: column.cells[c.rowIdx] };
  }

  const PLAY_SVG = '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0 L10 6 L0 12 Z"/></svg>';

  function answerHTML(cell) {
    const long = String(cell.answer).length > 34 ? " long" : "";
    return `<div class="q-answer">
      <div class="q-answer-label display">${esc(CFG.answerLabel)}</div>
      <div class="q-answer-text display${long}">${esc(cell.answer)}</div>
      ${cell.answerNote ? `<div class="q-answer-note">${esc(cell.answerNote)}</div>` : ""}
    </div>`;
  }

  function bodyHTML(cell) {
    const p = cell.display;
    const pl = plugins[cell.promptType];
    if (pl && pl.body) return pl.body(cell, p);
    switch (cell.promptType) {
      case "emoji":
        return `<div class="q-emoji">${esc(p)}</div>`;
      case "text": {
        const short = String(p).length <= 28 && !/[.,?!]/.test(p);
        return short
          ? `<div class="q-text display">${esc(p)}</div>`
          : `<div class="q-text prose">${esc(p)}</div>`;
      }
      case "longText":
        return `<div class="q-long">${esc(p)}</div>`;
      case "list":
        return `<ul class="q-list">${p.map(item => `<li class="display">${esc(item)}</li>`).join("")}</ul>`;
      case "clueChain":
        return `<ol class="q-clues">${p.map((clue, i) =>
          `<li data-i="${i}"><span class="n display outlined">${i + 1}</span><span>${esc(clue)}</span></li>`).join("")}</ol>`;
      case "audio":
        return `<div class="audio-ui">
          <div class="play-btn" title="Replay from the start (R)">${PLAY_SVG}</div>
          <div class="eq">${"<i></i>".repeat(9)}</div>
          <div class="audio-state display">
            <span class="playing-label">♪ Playing…</span>
            <span class="idle-label">Listen</span>
          </div>
          <div class="audio-hint"><kbd>R</kbd> replay from the start</div>
        </div>`;
      default:
        return `<div class="q-text prose">${esc(p)}</div>`;
    }
  }

  const ACTIONS_HTML = '<div class="q-actions"><div class="q-action display outlined" role="button"></div></div>';

  // Label follows the step: Next clue → Reveal answer → Back to board
  function actionLabel(cell) {
    if (state.view === "answer") return "Back to board";
    const pl = plugins[cell.promptType];
    if (pl && pl.actionLabel) return pl.actionLabel(cell);
    if (cell.promptType === "clueChain" && state.clueStep < cell.prompt.length - 1) return "Next clue";
    return "Reveal answer";
  }

  function buildQuestion() {
    const { column, cell } = currentCell();
    qv.className = "";
    qv.style.setProperty("--fit", 1);

    if (cell.promptType === "image") {
      qv.classList.add("image-mode");
      qv.innerHTML = `<div class="q-image">
          <div class="q-close" title="Back to board (Backspace)">✕</div>
          <div class="q-img-wrap">
            <img class="q-question-img" alt="" draggable="false">
            ${cell.answerImage ? '<img class="q-answer-img" alt="" draggable="false">' : ""}
          </div>
          ${answerHTML(cell)}
          ${ACTIONS_HTML}
        </div>`;
      const load = (img, src) => {
        img.addEventListener("error", () => {
          const box = document.createElement("div");
          box.className = "missing" + (img.classList.contains("q-answer-img") ? " q-answer-img" : "");
          box.innerHTML = `Image not found<br><code>${esc(src)}</code>`;
          img.replaceWith(box);
        });
        img.src = src;
      };
      load($(".q-question-img", qv), cell.prompt);
      if (cell.answerImage) load($(".q-answer-img", qv), cell.answerImage);
      return;
    }

    const steps = cell.promptType === "clueChain" && cell.prompt.length > 1
      ? `<div class="q-progress">${cell.prompt.map(() => "<i></i>").join("")}</div>` : "";

    qv.innerHTML = `<div class="sunburst"></div>
      <div class="q-frame frame">
        <header class="q-head">
          <div class="q-cat display">${esc(column.title)}</div>
          <div class="q-pts display outlined">${cell.points}</div>
          ${steps}
          <div class="q-close" title="Back to board (Backspace)">✕</div>
        </header>
        ${column.instruction ? `<div class="q-instruction">${esc(column.instruction)}</div>` : ""}
        <div class="q-body type-${cell.promptType}">${bodyHTML(cell)}</div>
        ${answerHTML(cell)}
        ${ACTIONS_HTML}
      </div>`;
  }

  function renderQuestion(opts = {}) {
    if (state.view === "board") {
      qv.hidden = true;
      return;
    }
    qv.hidden = false;
    const { cell } = currentCell();
    qv.classList.toggle("show-answer", state.view === "answer");
    const action = $(".q-action", qv);
    if (action) action.textContent = actionLabel(cell);

    if (cell.promptType === "clueChain") {
      qv.querySelectorAll(".q-clues li").forEach(li => {
        const i = +li.dataset.i;
        li.hidden = i > state.clueStep;
        li.classList.toggle("latest", opts.newClue === true && i === state.clueStep);
      });
      qv.querySelectorAll(".q-progress i").forEach((dot, i) =>
        dot.classList.toggle("on", i <= state.clueStep));
    }
    fitQuestion();
  }

  // Shrink type (via --fit) only when content would overflow the frame.
  // Paragraphs: prefer 60ch at >= 28px; widen the measure before going
  // below 28px, and only drop to 18px as a last resort on a small screen.
  function fitQuestion() {
    const body = $(".q-body", qv);
    if (qv.hidden || !body) return;
    const overflowing = () =>
      body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1;
    const tryFit = (measure, floor) => {
      qv.style.setProperty("--measure", measure + "ch");
      qv.style.setProperty("--floor", floor + "px");
      let fit = 1;
      qv.style.setProperty("--fit", fit);
      while (fit > 0.3 && overflowing()) {
        fit -= 0.03;
        qv.style.setProperty("--fit", fit.toFixed(2));
      }
      return !overflowing();
    };
    tryFit(60, 28) || tryFit(72, 28) || tryFit(84, 28) || tryFit(84, 18) || tryFit(90, 15);
  }

  // ------------------------------------------------------------- audio
  const audio = new Audio();
  audio.preload = "auto";
  let audioSrc = "";

  function setPlaying(on) {
    qv.classList.toggle("audio-playing", on);
  }

  function stopAudio() {
    audio.pause();
    setPlaying(false);
  }

  function showAudioError(src) {
    qv.classList.add("audio-error");
    const ui = $(".audio-state", qv);
    if (ui) ui.innerHTML = `<div class="missing audio-missing">Audio not found<br><code>${esc(src)}</code></div>`;
    fitQuestion();
  }

  // Chrome refused to start playback without a key press or click.
  function showAudioBlocked() {
    const ui = $(".audio-state", qv);
    if (ui) ui.innerHTML = '<span class="idle-label">Press <kbd>R</kbd> to play</span>';
  }

  // Plays the whole clip; it stops by itself at the end.
  function playClip() {
    if (!state.current) return;
    const { cell } = currentCell();
    if (cell.promptType !== "audio") return;
    stopAudio();
    if (audioSrc !== cell.prompt) {
      audioSrc = cell.prompt;
      audio.src = cell.prompt;
    }
    audio.currentTime = 0;
    audio.play().then(() => {
      setPlaying(true);
    }).catch(err => {
      if (err && err.name === "AbortError") return;   // interrupted by another play
      if (err && err.name === "NotAllowedError") showAudioBlocked();
      else showAudioError(cell.prompt);
    });
  }
  audio.addEventListener("ended", () => setPlaying(false));
  audio.addEventListener("error", () => {
    if (state.current && currentCell().cell.promptType === "audio") showAudioError(audioSrc);
  });

  // ----------------------------------------------------------- actions
  function openQuestion(colIdx, rowIdx) {
    const board = boardById(state.activeBoard);
    const column = board.columns[colIdx];
    const cell = column.cells[rowIdx];
    state.current = { board: board.id, col: column.id, points: cell.points, colIdx, rowIdx };
    if (!gameStartTracked && liftedTotal() === 0) { gameStartTracked = true; track("game-start"); }
    const pl = plugins[cell.promptType];
    track((pl && pl.openEvent) || "square-open", { board: board.id, category: column.title, points: cell.points });
    state.clueStep = 0;
    state.view = "question";
    if (pl && pl.open) pl.open(cell);
    buildQuestion();
    renderBoard();
    renderQuestion();
    if (cell.promptType === "audio") playClip();
  }

  function advance() {
    if (state.view === "question") {
      const { cell } = currentCell();
      const pl = plugins[cell.promptType];
      if (pl && pl.advance && pl.advance(cell)) return;
      if (cell.promptType === "clueChain" && state.clueStep < cell.prompt.length - 1) {
        state.clueStep++;
        renderQuestion({ newClue: true });
        return;
      }
      state.view = "answer";
      renderQuestion();
    } else if (state.view === "answer") {
      closeQuestion(true);
    }
  }

  function stepBack() {
    if (state.view === "answer") {
      state.view = "question";
      renderQuestion();
    } else if (state.view === "question" && curPlugin() && curPlugin().back && curPlugin().back()) {
      renderQuestion();
    } else if (state.view === "question" && state.clueStep > 0) {
      state.clueStep--;
      renderQuestion();
    }
  }

  function closeQuestion(mark) {
    stopAudio();
    const pl = curPlugin();
    if (pl && pl.close) pl.close();
    const cur = state.current;
    const { column, cell } = currentCell();
    const id = cellId(column, cell);
    state.view = "board";
    state.current = null;
    state.clueStep = 0;
    const lifting = mark && !state.answered[cur.board].has(id);
    if (lifting) {
      // Record and save straight away; only the animation waits.
      state.answered[cur.board].add(id);
      state.history.push({ board: cur.board, ids: [id] });
      if (state.answered[cur.board].size === ROWS * COLS) {
        track("board-finished", { board: cur.board, via: "play" });
        nudgeNextBoard(cur.board, 1800);
      }
      if (state.answered[cur.board].size === ROWS * COLS) BoardUI.tip.schedule(cur.board);   // tip jar pop-up after a finished board
    }
    persist();
    renderQuestion();
    renderBoard({ hold: lifting ? `${cur.board}:${id}` : null });

    if (lifting) {
      // Flush styles with the tile still in place, so the lift animates in view.
      void document.body.offsetHeight;
      renderBoard({ ringDelay: 420 });
    }
  }

  function liftAll() {
    const board = boardById(state.activeBoard);
    const answered = state.answered[board.id];
    const ids = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const id = cellId(board.columns[col], board.columns[col].cells[row]);
        if (!answered.has(id)) ids.push(id);
      }
    }
    if (!ids.length) return;
    const delays = new Map(ids.map((id, i) => [id, i * LIFT_STAGGER_MS]));
    ids.forEach(id => answered.add(id));
    state.history.push({ board: board.id, ids });
    track("board-finished", { board: board.id, via: "lift-all", remaining: ids.length });
    persist();
    renderBoard({ delays, ringDelay: ids.length * LIFT_STAGGER_MS + 400 });
    nudgeNextBoard(board.id, ids.length * LIFT_STAGGER_MS + 1800);
    BoardUI.tip.schedule(board.id);
  }

  function undo() {
    const entry = state.history.pop();
    if (!entry) return;
    clearNudge();
    state.activeBoard = entry.board;
    entry.ids.forEach(id => state.answered[entry.board].delete(id));
    persist();
    renderBoard();
  }

  // After a board is finished, point the host at the next unfinished one.
  function nudgeNextBoard(doneId, waitMs) {
    const ids = QUIZ.boards.map(b => b.id);
    const start = ids.indexOf(doneId);
    const next = [...ids.slice(start + 1), ...ids.slice(0, start)]
      .find(id => state.answered[id].size < ROWS * COLS);
    if (next == null) return;
    clearNudge();
    nudgeTimer = setTimeout(() => {
      // Skip if the host has moved on, undone a lift or opened a square meanwhile.
      if (state.view !== "board" || state.activeBoard !== doneId || state.answered[doneId].size < ROWS * COLS) return;
      nudgeBoard = next;
      renderBoard();
      toast(`${NAMES[doneId] || "Board " + doneId} done! Next up: <b>${NAMES[next] || "Board " + next}</b>. Press <kbd>${next}</kbd> or click its tab.`, 6000);
    }, waitMs);
  }

  function switchBoard(id) {
    if (!boardById(id) || id === state.activeBoard) return;
    if (id === nudgeBoard) nudgeBoard = null;
    state.activeBoard = id;
    persist();
    renderBoard();
  }

  function moveCursor(dc, dr) {
    const cur = state.cursor[state.activeBoard];
    cur.col = clamp(cur.col + dc, 0, COLS - 1);
    cur.row = clamp(cur.row + dr, 0, ROWS - 1);
    persist();
    renderBoard();
  }

  let confirmOpen = false;
  function toggleConfirm(open) {
    confirmOpen = open;
    $("#confirm").hidden = !open;
  }

  function toggleHelp(force) {
    state.help = typeof force === "boolean" ? force : !state.help;
    $("#help").hidden = !state.help;
  }

  // ---------------------------------------------------------- keyboard
  const DIGIT = { Digit1: 1, Digit2: 2, Digit3: 3, Numpad1: 1, Numpad2: 2, Numpad3: 3 };

  document.addEventListener("keydown", e => {
    if (e.altKey || e.metaKey) return;
    const key = e.key;

    if (confirmOpen) {
      e.preventDefault();
      if (e.repeat) return;
      if (key === "Enter") { toggleConfirm(false); startNewGame(); }
      else if (key === "Escape" || key === "Backspace") toggleConfirm(false);
      return;
    }

    if (e.code === "KeyH" && !e.ctrlKey) {
      e.preventDefault();
      if (!e.repeat) toggleHelp();
      return;
    }
    if (state.help) {
      if (key === "Escape" || key === "Backspace" || key === "Enter" || key === " ") {
        e.preventDefault();
        toggleHelp(false);
      }
      return;
    }

    if (state.view === "board") {
      if (DIGIT[e.code] && !e.shiftKey) {
        e.preventDefault();
        switchBoard(DIGIT[e.code]);
        return;
      }
      if (e.ctrlKey) return;
      switch (key) {
        case "ArrowLeft":  e.preventDefault(); moveCursor(-1, 0); return;
        case "ArrowRight": e.preventDefault(); moveCursor(1, 0); return;
        case "ArrowUp":    e.preventDefault(); moveCursor(0, -1); return;
        case "ArrowDown":  e.preventDefault(); moveCursor(0, 1); return;
        case "Enter":
        case " ":
          e.preventDefault();
          if (e.repeat) return;
          if (key === "Enter" && e.shiftKey) liftAll();
          else {
            const cur = state.cursor[state.activeBoard];
            openQuestion(cur.col, cur.row);
          }
          return;
        case "Backspace":
          e.preventDefault();
          return;
      }
      if (e.repeat) return;
      if (e.code === "KeyU") { e.preventDefault(); undo(); }
      else if (e.code === "KeyS" && !e.shiftKey) { e.preventDefault(); saveBackup(); }
      else if (e.code === "KeyL" && !e.shiftKey) { e.preventDefault(); fileInput.click(); }
      else if (e.code === "KeyN" && e.shiftKey) { e.preventDefault(); toggleConfirm(true); }
      return;
    }

    // question / answer
    if (e.ctrlKey) return;
    const pl = state.view === "question" ? curPlugin() : undefined;
    if (pl && pl.key && pl.key(e)) return;
    switch (key) {
      case " ":
      case "Enter":
      case "ArrowRight":
        e.preventDefault();
        if (!e.repeat) advance();
        return;
      case "ArrowLeft":
        e.preventDefault();
        if (!e.repeat) stepBack();
        return;
      case "Backspace":
      case "Escape":
        e.preventDefault();
        if (!e.repeat) closeQuestion(false);
        return;
    }
    if (e.code === "KeyR" && !e.repeat) {
      e.preventDefault();
      playClip();
    }
  });

  // ------------------------------------------------------------- mouse
  qv.addEventListener("click", e => {
    if (state.help) return;
    if (e.target.closest(".q-close")) { closeQuestion(false); return; }
    if (e.target.closest(".play-btn")) { playClip(); return; }
    if (e.target.closest(".q-action")) advance();
  });
  // Keep focus off the end-of-quiz link too, so Space/Enter keep driving the board.
  const tipLink = $("#end-tip a");
  if (tipLink) tipLink.addEventListener("mousedown", e => e.preventDefault());
  document.querySelectorAll(".board-tab").forEach(t => {
    // Keep focus off the tab, so Space/Enter afterwards still open a square instead of re-clicking it.
    t.addEventListener("mousedown", e => e.preventDefault());
    t.addEventListener("click", () => { if (state.view === "board") switchBoard(+t.dataset.board); });
  });
  $("#help").addEventListener("click", () => toggleHelp(false));
  $("#confirm").addEventListener("click", () => toggleConfirm(false));

  window.addEventListener("resize", fitQuestion);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitQuestion);

  // -------------------------------------------------------------- init
  if (QUIZ.meta) {
    if (QUIZ.meta.title) $("#title").textContent = QUIZ.meta.title;
    if (QUIZ.meta.subtitle) $("#kicker").textContent = QUIZ.meta.subtitle;
    // Keep the SEO <title> from the HTML head; only fall back if it's missing.
    if (!document.title) document.title = `${QUIZ.meta.title || "Quiz"} · ${QUIZ.meta.subtitle || ""}`;
  }
  Object.values(plugins).forEach(p => { if (p.init) p.init({ $, esc, track, state, qv, quiz: QUIZ, currentCell, fitQuestion, renderQuestion }); });

  const restored = loadStoredSession();
  if (restored) applySession(restored);
  else assignShuffles();

  // Category explainer pop-up (/assets/board-intro.js). Set-up notes are at the top of that file.
  if (window.BoardIntro) BoardIntro.init({
    quiz: QUIZ,
    storageKey: STORAGE_KEY + ":intro-seen",
    getBoardId: () => state.activeBoard,
    isBoardView: () => state.view === "board" && !state.help && !confirmOpen,
    hasProgress: id => state.answered[id].size > 0,
  });

  BoardUI.tip.init(CFG, {
    boardName: id => NAMES[id] || "Board " + id,
    boardDone: id => state.answered[id].size === ROWS * COLS,
    allDone: () => liftedTotal() === QUIZ.boards.length * ROWS * COLS,
    idle: () => state.view === "board" && !state.help && !confirmOpen && !document.querySelector(".bq-intro:not(.bq-tip):not([hidden])"),
    track
  });

  buildBoards();
  renderBoard();
  persist();

  if (restored && liftedTotal() > 0) {
    const when = restored.savedAt ? new Date(restored.savedAt)
      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    toast(`Picked up where you left off${when ? ` (saved ${when})` : ""}: ${liftedTotal()} squares lifted. <kbd>Shift</kbd>+<kbd>N</kbd> for a new game.`, 7000);
  }
})();
