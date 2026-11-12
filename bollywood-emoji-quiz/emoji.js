/* Bollywood emoji quiz: level tabs, hint/answer/score, share, and the tap-the-coin tip jar (Ko-fi ref=bollyquiz-emoji). */
(() => {
  const PAGE_URL = "https://bollyquiz.com/bollywood-emoji-quiz/";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tabs = [...document.querySelectorAll(".tab")];
  const panels = [...document.querySelectorAll(".panel")];
  const marks = {};
  const pill = document.getElementById("pill");
  const star = document.getElementById("star");

  /* ---------- level tabs ---------- */
  function select(id, focus) {
    tabs.forEach(t => {
      const on = t.dataset.round === id;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach(p => p.hidden = p.id !== id);
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* sandboxed previews block this; harmless */ }
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t.dataset.round));
    t.addEventListener("keydown", e => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length].dataset.round, true);
    });
  });
  const start = location.hash.slice(1);
  if (panels.some(p => p.id === start)) select(start);

  document.querySelectorAll("button.next").forEach(b => b.addEventListener("click", () => {
    select(b.dataset.go);
    document.querySelector(".tabs").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }));

  /* ---------- hint, reveal, mark ---------- */
  document.querySelectorAll(".card").forEach(card => {
    const hintBtn = card.querySelector(".hint-btn");
    const hint = card.querySelector(".hint");
    const show = card.querySelector(".show");
    const ans = card.querySelector(".ans");
    hintBtn.addEventListener("click", () => {
      hint.hidden = false;
      hintBtn.setAttribute("aria-expanded", "true");
      show.focus({ preventScroll: true });
    });
    show.addEventListener("click", () => {
      ans.hidden = false;
      show.hidden = true;
      hintBtn.hidden = true;
      show.setAttribute("aria-expanded", "true");
      ans.querySelector(".yes").focus({ preventScroll: true });
    });
    card.querySelectorAll(".mark button").forEach(btn => btn.addEventListener("click", () => {
      const v = +btn.dataset.v;
      const was = marks[card.dataset.q];
      marks[card.dataset.q] = v;
      card.querySelectorAll(".mark button").forEach(b => b.setAttribute("aria-pressed", b === btn));
      card.classList.toggle("right", v === 1);
      card.classList.toggle("wrong", v === 0);
      if (v === 1 && was !== 1) { confetti(btn); bump(); }
      if (v === 0 && was !== 0 && !reduce) { card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
      update();
    }));
  });

  const scores = {};
  function update() {
    const vals = Object.values(marks);
    document.getElementById("right").textContent = vals.filter(v => v === 1).length;
    document.getElementById("played").textContent = vals.length + "/30 played";
    pill.classList.toggle("on", vals.length > 0);
    panels.forEach(p => {
      const qs = [...p.querySelectorAll(".card")].map(c => c.dataset.q);
      const done = qs.filter(q => q in marks);
      const got = done.filter(q => marks[q] === 1).length;
      const count = document.querySelector(`[data-count="${p.id}"]`);
      const summary = p.querySelector(".round-score");
      const share = p.querySelector(".share-wrap");
      count.textContent = done.length ? `${got}/${qs.length}` : "";
      if (done.length === qs.length) {
        const msg = got >= 9 ? "Emoji ustaad!" : got >= 6 ? "Proper filmy." : got >= 3 ? "Not bad. Rewatch night?" : "The emojis won this one.";
        summary.classList.add("done");
        summary.textContent = `${got}/${qs.length}. ${msg}`;
        scores[p.id] = got;
        const justFinished = share.hidden;
        share.hidden = false;
        // The first time a level is finished, bring the score and Share button to the middle of the screen,
        // so the floating score pill (bottom of the screen, with its Start over button) can't sit on top of them.
        if (justFinished) share.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      } else {
        summary.classList.remove("done");
        summary.textContent = done.length ? `${done.length} of ${qs.length} done` : "";
        share.hidden = true;
      }
    });
  }

  /* ---------- share score ---------- */
  document.querySelectorAll(".share").forEach(btn => btn.addEventListener("click", async () => {
    const level = btn.dataset.level, name = btn.dataset.name;
    const text = `I got ${scores[level]}/10 on the Bollywood emoji quiz (${name} level). Can you beat me?`;
    const url = PAGE_URL + "#" + level;
    const note = btn.parentElement.querySelector(".copied");
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: "Bollywood emoji quiz", text, url }); } catch (e) { /* cancelled */ }
      return;
    }
    const full = text + " " + url;
    try { await navigator.clipboard.writeText(full); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = full; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      ta.remove();
    }
    note.textContent = "Copied! Paste it in your group chat.";
    setTimeout(() => { note.textContent = ""; }, 3500);
  }));

  function bump() {
    if (reduce) return;
    star.classList.remove("bump"); void star.getBoundingClientRect(); star.classList.add("bump");
  }

  function confetti(from) {
    if (reduce) return;
    const r = from.getBoundingClientRect();
    const colors = ["#E9A23B", "#D6457A", "#2E8B57", "#D2603F"];
    for (let i = 0; i < 14; i++) {
      const c = document.createElement("span");
      c.className = "confetti";
      c.style.background = colors[i % colors.length];
      c.style.left = r.left + r.width / 2 + "px";
      c.style.top = r.top + r.height / 2 + "px";
      document.body.appendChild(c);
      const a = Math.random() * Math.PI - Math.PI;
      const d = 50 + Math.random() * 60;
      c.animate([
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: .55 },
        { transform: `translate(${Math.cos(a) * d * 1.2}px, ${Math.sin(a) * d + 70}px) rotate(${Math.random() * 540}deg)`, opacity: 0 }
      ], { duration: 900, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => c.remove();
    }
  }

  /* ---------- start over ---------- */
  document.getElementById("reset").addEventListener("click", () => {
    for (const k in marks) delete marks[k];
    document.querySelectorAll(".card").forEach(c => {
      c.classList.remove("right", "wrong");
      c.querySelector(".ans").hidden = true;
      c.querySelector(".hint").hidden = true;
      const h = c.querySelector(".hint-btn"); h.hidden = false; h.setAttribute("aria-expanded", "false");
      const s = c.querySelector(".show"); s.hidden = false; s.setAttribute("aria-expanded", "false");
      c.querySelectorAll(".mark button").forEach(b => b.setAttribute("aria-pressed", "false"));
    });
    update();
    select(panels[0].id);
    document.querySelector(".tabs").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
})();

(() => {
  const KOFI_URL = "https://ko-fi.com/kavyaj?ref=bollyquiz-emoji";
  const DROP_MS = 650;   // keep under ~1s so Safari still allows the new tab
  const coin = document.getElementById("tjCoin"), face = coin.querySelector(".tj-face");
  const stage = document.getElementById("tjStage"), pile = document.getElementById("tjPile"), wrap = document.getElementById("tjWrap");
  const hint = document.getElementById("tjHint"), thanks = document.getElementById("tjThanks"), fallback = document.getElementById("tjFallback");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let busy = false, audio;
  const NS = "http://www.w3.org/2000/svg", stacks = [{ x: 56, n: 0 }, { x: 82, n: 0 }, { x: 106, n: 0 }], order = [1, 0, 2, 1, 0, 2, 1];
  let dropped = 0;
  function addPileCoin() {
    const s = stacks[order[dropped % order.length]], y = 168 - s.n * 5, nx = s.x + (Math.random() * 2 - 1);
    const g = document.createElementNS(NS, "g");
    g.innerHTML = `<rect x="${nx - 14}" y="${y}" width="28" height="4" fill="#b8862b"/><ellipse cx="${nx}" cy="${y + 4}" rx="14" ry="3.5" fill="#b8862b"/><ellipse cx="${nx}" cy="${y}" rx="14" ry="3.5" fill="#f2c14e"/>`;
    pile.appendChild(g); s.n++; dropped++;
  }
  for (let i = 0; i < 6; i++) addPileCoin();
  function getAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (e) {} return audio; }
  function clink() {
    const a = getAudio(); if (!a) return; const t0 = a.currentTime;
    const hit = (t, f, v) => { const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.4); };
    hit(t0, 2400, 0.22); hit(t0, 3600, 0.08); hit(t0 + 0.08, 2700, 0.08);
  }
  function ripple() {
    const r = document.createElement("span"); r.className = "tj-ripple"; stage.appendChild(r);
    r.animate([{ transform: "scale(.5)", opacity: .9 }, { transform: "scale(1.5)", opacity: 0 }], { duration: 600, easing: "ease-out" }).onfinish = () => r.remove();
  }
  function openKofi() {
    const w = window.open(KOFI_URL, "_blank"); if (w) { try { w.opener = null; } catch (e) {} }
    hint.hidden = true; thanks.hidden = false; fallback.hidden = false;
  }
  function land() {
    clink(); addPileCoin();
    if (!reduce) { ripple(); wrap.animate([{ transform: "rotate(0)" }, { transform: "rotate(-1.5deg)" }, { transform: "rotate(1deg)" }, { transform: "rotate(0)" }], { duration: 380, easing: "ease-out" }); }
  }
  function resetCoin() {
    coin.getAnimations().forEach(a => a.cancel()); coin.classList.add("idle");
    coin.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 300, easing: "ease-out" }).onfinish = () => { busy = false; };
  }
  coin.addEventListener("click", () => {
    if (busy) return; busy = true; getAudio(); coin.classList.remove("idle");
    if (reduce) { land(); openKofi(); busy = false; return; }
    face.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(.2)" }, { transform: "scaleX(1)" }], { duration: DROP_MS * .55, iterations: 2, easing: "ease-in-out" });
    const fall = coin.animate([
      { transform: "translateY(0) scale(1)", offset: 0 },
      { transform: "translateY(-16px) scale(1)", offset: .25, easing: "ease-in" },
      { transform: "translateY(88px) scale(.92)", offset: .7 },
      { transform: "translateY(150px) scale(.85)", opacity: 0, offset: 1 }
    ], { duration: DROP_MS, fill: "forwards" });
    fall.onfinish = () => { land(); openKofi(); setTimeout(resetCoin, 900); };
  });
})();
