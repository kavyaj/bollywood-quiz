/* Bollywood quiz PPT page: the tap-the-coin tip jar (Ko-fi ref=bollyquiz-ppt). */
(() => {
  const KOFI_URL = "https://ko-fi.com/kavyaj?ref=bollyquiz-ppt";
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
