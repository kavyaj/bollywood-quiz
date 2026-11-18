/* Charades plug-in for the quiz board engine (/assets/board/board.js). Styles: /assets/board/charades.css.
   Handles squares whose "promptType" is "charade": the title is hidden, the actor holds Space (or the button)
   to peek, then a countdown runs while their team guesses.

   TO USE IT IN A QUIZ PAGE, load it before board.js:
     <link rel="stylesheet" href="/assets/board/charades.css">
     <script src="/assets/board/charades.js"></script>
     <script src="/assets/board/board.js"></script>
   In the quiz data, a charade cell is { "points": 10, "promptType": "charade", "prompt": "Dhoom", "answer": "Dhoom" },
   and QUIZ.meta.seconds sets the clock (default 60).

   HOW A PLUG-IN WORKS: it registers an object with window.BOARD_PLUGINS. The engine calls these hooks for squares of the
   plug-in's promptType. All hooks are optional except promptType.
     init(ctx)        once, at start-up. ctx = { $, esc, track, state, qv, quiz, currentCell, fitQuestion, renderQuestion }
     body(cell, p)    HTML for the question body. p is the prompt (after any shuffle).
     actionLabel(cell) text on the bottom-right button while the square is open (not used on the answer screen)
     open(cell)       a square of this type was just opened
     advance(cell)    Space/Enter/→ on the question screen. Return true if you used the key up; false to let the engine reveal the answer
     back()           ← on the question screen. Return true if you went back a step
     close()          the square is closing, so stop timers
     key(e)           any other key on the question screen. Return true if you handled it
     openEvent        analytics event name for opening a square of this type (default "square-open") */
(function () {
  "use strict";

  let $, esc, track, state, qv, quiz, currentCell, fitQuestion, renderQuestion;

  // A charade square has two phases before the answer:
  //   peek: the title is hidden; it shows only while Space (or the button) is held
  //   act:  the title is hidden for good and a countdown runs
  let SECONDS = 60;
  let ch = null;            // { phase, left, timer, paused }
  let beepCtx = null;
  const chEl = () => $(".ch", qv);

  function beep(freq, ms, vol) {
    try {
      beepCtx = beepCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (beepCtx.state === "suspended") beepCtx.resume();
      const o = beepCtx.createOscillator(), g = beepCtx.createGain(), t = beepCtx.currentTime;
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g).connect(beepCtx.destination); o.start(t); o.stop(t + ms / 1000 + 0.05);
    } catch (e) {}
  }

  function chPeek(on) {
    const el = chEl();
    if (!el || !ch || ch.phase !== "peek" || state.view !== "question") { if (el) el.classList.remove("peeking"); return; }
    if (on && !el.classList.contains("peeking")) track("charade-peek");
    el.classList.toggle("peeking", on);
  }

  function chPaint() {
    const el = chEl();
    if (!el || !ch) return;
    el.dataset.phase = ch.phase;
    el.classList.toggle("low", ch.phase === "act" && ch.left <= 10 && ch.left > 0);
    el.classList.toggle("over", ch.left === 0);
    el.classList.toggle("paused", !!ch.paused);
    $(".ch-time", el).textContent = ch.left;
    $(".ch-bar i", el).style.setProperty("--p", ch.left / SECONDS);
    $(".ch-msg", el).textContent = ch.left === 0 ? "Time's up! Other team: one guess for half the points."
      : ch.paused ? "Paused. Press P to carry on." : "";
  }

  function chStopTimer() { if (ch && ch.timer) { clearInterval(ch.timer); ch.timer = null; } }

  function chRun() {
    chStopTimer();
    ch.paused = false;
    ch.timer = setInterval(() => {
      if (!ch) return;
      ch.left = Math.max(0, ch.left - 1);
      if (ch.left === 0) { chStopTimer(); beep(220, 900, 0.25); }
      else if (ch.left <= 5) beep(880, 90, 0.12);
      chPaint();
    }, 1000);
  }

  function chStart() {           // peek -> act, or restart the clock
    const el = chEl();
    if (el) el.classList.remove("peeking");
    ch.phase = "act";
    ch.left = SECONDS;
    chPaint();
    chRun();
    fitQuestion();
  }

  function chPause() {
    if (!ch || ch.phase !== "act" || ch.left === 0 || state.view !== "question") return;
    if (ch.timer) { chStopTimer(); ch.paused = true; } else chRun();
    chPaint();
  }

  function chBackToPeek() {
    chStopTimer();
    ch.phase = "peek"; ch.left = SECONDS; ch.paused = false;
    chPaint();
    fitQuestion();
  }

  const plugin = {
    promptType: "charade",
    openEvent: "charade-open",

    init(ctx) {
      ({ $, esc, track, state, qv, quiz, currentCell, fitQuestion, renderQuestion } = ctx);
      SECONDS = (quiz.meta && quiz.meta.seconds) || 60;

      document.addEventListener("keyup", e => { if (e.key === " ") chPeek(false); });
      window.addEventListener("blur", () => chPeek(false));
      qv.addEventListener("pointerdown", e => {
        if (!e.target.closest(".ch-hold")) return;
        e.preventDefault();
        chPeek(true);
      });
      ["pointerup", "pointercancel"].forEach(type => document.addEventListener(type, () => chPeek(false)));
      qv.addEventListener("contextmenu", e => { if (e.target.closest(".ch-hold")) e.preventDefault(); });
    },

    body(cell, p) {
      const words = String(cell.answer).trim().split(/\s+/).length;
      return `<div class="ch" data-phase="peek">
          <div class="ch-eyes display">Everyone except the actor: eyes closed!</div>
          <div class="ch-card"><div class="ch-title display">${esc(p)}</div><div class="ch-cover display" aria-hidden="true">???</div></div>
          <div class="ch-hold display" role="button">Hold to peek</div>
          <div class="ch-hint">Actor: hold <kbd>Space</kbd>, or press and hold the button. Let go and it hides.</div>
          <div class="ch-clock">
            <div class="ch-words display">${words} word${words === 1 ? "" : "s"}</div>
            <div class="ch-time display outlined">${SECONDS}</div>
            <div class="ch-bar"><i></i></div>
            <div class="ch-msg display"></div>
          </div>
        </div>`;
    },

    actionLabel() {
      return ch && ch.phase === "act" ? "Show the title" : "Start the clock";
    },

    open() {
      ch = { phase: "peek", left: SECONDS, timer: null, paused: false };
    },

    advance() {
      if (ch.phase === "peek") { chStart(); renderQuestion(); return true; }
      chStopTimer(); ch.paused = false; chPaint();
      return false;
    },

    back() {
      if (ch.phase !== "act") return false;
      chBackToPeek();
      return true;
    },

    close() {
      chStopTimer();
      ch = null;
    },

    key(e) {
      if (ch.phase === "peek" && e.key === " ") { e.preventDefault(); chPeek(true); return true; }
      if (ch.phase === "act" && !e.repeat) {
        if (e.code === "KeyP") { e.preventDefault(); chPause(); return true; }
        if (e.code === "KeyR") { e.preventDefault(); chStart(); return true; }
      }
      return false;
    }
  };

  (window.BOARD_PLUGINS = window.BOARD_PLUGINS || []).push(plugin);
})();
