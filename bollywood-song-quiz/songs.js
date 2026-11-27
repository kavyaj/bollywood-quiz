/* Bollywood song quiz: level tabs, hint/answer/score and share. Same engine as /bollywood-emoji-quiz/emoji.js. The tip jar is /assets/tipjar.js. */
(() => {
  const PAGE_URL = "https://bollyquiz.com/bollywood-song-quiz/";
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

  /* ---------- one ticket at a time ----------
     Every question and answer stays in the page's HTML. This only adds a class to each level and shows one card at a time,
     so crawlers and readers without JavaScript still get the full list. */
  const flow = {};
  panels.forEach(p => {
    const cards = [...p.querySelectorAll(".card")];
    const strip = document.createElement("div");
    strip.className = "prog";
    p.querySelector(".cards").before(strip);
    const f = flow[p.id] = { i: 0, cards, strip };
    cards.forEach((c, k) => {
      const nb = document.createElement("button");
      nb.type = "button";
      nb.className = "next-song";
      nb.hidden = true;
      nb.textContent = k === cards.length - 1 ? "See my score" : "Next song";
      nb.addEventListener("click", () => {
        if (k === cards.length - 1) {
          p.classList.add("finished");
          drawProgress(p.id);
          p.querySelector(".round-end").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        } else {
          goTo(p.id, k + 1, true);
        }
      });
      c.querySelector(".tbody").append(nb);
      c.querySelectorAll(".mark button").forEach(b => b.addEventListener("click", () => {
        nb.hidden = false;
        drawProgress(p.id);
      }));
    });
    p.classList.add("one");
    goTo(p.id, 0, false);
  });

  function drawProgress(id) {
    const f = flow[id];
    f.strip.innerHTML = "";
    f.cards.forEach((c, k) => {
      const v = marks[c.dataset.q];
      const t = document.createElement("button");
      t.type = "button";
      t.className = "prog-tick" + (k === f.i && !f.strip.parentElement.classList.contains("finished") ? " now" : "") + (v === 1 ? " right" : v === 0 ? " wrong" : "");
      t.setAttribute("aria-label", `Go to song ${k + 1}` + (v === 1 ? ", got it" : v === 0 ? ", missed it" : ""));
      t.addEventListener("click", () => { f.strip.parentElement.classList.remove("finished"); goTo(id, k, true); });
      f.strip.append(t);
    });
    const n = document.createElement("span");
    n.className = "prog-count";
    n.textContent = f.strip.parentElement.classList.contains("finished") ? "Done" : `${f.i + 1} of ${f.cards.length}`;
    f.strip.append(n);
  }

  function goTo(id, k, focus) {
    const f = flow[id];
    f.i = k;
    f.cards.forEach((c, j) => c.classList.toggle("current", j === k));
    drawProgress(id);
    if (focus) {
      const c = f.cards[k];
      const target = c.querySelector(".show:not([hidden])") || c.querySelector(".mark .yes");
      if (target) target.focus({ preventScroll: true });
      c.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    }
  }

  const scores = {};
  function update() {
    const vals = Object.values(marks);
    document.getElementById("right").textContent = vals.filter(v => v === 1).length;
    document.getElementById("played").textContent = vals.length + "/20 played";
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
        const msg = got >= 9 ? "Antakshari champion!" : got >= 6 ? "Proper filmy." : got >= 3 ? "Not bad. Your uncle would be proud." : "Time for a Bollywood playlist.";
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
    const text = `I got ${scores[level]}/10 on the Bollywood song quiz (${name} level). Can you beat me?`;
    const url = PAGE_URL + "#" + level;
    const note = btn.parentElement.querySelector(".copied");
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: "Bollywood song quiz", text, url }); } catch (e) { /* cancelled */ }
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
    panels.forEach(p => {
      p.classList.remove("finished");
      flow[p.id].cards.forEach(c => { c.querySelector(".next-song").hidden = true; });
      goTo(p.id, 0, false);
    });
    update();
    select(panels[0].id);
    document.querySelector(".tabs").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
})();
