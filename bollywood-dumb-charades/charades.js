/* Bollywood dumb charades: the random movie picker.
   Phases: idle -> hidden (hold to peek) -> acting (60s clock) -> shown. The titles are the same 100 as the lists on the page. */
(() => {
  const NAMES = {"easy": ["Dangal", "Lagaan", "Sultan", "Dabangg", "Singham", "Krrish", "Chennai Express", "Hera Pheri", "Golmaal", "Welcome", "Dhamaal", "Race", "Don", "Fanaa", "Dostana", "Kick", "War", "Pathaan", "Jawan", "Stree", "Drishyam", "Queen", "Piku", "Taal", "Rockstar"], "medium": ["Jab We Met", "Kal Ho Naa Ho", "Dil Chahta Hai", "Om Shanti Om", "Rang De Basanti", "Chak De! India", "Taare Zameen Par", "Zindagi Na Milegi Dobara", "Yeh Jawaani Hai Deewani", "Bhaag Milkha Bhaag", "Kabhi Khushi Kabhie Gham", "Main Hoon Na", "Lage Raho Munna Bhai", "Andaz Apna Apna", "Dil To Pagal Hai", "Kaho Naa... Pyaar Hai", "Mohabbatein", "Dil Dhadakne Do", "Band Baaja Baaraat", "Ae Dil Hai Mushkil", "Aashiqui 2", "Barfi!", "Khosla Ka Ghosla", "Bhool Bhulaiyaa", "Koi... Mil Gaya"], "hard": ["Masaan", "Tumbbad", "Maqbool", "Omkara", "Kaminey", "Ishqiya", "Paheli", "Lakshya", "Yuva", "Saathiya", "Parineeta", "Guzaarish", "Saawariya", "Raanjhanaa", "Highway", "Kahaani", "Talaash", "Udaan", "Newton", "Pink", "Article 15", "Badla", "Raazi", "Tamasha", "Airlift"], "tough": ["Jaane Bhi Do Yaaro", "Humpty Sharma Ki Dulhania", "Rab Ne Bana Di Jodi", "Kabhi Alvida Naa Kehna", "Pyaar Ka Punchnama", "Sonu Ke Titu Ki Sweety", "Lipstick Under My Burkha", "Shubh Mangal Saavdhan", "Dum Laga Ke Haisha", "Bareilly Ki Barfi", "Zara Hatke Zara Bachke", "Tu Jhoothi Main Makkaar", "Rocky Aur Rani Kii Prem Kahaani", "Badrinath Ki Dulhania", "Qayamat Se Qayamat Tak", "Hum Hain Rahi Pyar Ke", "Dil Hai Ke Manta Nahin", "Kabhi Haan Kabhi Naa", "Phir Bhi Dil Hai Hindustani", "Matru Ki Bijlee Ka Mandola", "Oye Lucky! Lucky Oye!", "Mere Baap Pehle Aap", "Bheja Fry", "Phas Gaye Re Obama", "Ek Main Aur Ekk Tu"]};
  const LABELS = {"easy": "Easy", "medium": "Medium", "hard": "Hard", "tough": "Good luck"};
  const SECONDS = 60;
  const $ = id => document.getElementById(id);
  const pick = $("pick"), title = $("pickTitle"), cover = $("pickCover"), time = $("pickTime"), bar = $("pickBar"), msg = $("pickMsg"), level = $("pickLevel");
  const hold = $("hold"), startBtn = $("startClock"), showBtn = $("showTitle"), newBtn = $("newMovie");
  const chips = [...document.querySelectorAll("#picker .chip")];
  let want = "any", used = new Set(), left = SECONDS, timer = null, audio = null;

  function beep(freq, ms, vol) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + ms / 1000 + 0.05);
    } catch (e) {}
  }

  function stopClock() { clearInterval(timer); timer = null; }

  function phase(p) {
    pick.dataset.phase = p;
    pick.classList.remove("peeking", "low");
    hold.hidden = p !== "hidden";
    startBtn.hidden = p !== "hidden";
    showBtn.hidden = p !== "acting";
    time.hidden = p !== "acting";
    bar.hidden = p !== "acting";
    newBtn.classList.toggle("quiet", p === "hidden" || p === "acting");
    newBtn.textContent = p === "idle" ? "New movie" : p === "shown" ? "Next movie" : "Skip this one";
    cover.innerHTML = p === "idle" ? "<span>Tap <b>New movie</b> to begin</span>" : p === "hidden" ? "<span>Everyone else: eyes closed!</span>" : "";
    cover.hidden = p === "acting" || p === "shown";
  }

  function newMovie() {
    stopClock();
    const levels = want === "any" ? Object.keys(NAMES) : [want];
    let pool = levels.flatMap(l => NAMES[l].map(t => [l, t])).filter(([, t]) => !used.has(t));
    if (!pool.length) { levels.forEach(l => NAMES[l].forEach(t => used.delete(t))); pool = levels.flatMap(l => NAMES[l].map(t => [l, t])); }
    const [l, t] = pool[Math.floor(Math.random() * pool.length)];
    used.add(t);
    title.textContent = t;
    const words = t.trim().split(/\s+/).length;
    level.textContent = LABELS[l] + " \u00b7 " + words + (words === 1 ? " word" : " words");
    msg.textContent = "Actor: hold the button to see the title. Let go and it hides.";
    phase("hidden");
    try { if (window.umami) window.umami.track("charades-pick", { level: l }); } catch (e) {}
  }

  function peek(on) {
    if (pick.dataset.phase !== "hidden") return;
    pick.classList.toggle("peeking", on);
  }

  function paint() {
    time.textContent = left;
    bar.firstElementChild.style.setProperty("--p", left / SECONDS);
    pick.classList.toggle("low", left <= 10);
  }

  function startClock() {
    left = SECONDS;
    phase("acting");
    paint();
    msg.textContent = "Act it out. No talking!";
    timer = setInterval(() => {
      left = Math.max(0, left - 1);
      paint();
      if (left === 0) { stopClock(); beep(220, 900, 0.25); show("Time's up! The other team gets one guess."); }
      else if (left <= 5) beep(880, 90, 0.12);
    }, 1000);
  }

  function show(text) {
    stopClock();
    phase("shown");
    msg.textContent = text || "Did they get it?";
  }

  hold.addEventListener("pointerdown", e => { e.preventDefault(); peek(true); });
  ["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, () => peek(false)));
  hold.addEventListener("contextmenu", e => e.preventDefault());
  hold.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); peek(true); } });
  hold.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") peek(false); });
  hold.addEventListener("blur", () => peek(false));
  window.addEventListener("blur", () => peek(false));
  startBtn.addEventListener("click", startClock);
  showBtn.addEventListener("click", () => show());
  newBtn.addEventListener("click", newMovie);
  chips.forEach(c => c.addEventListener("click", () => {
    want = c.dataset.level;
    chips.forEach(x => x.setAttribute("aria-pressed", x === c));
    if (pick.dataset.phase !== "acting") newMovie();
  }));
  phase("idle");
})();
