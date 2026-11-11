/* 50 Bollywood quiz questions: round tabs, reveal, scoring, confetti and print. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tabs = [...document.querySelectorAll(".tab")];
  const panels = [...document.querySelectorAll(".panel")];
  const marks = {};                       // question number -> 1 or 0
  const pill = document.getElementById("pill");
  const star = document.getElementById("star");

  /* ---------- tabs ---------- */
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

  /* ---------- reveal + mark ---------- */
  document.querySelectorAll(".card").forEach(card => {
    const show = card.querySelector(".show");
    const ans = card.querySelector(".ans");
    show.addEventListener("click", () => {
      ans.hidden = false;
      show.hidden = true;
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

  function update() {
    const vals = Object.values(marks);
    document.getElementById("right").textContent = vals.filter(v => v === 1).length;
    document.getElementById("played").textContent = vals.length + "/50 played";
    pill.classList.toggle("on", vals.length > 0);
    panels.forEach(p => {
      const qs = [...p.querySelectorAll(".card")].map(c => c.dataset.q);
      const done = qs.filter(q => q in marks);
      const got = done.filter(q => marks[q] === 1).length;
      const count = document.querySelector(`[data-count="${p.id}"]`);
      const summary = p.querySelector(".round-score");
      count.textContent = done.length ? `${got}/${qs.length}` : "";
      if (done.length === qs.length) {
        const msg = got >= 9 ? "Full paisa vasool!" : got >= 6 ? "Solid round!" : got >= 3 ? "Not bad. Rewatch night?" : "The aunties will be hearing about this.";
        if (!summary.classList.contains("done")) summary.classList.add("done");
        summary.textContent = `${got}/${qs.length}. ${msg}`;
      } else {
        summary.classList.remove("done");
        summary.textContent = done.length ? `${done.length} of ${qs.length} done` : "";
      }
    });
  }

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
      const a = Math.random() * Math.PI - Math.PI;     // upward fan
      const d = 50 + Math.random() * 60;
      c.animate([
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: .55 },
        { transform: `translate(${Math.cos(a) * d * 1.2}px, ${Math.sin(a) * d + 70}px) rotate(${Math.random() * 540}deg)`, opacity: 0 }
      ], { duration: 900, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => c.remove();
    }
  }

  /* ---------- reset + print ---------- */
  document.getElementById("reset").addEventListener("click", () => {
    for (const k in marks) delete marks[k];
    document.querySelectorAll(".card").forEach(c => {
      c.classList.remove("right", "wrong");
      c.querySelector(".ans").hidden = true;
      const s = c.querySelector(".show"); s.hidden = false; s.setAttribute("aria-expanded", "false");
      c.querySelectorAll(".mark button").forEach(b => b.setAttribute("aria-pressed", "false"));
    });
    update();
    select(panels[0].id);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
  document.getElementById("print").addEventListener("click", () => window.print());
})();
