/* "More Bollywood quizzes and games": the one list of BollyQuiz pages.
   Every page has an empty <ul data-more-quizzes>, and this fills it in.
   To add a new quiz or landing page, add one line to PAGES. */
(function () {
  var PAGES = [
    { href: "/", label: "BollyQuiz home" },
    { href: "/quiz-1/", label: "First Day First Show" },
    { href: "/bollywood-quiz-questions/", label: "50 Bollywood quiz questions" },
    { href: "/bollywood-quiz-ppt/", label: "Bollywood quiz PPT" },
    { href: "/bollywood-emoji-quiz/", label: "Bollywood emoji quiz" }
  ];

  var here = location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll("[data-more-quizzes]").forEach(function (list) {
    PAGES.forEach(function (page) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = page.href;
      a.textContent = page.label;
      if (here === page.href) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      list.appendChild(li);
    });
  });
})();
