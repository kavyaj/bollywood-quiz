# Ticket quiz

One ticket at a time, with the question as the hero. Shared by the song, emoji, dialogues and 50-questions pages.

- `ticket-quiz.css` the card, buttons, answer panel and one-at-a-time flow
- `ticket-quiz.js` tabs, hint, reveal, scoring, share, start over, print and the flow itself

Everything is added to cards that are already in the page's HTML. Every question, hint and answer stays in the source, so search engines and readers without JavaScript see the whole list.
Without JavaScript the page shows every ticket; add this to the page's `<head>` so hints and answers are open too (see `bollywood-song-quiz/index.html`):

```html
<noscript><style>.ans[hidden]{display:flex!important}.hint[hidden],.panel[hidden]{display:block!important}.show,.hint-btn,.tabs,.mark,.score-pill{display:none!important}</style></noscript>
```

## Add it to a page

1. In `<head>`, load `/assets/ticket-quiz/ticket-quiz.css` after the page's own stylesheet (and `/assets/light-pages.css`, which supplies the colours).
2. Before `</body>`, set the config and load the script:

```html
<script>window.TICKET_QUIZ = {
  name: "Bollywood song quiz",                       // used in share text
  pageUrl: "https://bollyquiz.com/bollywood-song-quiz/",
  noun: "song",                                      // "Next song"
  verdicts: [[9, "Antakshari champion!"], [6, "Proper filmy."], [3, "Not bad."], [0, "Time for a playlist."]]
};</script>
<script src="/assets/ticket-quiz/ticket-quiz.js"></script>
```

3. Mark up each level as a `.panel` (id = the tab's `data-round`) and each question as a card:

```html
<li class="card" data-q="1">                  <!-- data-q is unique across the whole page -->
  <div class="stub" aria-hidden="true"><small>Song</small><b>1</b><span>of 10</span></div>
  <div class="tbody">
    <p class="qn sr">Song 1</p>              <!-- same text as the stub, for screen readers -->
    <p class="fmt">The title in English</p>  <!-- small label above the clue (optional) -->
    <div class="line"><p class="clue">My shoes are Japanese.</p></div>
    <!-- .clue.long = a long clue, .clue.emo = emoji; <p class="mean"> = optional English meaning -->
    <div class="acts">
      <button type="button" class="hint-btn" aria-expanded="false" aria-controls="h1">Hint</button>   <!-- optional -->
      <button type="button" class="show" aria-expanded="false" aria-controls="a1">Show answer</button>
    </div>
    <p class="hint" id="h1" hidden>Raj Kapoor, 1955</p>                                                 <!-- optional -->
    <div class="ans" id="a1" hidden>
      <p class="a">Mera Joota Hai Japani</p>
      <p class="why">One line about the answer.</p>                                                    <!-- optional -->
      <div class="mark">
        <button type="button" class="yes" data-v="1" aria-pressed="false">Got it</button>
        <button type="button" class="no" data-v="0" aria-pressed="false">Missed it</button>
      </div>
    </div>
  </div>
</li>
```

Each panel also needs `.round-end` with a `.round-score` (and optionally a `.share-wrap` with a `.share` button and a `.next[data-go]` button). The page needs `.tabs` with `.tab[data-round]`, and the score pill (`#pill`, `#right`, `#played`, `#star`, `#reset`). Copy `bollywood-song-quiz/index.html` as a starting point. Set `oneAtATime: false` in the config to show every ticket at once.
