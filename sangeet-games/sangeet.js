/* Sangeet games page: the demo couple board and the print button. */
(() => {
  const BOARD = [["Kaun Bola?", "Who said it: Riya, Kabir or both?", [[10, "“I'll just rest my eyes for five minutes.” Said at the movies, on their first date.", "Kabir. He slept through the entire second half."], [20, "“We are not getting a dog until we have a bigger flat.”", "Riya. Kabir had already named the dog Laddoo."], [30, "“That's not a fight. That's a discussion.”", "Both. Every single time."]]], ["First Date Kahani", "Their love story, told in emoji.", [[10, "☕️ 🌧️ 🚕", "They met at a café, it poured, and they shared the last cab home."], [20, "🎤 🙈 🍕", "Karaoke night. Kabir sang off-key, Riya pretended not to know him, then they got pizza."], [30, "✈️ ⏰ 🏃", "Kabir nearly missed the flight to meet Riya's parents. He ran. The airline waited. Barely."]]], ["Kiska Rishtedaar?", "Whose side of the family?", [[10, "Pinky Masi, who has already planned the baby shower.", "Riya's side."], [20, "Chachu, who brings his own speaker to every party.", "Kabir's side."], [30, "Dadi, who has never lost a game of antakshari.", "Riya's dadi. Kabir has called her Dadi since the roka."]]], ["Kiski Aadat?", "Whose habit is it?", [[10, "Sets an alarm every five minutes from 6 am.", "Riya."], [20, "Leaves exactly one sip of chai in every cup.", "Kabir."], [30, "Talks to the plants by name.", "Both. The money plant is called Sharmaji."]]], ["Unki Playlist", "The songs from their story. Whose pick, which moment?", [[10, "The song playing in the café when they first met.", "Tum Hi Ho, from Aashiqui 2. Riya still goes quiet when it comes on."], [20, "Kabir's pick for their first dance. Riya vetoed it.", "Kala Chashma, from Baar Baar Dekho. They settled on a slow one."], [30, "The song Riya's dadi asks the DJ to play at every family function.", "Lag Ja Gale, from Woh Kaun Thi (1964). Kabir now requests it for her."]]]];
  const card = document.getElementById("dbCard");
  const cat = document.getElementById("dbCat"), q = document.getElementById("dbQ"), a = document.getElementById("dbA");
  const showBtn = document.getElementById("dbShow"), backBtn = document.getElementById("dbBack");
  const done = document.getElementById("dbDone");
  let current = null;

  function open(tile) {
    current = tile;
    const [name, hint, qs] = BOARD[+tile.dataset.c];
    const [pts, question, answer] = qs[+tile.dataset.r];
    cat.textContent = name + " \u00b7 " + pts + " points";
    q.textContent = question;
    a.textContent = answer;
    a.hidden = true;
    showBtn.hidden = false;
    card.hidden = false;
    showBtn.focus({ preventScroll: true });
    try { if (window.umami) window.umami.track("sangeet-demo-open"); } catch (e) {}
  }
  function close() {
    card.hidden = true;
    if (current) {
      current.classList.add("done");
      current.setAttribute("aria-label", current.getAttribute("aria-label").replace(/, opened$/, "") + ", opened");
      done.textContent = document.querySelectorAll(".db-t.done").length;
      current.focus({ preventScroll: true });
    }
    current = null;
  }
  document.querySelectorAll(".db-t").forEach(t => t.addEventListener("click", () => open(t)));
  showBtn.addEventListener("click", () => { a.hidden = false; showBtn.hidden = true; backBtn.focus({ preventScroll: true }); });
  backBtn.addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !card.hidden) close(); });

  const printBtn = document.getElementById("printQs");
  if (printBtn) printBtn.addEventListener("click", () => {
    document.body.classList.add("print-questions");
    window.print();
    setTimeout(() => document.body.classList.remove("print-questions"), 500);
  });
})();
