/* Hindi movie quiz: the 5-question warm-up. Three sets of 5; "Try 5 more" moves to the next set. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sets = [...document.querySelectorAll(".wset")];
  const dots = [...document.querySelectorAll("#dots i")];
  const nextBtn = document.getElementById("wnext");
  const result = document.getElementById("result");
  let set = 0, i = 0, score = 0;

  function cards() { return [...sets[set].querySelectorAll(".wq")]; }

  function show() {
    sets.forEach((s, n) => s.hidden = n !== set);
    cards().forEach((c, n) => c.hidden = n !== i);
    dots.forEach((d, n) => d.classList.toggle("now", n === i && !d.classList.contains("ok") && !d.classList.contains("no")));
    nextBtn.hidden = true;
  }

  function reset(card) {
    card.querySelectorAll(".opt").forEach(b => { b.disabled = false; b.classList.remove("right", "wrong"); });
    card.querySelector(".fact").hidden = true;
  }

  function start(n) {
    set = n; i = 0; score = 0;
    dots.forEach(d => d.className = "");
    cards().forEach(reset);
    result.hidden = true;
    document.getElementById("dots").hidden = false;
    show();
  }

  document.querySelectorAll(".opt").forEach(btn => btn.addEventListener("click", () => {
    const card = btn.closest(".wq");
    const ok = btn.dataset.ok === "1";
    card.querySelectorAll(".opt").forEach(b => {
      b.disabled = true;
      if (b.dataset.ok === "1") b.classList.add("right");
    });
    if (!ok) btn.classList.add("wrong");
    else { score++; confetti(btn); }
    dots[i].classList.remove("now");
    dots[i].classList.add(ok ? "ok" : "no");
    card.querySelector(".verdict").textContent = ok ? "Yes!" : "Not quite.";
    card.querySelector(".fact").hidden = false;
    nextBtn.innerHTML = i === 4 ? 'See your score <span aria-hidden="true">&rarr;</span>' : 'Next question <span aria-hidden="true">&rarr;</span>';
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
  }));

  nextBtn.addEventListener("click", () => {
    if (i < 4) { i++; show(); return; }
    cards().forEach(c => c.hidden = true);
    nextBtn.hidden = true;
    document.getElementById("dots").hidden = true;
    document.getElementById("rscore").textContent = score + "/5";
    document.getElementById("rline").textContent =
      score === 5 ? "Full marks. You're the one everyone wants on their team." :
      score >= 3 ? "Properly filmy. These weren't easy." :
      score >= 1 ? "Tough set. The board's more forgiving, promise." :
      "Zero. Good news: the board is a team game.";
    document.getElementById("again").textContent = set === sets.length - 1 ? "Start again" : "Try 5 more";
    result.hidden = false;
    try { if (window.umami) window.umami.track("warmup-finished", { score: score, set: set + 1 }); } catch (e) {}
  });

  document.getElementById("again").addEventListener("click", () => start((set + 1) % sets.length));

  function confetti(from) {
    if (reduce) return;
    const r = from.getBoundingClientRect();
    const colors = ["#E9A23B", "#D6457A", "#2E8B57", "#D2603F"];
    for (let n = 0; n < 12; n++) {
      const c = document.createElement("span");
      c.className = "confetti";
      c.style.background = colors[n % colors.length];
      c.style.left = r.left + r.width / 2 + "px";
      c.style.top = r.top + r.height / 2 + "px";
      document.body.appendChild(c);
      const a = Math.random() * Math.PI - Math.PI, d = 50 + Math.random() * 60;
      c.animate([
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: .55 },
        { transform: `translate(${Math.cos(a) * d * 1.2}px, ${Math.sin(a) * d + 70}px) rotate(${Math.random() * 540}deg)`, opacity: 0 }
      ], { duration: 900, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => c.remove();
    }
  }

  start(0);
})();
