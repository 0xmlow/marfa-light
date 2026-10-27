/* The hype film block (ui/film.css). Picks the wide or the vertical cut by screen shape, loads only when
   it comes near the screen, plays muted while visible, and the sound button restarts it with sound. */
(function () {
  document.querySelectorAll('.fh-frame').forEach(function (frame) {
    var v = frame.querySelector('.fh-video'), b = frame.querySelector('.fh-sound'), loaded = false;
    var tall = false, widePoster = v.getAttribute('poster');
    function shape() {
      tall = matchMedia('(max-aspect-ratio: 4/5)').matches;
      frame.classList.toggle('tall', tall);
      v.poster = tall && v.dataset.posterTall ? v.dataset.posterTall : widePoster;
    }
    shape();
    function load() { if (loaded) return; loaded = true; shape(); v.src = tall ? v.dataset.tall : v.dataset.wide; }
    function label() { frame.classList.toggle('loud', !v.muted); b.lastChild.textContent = v.muted ? ' Sound on' : ' Sound off'; }
    if ('IntersectionObserver' in window) {
      // load a screen early, play only while a third of it is on screen
      new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting) load(); }, { rootMargin: '400px 0px' }).observe(frame);
      new IntersectionObserver(function (es) {
        // a fast scroll can batch leaving and coming back into one call: the last entry is the truth
        if (es[es.length - 1].isIntersecting) { load(); v.play().catch(function () {}); }
        else if (v.muted) v.pause();
      }, { threshold: .35 }).observe(frame);
    } else { load(); }
    function sound() {
      load(); v.muted = !v.muted;
      if (!v.muted) { v.currentTime = 0; v.loop = false; } else v.loop = true;
      v.play().catch(function () {}); label();
    }
    b.addEventListener('click', sound);
    v.addEventListener('click', sound);
    v.addEventListener('ended', function () { v.muted = true; v.loop = true; label(); v.play().catch(function () {}); });
    label();
  });
})();
