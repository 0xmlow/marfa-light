/* Marfa Light FX (2026-10-22). The moving parts every page shares, no build step:
     smooth scroll (Lenis, when present), an intro counter, magnetic brass buttons, a brass cursor ring,
     word reveals, die-cut stickers you can peel and throw, the sticky mint bar, the poster corridor
     (a 3D stack flown through by scroll) and pinned sideways chapters.
   Ideas taken from the reference sites MLow collected (unveil.fr's z-stack, dirtverse.co's statements,
   lovefrom.com's typed reveal) and from Awwwards Sites of the Day, rebuilt in the Marfa kit's objects.
   Everything stops under prefers-reduced-motion, and nothing here is needed to mint. */
(function () {
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = matchMedia('(pointer: fine)').matches;
  var root = document.documentElement;
  var FX = window.MLFX = {};
  var ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
             set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  // ---------- smooth scroll ----------
  var lenis = null;
  if (!RM && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.95 });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      var t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -70 }); }
    });
  }
  FX.lenis = lenis;

  // ---------- intro counter: the number of clocks already keeping time ----------
  FX.preload = function (target) {
    var el = document.getElementById('preload');
    if (!el) return;
    if (RM || ss.get('ml-intro')) { el.remove(); root.classList.add('ready'); return; }
    ss.set('ml-intro', '1');
    var n = el.querySelector('.pl-n'), t0 = performance.now(), dur = 1500, goal = target || 0;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      n.textContent = String(Math.round(goal * e)).padStart(3, '0');
      el.style.setProperty('--p', e);
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(function () { el.classList.add('out'); root.classList.add('ready'); setTimeout(function () { el.remove(); }, 900); }, 380);
    })(t0);
  };

  // ---------- magnetic buttons ----------
  if (FINE && !RM) {
    document.addEventListener('pointermove', function (e) {
      document.querySelectorAll('[data-magnetic]').forEach(function (b) {
        var r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), reach = Math.max(r.width, r.height) * 0.9;
        if (d < reach) { var k = (1 - d / reach) * 0.35; b.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)'; b.classList.add('mag'); }
        else if (b.classList.contains('mag')) { b.style.transform = ''; b.classList.remove('mag'); }
      });
    }, { passive: true });
  }

  // ---------- the brass cursor ring ----------
  if (FINE && !RM) {
    var ring = document.createElement('div'); ring.className = 'fx-cursor'; ring.innerHTML = '<i></i><span></span>';
    document.body.appendChild(ring);
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    document.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; ring.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', function () { ring.classList.remove('on'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest && e.target.closest('a, button, [data-cursor], .sticker, select, input');
      ring.classList.toggle('big', !!t);
      var label = t && t.getAttribute && t.getAttribute('data-cursor');
      ring.querySelector('span').textContent = label || '';
      ring.classList.toggle('label', !!label);
    });
    (function follow() { rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2; ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)'; requestAnimationFrame(follow); })();
  }

  // ---------- reveals ----------
  function splitWords(el) {
    if (el.dataset.splitDone) return; el.dataset.splitDone = 1;
    var walk = function (node) {
      Array.from(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            var o = document.createElement('span'); o.className = 'w'; var i = document.createElement('span'); i.textContent = w; o.appendChild(i); frag.appendChild(o);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1 && !c.classList.contains('w')) walk(c);
      });
    };
    walk(el);
    el.querySelectorAll('.w > span').forEach(function (s, i) { s.style.transitionDelay = (i * 0.045) + 's'; });
  }
  FX.reveal = function (scope) {
    var els = (scope || document).querySelectorAll('[data-split], [data-reveal]');
    els.forEach(function (el) { if (el.hasAttribute('data-split')) splitWords(el); });
    if (RM || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  };

  // ---------- stickers: peel, drag, throw ----------
  FX.stickers = function (layer) {
    if (!layer) return;
    layer.querySelectorAll('.sticker').forEach(function (s) {
      var x = 0, y = 0, r = parseFloat(s.dataset.r || 0), sx, sy, ox, oy, vx = 0, vy = 0, lt = 0, lx = 0, ly = 0, dragging = false;
      var put = function () { s.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + r + 'deg)' + (dragging ? ' scale(1.08)' : ''); };
      put();
      s.addEventListener('pointerdown', function (e) {
        e.preventDefault(); dragging = true; s.setPointerCapture(e.pointerId); s.classList.add('lift');
        sx = e.clientX; sy = e.clientY; ox = x; oy = y; lx = e.clientX; ly = e.clientY; lt = performance.now();
        s.style.zIndex = (FX._z = (FX._z || 20) + 1); put();
      });
      s.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var now = performance.now(), dt = Math.max(1, now - lt);
        vx = (e.clientX - lx) / dt; vy = (e.clientY - ly) / dt; lx = e.clientX; ly = e.clientY; lt = now;
        x = ox + e.clientX - sx; y = oy + e.clientY - sy; r = Math.max(-28, Math.min(28, r + vx * 1.6)); put();
      });
      var drop = function () {
        if (!dragging) return; dragging = false; s.classList.remove('lift');
        if (RM) { put(); return; }
        // a little throw, then it sticks where it lands
        var f = 0; (function coast() { x += vx * 14; y += vy * 14; vx *= 0.82; vy *= 0.82; put(); if (++f < 16 && (Math.abs(vx) + Math.abs(vy)) > 0.02) requestAnimationFrame(coast); })();
        s.classList.add('slap'); setTimeout(function () { s.classList.remove('slap'); }, 320);
      };
      s.addEventListener('pointerup', drop); s.addEventListener('pointercancel', drop);
      s.addEventListener('dblclick', function () { r += 360; s.style.transition = 'transform .8s cubic-bezier(.2,.7,.2,1)'; put(); setTimeout(function () { s.style.transition = ''; }, 820); });
    });
  };

  // ---------- the sticky mint bar ----------
  FX.mintbar = function (watch) {
    var bar = document.getElementById('mintbar'); if (!bar) return;
    var show = function (on) { bar.classList.toggle('show', on); };
    if (!watch || !('IntersectionObserver' in window)) { show(true); return; }
    new IntersectionObserver(function (es) { show(!es[0].isIntersecting); }, { threshold: 0 }).observe(watch);
  };
  FX.count = function (c) {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var k = el.getAttribute('data-count');
      el.textContent = k === 'left' ? c.left : k === 'supply' ? c.supply : k === 'max' ? c.max : k === 'next' ? '#' + c.supply : el.textContent;
    });
    document.querySelectorAll('[data-count-bar]').forEach(function (el) { el.style.width = (c.supply / c.max * 100).toFixed(1) + '%'; });
  };

  // ---------- pinned scenes: progress 0..1 while a tall section passes ----------
  var scenes = [];
  FX.scene = function (el, fn) { scenes.push({ el: el, fn: fn }); tickScenes(); };
  function tickScenes() {
    var vh = innerHeight;
    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect(), span = r.height - vh;
      var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : (r.top < vh ? 1 : 0);
      if (r.bottom > -vh && r.top < vh * 2) s.fn(p, r);
    });
  }
  var queued = false;
  var onScroll = function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; tickScenes(); }); } };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
  if (lenis) lenis.on('scroll', onScroll);

  // the poster corridor: posters hang at depth, the scroll walks you past them
  FX.corridor = function (sec) {
    if (!sec) return;
    var items = Array.from(sec.querySelectorAll('.cor-item')), gap = 520, n = items.length;
    items.forEach(function (it, i) {
      var side = i % 2 ? 1 : -1, lane = (i % 4 < 2 ? 1 : 0.55);
      it.dataset.x = side * lane * 30; it.dataset.y = ((i * 37) % 5 - 2) * 4; it.dataset.z = -i * gap;
    });
    FX.scene(sec, function (p) {
      var cam = p * (n - 1) * gap + 200;
      items.forEach(function (it) {
        var z = +it.dataset.z + cam, vis = z > 900 ? 0 : z < -n * gap ? 0 : Math.min(1, (900 - z) / 300) * Math.min(1, (z + 3200) / 1800);
        it.style.transform = 'translate3d(' + it.dataset.x + 'vw,' + it.dataset.y + 'vh,' + z + 'px)';
        it.style.opacity = vis.toFixed(3);
      });
      var lab = sec.querySelector('.cor-count'); if (lab) lab.textContent = String(Math.min(n, 1 + Math.floor(p * n))).padStart(2, '0') + ' / ' + n;
    });
  };

  // pinned sideways chapters
  FX.sideways = function (sec) {
    if (!sec) return;
    var track = sec.querySelector('.side-track');
    var size = function () { sec.style.height = (track.scrollWidth - innerWidth + innerHeight) + 'px'; };
    size(); addEventListener('resize', size); addEventListener('load', size);
    FX.scene(sec, function (p) {
      track.style.transform = 'translate3d(' + (-p * (track.scrollWidth - innerWidth)) + 'px,0,0)';
      var bar = sec.querySelector('.side-prog i'); if (bar) bar.style.width = (p * 100) + '%';
    });
  };

  // a parallax drift for anything marked data-depth
  FX.parallax = function () {
    if (RM) return;
    var els = Array.from(document.querySelectorAll('[data-depth]'));
    // measured from the element's own section, so a layer far down the page is still in place when you reach it
    var go = function () { els.forEach(function (el) { var r = el.parentElement.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return;
      var off = r.top + r.height / 2 - innerHeight / 2; el.style.translate = '0 ' + (-off * parseFloat(el.dataset.depth)).toFixed(1) + 'px'; }); };
    addEventListener('scroll', function () { requestAnimationFrame(go); }, { passive: true }); go();
  };

  // a burst of stickers and brass from a point: the mint celebration
  FX.burst = function (x, y, srcs) {
    if (RM) return;
    for (var i = 0; i < 26; i++) {
      var d = document.createElement(srcs && i % 3 === 0 ? 'img' : 'i');
      d.className = 'fx-burst';
      if (d.tagName === 'IMG') { d.src = srcs[i % srcs.length]; d.alt = ''; d.style.width = '64px'; }
      var a = Math.random() * Math.PI * 2, v = 160 + Math.random() * 380;
      d.style.left = x + 'px'; d.style.top = y + 'px';
      d.style.setProperty('--dx', Math.cos(a) * v + 'px'); d.style.setProperty('--dy', (Math.sin(a) * v - 180) + 'px');
      d.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(d); setTimeout(function (n) { n.remove(); }.bind(null, d), 1600);
    }
  };

  document.addEventListener('DOMContentLoaded', function () { FX.reveal(); FX.parallax(); });
})();
