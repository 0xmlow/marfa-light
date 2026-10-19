/* Marfa Light kit: the sky phase (with its own sun model when the engine is not on the page),
   the shadow direction every card uses, a light that follows the pointer, the menu, and the
   brass sparks a click throws. No dependencies. */
(function () {
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var K = window.MLKit = {};

  // sun and moon over Marfa (30.3095 N, 104.0206 W). Good to a degree, enough to light a page.
  var LAT = 30.3095 * Math.PI / 180, LON = -104.0206;
  function sunPos(t) {
    var d = t / 86400 - 10957.5;                      // days since J2000
    var g = (357.529 + 0.98560028 * d) * Math.PI / 180, q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180, e = (23.439 - 0.00000036 * d) * Math.PI / 180;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24, lst = ((gmst + LON / 15) % 24 + 24) % 24;
    var ha = lst * Math.PI / 12 - ra;
    var el = Math.asin(Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(ha));
    var az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(LAT) - Math.sin(LAT) * Math.cos(ha));
    return { el: el * 180 / Math.PI, az: ((az * 180 / Math.PI) + 360) % 360 };
  }
  K.sunPos = sunPos;
  K.phase = function (el) { return el < -12 ? 'night' : el < -0.5 ? 'twilight' : el < 14 ? 'golden' : 'day'; };

  // the shadow a wall label casts: away from the sun, longer as it drops; the moon takes over at night,
  // and with neither up the light is ambient and falls straight down the page
  K.setSun = function (sunAz, sunEl, moonAz, moonEl) {
    var az = null, el = 0, soft = 1;
    if (sunEl > 0) { az = sunAz; el = sunEl; } else if (moonEl != null && moonEl > 0) { az = moonAz; el = moonEl; soft = 1.6; }
    var dx = 0, dy = 14, len = 34;
    if (az != null) {
      var k = 8 + 26 * (1 - Math.min(1, Math.max(0, el / 70)));
      var a = az * Math.PI / 180; dx = -Math.sin(a) * k; dy = -Math.cos(a) * k * .6 + 8; len = (24 + k) * soft;
    }
    root.style.setProperty('--sdx', dx.toFixed(1)); root.style.setProperty('--sdy', dy.toFixed(1)); root.style.setProperty('--slen', len.toFixed(0));
  };
  K.paintSky = function () {
    var s = sunPos(Date.now() / 1000), p = K.phase(s.el);
    if (root.getAttribute('data-sky') !== p) root.setAttribute('data-sky', p);
    K.setSun(s.az, s.el, null, null);
    var b = document.getElementById('barSky'); if (b) b.textContent = 'Marfa sky · ' + { night: 'Night', twilight: 'Twilight', golden: 'Low sun', day: 'Day' }[p] + ' · sun ' + Math.round(s.el) + '°';
  };
  // paint once now so the page has its sky before any engine loads; a page with the real
  // engine (window.MARFA_SKY_OWNER) then keeps the sky itself with the accurate model
  K.paintSky(); if (!window.MARFA_SKY_OWNER) setInterval(K.paintSky, 60000);

  // a light that follows the pointer on buttons and cards
  var SEL = '.btn,.seg button,.ml-card,.week,.bar .links a';
  document.addEventListener('pointermove', function (e) {
    var b = e.target.closest && e.target.closest(SEL); if (!b) return;
    var r = b.getBoundingClientRect();
    b.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    b.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }, { passive: true });

  // the menu: MORE opens a board; on phones the burger lists everything
  document.addEventListener('click', function (e) {
    var mb = e.target.closest && e.target.closest('.more-b');
    var more = document.querySelector('.bar .more');
    if (mb && more) { var open = more.classList.toggle('open'); mb.setAttribute('aria-expanded', open ? 'true' : 'false'); return; }
    if (more && !e.target.closest('.bar .more')) { more.classList.remove('open'); var b2 = more.querySelector('.more-b'); if (b2) b2.setAttribute('aria-expanded', 'false'); }
    var bg = e.target.closest && e.target.closest('.bar .burger');
    var links = document.querySelector('.bar .links');
    if (bg && links) { var o = links.classList.toggle('open'); bg.setAttribute('aria-expanded', o ? 'true' : 'false'); return; }
    if (links && e.target.closest('.bar .links a')) { links.classList.remove('open'); var bb = document.querySelector('.bar .burger'); if (bb) bb.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var m = document.querySelector('.bar .more.open'); if (m) m.classList.remove('open'); var l = document.querySelector('.bar .links.open'); if (l) l.classList.remove('open'); } });

  // which stop is lit: the section in view
  var stops = Array.prototype.slice.call(document.querySelectorAll('.bar .links a[href^="#"]'));
  if (stops.length && 'IntersectionObserver' in window) {
    var byId = {}; stops.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { stops.forEach(function (a) { a.classList.remove('on'); }); var a = byId[x.target.id]; if (a) a.classList.add('on'); } }); }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  if (RM) return;
  // a press swipes the plaque and throws a few brass sparks from the pointer
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.btn,.seg button'); if (!b || b.disabled) return;
    b.classList.remove('swiped'); void b.offsetWidth; b.classList.add('swiped');
    for (var i = 0, n = 6; i < n; i++) {
      var f = document.createElement('i'); f.className = 'ml-pop';
      var a = Math.PI * 2 * i / n + Math.random() * .7, d = 28 + Math.random() * 30;
      f.style.cssText = 'left:' + e.clientX + 'px;top:' + e.clientY + 'px;--dx:' + (Math.cos(a) * d).toFixed(0) + 'px;--dy:' + (Math.sin(a) * d - 10).toFixed(0) + 'px';
      document.body.appendChild(f); setTimeout(function (el) { el.remove(); }.bind(null, f), 750);
    }
  });
})();
