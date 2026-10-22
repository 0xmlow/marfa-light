/* The about page's moving parts. Uses ../ui/fx.js. */
(function () {
  var FX = window.MLFX, $ = function (id) { return document.getElementById(id); };
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // a typed headline, after lovefrom.com
  var t = $('typeLine');
  if (t && !RM) {
    var full = t.dataset.text, i = 0; t.textContent = '';
    setTimeout(function step() { t.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(step, 70 + Math.random() * 60); else t.parentElement.classList.add('typed'); }, 450);
  }

  // counters roll up when they come into view
  var counts = document.querySelectorAll('.a-count b');
  var run = function (b) {
    var to = +b.dataset.to, plus = b.hasAttribute('data-plus'), t0 = performance.now(), d = RM ? 1 : 1400;
    (function f(now) { var p = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - p, 3); b.textContent = Math.round(to * e).toLocaleString('en-US') + (plus && p === 1 ? '+' : ''); if (p < 1) requestAnimationFrame(f); })(t0);
  };
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }); }, { threshold: .6 });
    counts.forEach(function (b) { io.observe(b); });
  } else counts.forEach(run);

  // the story: a sun crosses the arc as you read, and the gnomon's shadow swings under it
  var story = $('story');
  if (story) FX.scene(story, function (p) {
    var a = Math.PI * (1 - p), cx = 200 + Math.cos(a) * 180, cy = 210 - Math.sin(a) * 180;
    $('sunDot').setAttribute('cx', cx.toFixed(1)); $('sunDot').setAttribute('cy', cy.toFixed(1));
    $('sunHalo').setAttribute('cx', cx.toFixed(1)); $('sunHalo').setAttribute('cy', cy.toFixed(1));
    var len = Math.min(170, 50 / Math.max(0.12, Math.tan(Math.max(0.05, Math.sin(a) * 1.2))));
    $('shadow').setAttribute('x2', (200 - Math.cos(a) * len).toFixed(1));
    var mins = Math.round(6 * 60 + 42 + p * (19 * 60 + 18 - 6 * 60 - 42));
    var hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
    $('skyTime').textContent = hh + ':' + mm + (p < .04 ? ' · sunrise over Marfa' : p > .96 ? ' · sunset over Marfa' : Math.abs(p - .5) < .04 ? ' · solar noon in Marfa' : ' · Marfa time');
  });

  var mq = $('mq');
  if (mq) { var L = ['Light is the measure', 'Time has gravity', 'Read the night', 'Take your time', 'Seconds bloom', 'The shadow gets here first', 'Stand still, the Earth won\'t'];
    var h = L.map(function (l) { return '<span>' + l + '</span>'; }).join(''); mq.innerHTML = h + h; }

  FX.stickers($('board'));
  FX.mintbar(document.querySelector('.a-hero'));
  fetch('../data/holders.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    .then(function (d) { FX.count({ supply: d.supply, max: d.max, left: d.available }); }).catch(function () {});
})();
