/* The mint page's scenes (the sale itself lives in index.html). Uses ../ui/fx.js. */
(function () {
  var FX = window.MLFX, $ = function (id) { return document.getElementById(id); };
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the 29 clocks, as the engine renders them (img/clock-NN-name.jpg)
  var CLOCKS = ['horizontal-sundial', 'analemmatic-sundial', 'armillary-sphere', 'split-flap-board', 'flip-monument', 'orbital', 'blossom-binary',
    'solar-henge', 'concourse-clock', 'water-clock', 'hourglass', 'word-clock', 'kinetic-pin-field', 'skeleton-clock', 'astronomical-clock', 'motel-sign',
    'water-tower-clock', 'heliochronometer', 'noon-cannon', 'meridian-obelisk', 'wall-dial', 'nocturnal', 'bow-dial', 'foucault-pendulum', 'candle-clock',
    'station-clock', 'scoreboard', 'pumpjack', 'windmill-clock'].map(function (s, i) {
      return { src: '../img/clock-' + String(i + 1).padStart(2, '0') + '-' + s + '.jpg', name: s.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) };
    });
  var PLACES = ['Highway 90', 'Chinati Field', 'Marfa Lights Viewing Area', 'Railroad Depot', 'Salt Playa', 'Mesa Rim', 'Arroyo', 'Adobe Courtyard', 'Ghost Town',
    'Hot Springs', 'Drive-In Lot', 'Rodeo Arena', 'Observatory Ridge', 'Highland Avenue', 'Artillery Shed', 'Empty Pool', 'Aerostat Field', 'Prairie Terrace',
    'Meridian Cloister', 'Aeolian Court', 'Contour Passage', 'Hadid Pavilion'];
  var LIGHTS = [{ name: 'Golden hour', src: '../media/sky/golden-s.webp' }, { name: 'Before dawn', src: '../media/sky/dawn-s.webp' },
    { name: 'High noon', src: '../media/sky/noon-s.webp' }, { name: 'Deep night', src: '../media/sky/night-s.webp' }];
  var LINES = ['Light is the measure', 'Somewhere it is Marfa time', 'Time has gravity', 'Stay a little longer', 'Every grain is a moment', 'Read the night',
    'Time flows here', 'One minute once a year', 'Time keeps watch', 'Take your time', 'Seconds bloom', 'Now is departing', 'The shadow gets here first',
    'Stand still, the Earth won\'t', 'The wind remembers every hour'];

  // ---------- marquee ----------
  var mq = $('mq');
  if (mq) { var html = LINES.map(function (l) { return '<span>' + l + '</span>'; }).join(''); mq.innerHTML = html + html; }

  // ---------- stickers + mint bar ----------
  FX.stickers($('heroStickers'));
  FX.mintbar(document.getElementById('mint-dock'));

  // ---------- how a clock is born ----------
  var how = $('how'), steps = how ? how.querySelectorAll('.how-steps li') : [], vis = how ? how.querySelectorAll('.hv') : [], cur = -1;
  var hex = '0123456789abcdef', rollT = null;
  function roll() {
    var el = $('hashRoll'); if (!el) return;
    clearInterval(rollT); var n = 0;
    rollT = setInterval(function () {
      var s = '0x'; for (var i = 0; i < 64; i++) s += hex[(Math.random() * 16) | 0];
      el.textContent = s; if (++n > 26) clearInterval(rollT);
    }, 55);
  }
  var clockI = 17;
  function showStep(i) {
    if (i === cur) return; cur = i;
    steps.forEach(function (li, k) { li.classList.toggle('on', k === i); li.classList.toggle('past', k < i); });
    vis.forEach(function (v, k) { v.classList.toggle('on', k === i); });
    if (i === 1) roll();
    if (i === 2) { clockI = (clockI + 7) % CLOCKS.length; $('howClock').src = CLOCKS[clockI].src; $('howClockCap').textContent = CLOCKS[clockI].name + ' · ' + PLACES[(clockI * 5) % PLACES.length]; }
  }
  if (how) FX.scene(how, function (p) { showStep(Math.min(3, Math.floor(p * 4.0001))); });

  // ---------- pull the lever ----------
  var REEL_H = 0;
  function fillReel(id, items, img) {
    var strip = document.querySelector('#' + id + ' .strip'); if (!strip) return;
    var list = []; for (var r = 0; r < 4; r++) list = list.concat(items);
    strip.innerHTML = list.map(function (it) {
      return '<div class="cell">' + (img ? '<img src="' + it.src + '" alt="" loading="lazy" width="120" height="120">' : '') + '<span>' + (it.name || it) + '</span></div>';
    }).join('');
    strip._n = items.length;
  }
  fillReel('reelClock', CLOCKS, true); fillReel('reelPlace', PLACES, false); fillReel('reelLight', LIGHTS, true);
  function spinReel(id, idx, delay) {
    return new Promise(function (res) {
      var strip = document.querySelector('#' + id + ' .strip'), cell = strip.firstElementChild.getBoundingClientRect().height;
      var target = (strip._n * 2 + idx) * cell;
      strip.style.transition = 'none'; strip.style.transform = 'translateY(0)'; strip.offsetHeight;
      strip.style.transition = RM ? 'none' : 'transform ' + (1.4 + delay) + 's cubic-bezier(.12,.75,.2,1.02)';
      strip.style.transform = 'translateY(' + (-target) + 'px)';
      setTimeout(res, RM ? 0 : (1.4 + delay) * 1000);
    });
  }
  var spinning = false;
  function pull() {
    if (spinning) return; spinning = true;
    var lever = $('lever'); lever.classList.add('pulled'); setTimeout(function () { lever.classList.remove('pulled'); }, 600);
    var c = (Math.random() * CLOCKS.length) | 0, p = (Math.random() * PLACES.length) | 0, l = (Math.random() * LIGHTS.length) | 0;
    Promise.all([spinReel('reelClock', c, 0), spinReel('reelPlace', p, .35), spinReel('reelLight', l, .7)]).then(function () {
      $('slotClock').src = CLOCKS[c].src; $('slotSky').src = LIGHTS[l].src;
      $('slotLabel').textContent = CLOCKS[c].name + ' · ' + PLACES[p] + ' · ' + LIGHTS[l].name;
      var card = $('slotCard'); card.classList.remove('hit'); card.offsetWidth; card.classList.add('hit');
      var b = card.getBoundingClientRect(); FX.burst(b.left + b.width / 2, b.top + b.height / 3);
      $('slotOdds').textContent = 'One possible draw of about ' + (CLOCKS.length * PLACES.length * 4) + ' pairings, before the other 41 traits';
      spinning = false;
    });
  }
  if ($('lever')) $('lever').addEventListener('click', pull);
  window.MLSlot = { places: function () {} };

  // ---------- corridor + chapters, from media/media.json ----------
  fetch('../media/media.json').then(function (r) { return r.json(); }).then(function (m) {
    var world = $('corWorld');
    if (world) {
      world.innerHTML = m.posters.map(function (p) {
        var t = p.id.replace(/^\d+-/, '').replace(/-/g, ' ');
        return '<figure class="cor-item"><img src="../media/posters/' + p.id + '.webp" alt="Marfa Light poster: ' + t + '" loading="lazy" width="' + p.w + '" height="' + p.h + '"><figcaption>' + p.id.slice(0, 2) + ' · ' + t + '</figcaption></figure>';
      }).join('');
      FX.corridor($('posters'));
    }
    var track = $('sideTrack');
    if (track) {
      var caps = { 'shadow-job': 'My shadow has a full time job.', 'departure-denied': 'Your delay has been extended forever.', 'clock-said': 'The clock has a lot to say.',
        'pins-and-needles': 'Waiting on pins and needles.', 'solar-powered': 'Solar powered. Emotionally unavailable.', 'loud-noon': 'Sorry, my noon is loud.',
        'cloud-excuse': 'I\'m not late. It\'s cloudy.', 'flexible-hours': 'I asked for flexible hours.', 'train-of-thought': 'Missed my train of thought.', 'extra-time': 'I demand extra time.' };
      m.panoramas.forEach(function (p, i) {
        var k = p.id.replace(/^\d+-/, '');
        var d = document.createElement('figure'); d.className = 'side-card';
        d.style.width = 'calc(var(--ph) * ' + (p.w / p.h).toFixed(3) + ')';
        d.innerHTML = '<img src="../media/pano/' + p.id + '.webp" alt="' + (caps[k] || k) + '" loading="lazy" width="' + p.w + '" height="' + p.h + '">' +
          '<figcaption class="side-cap"><span class="k">' + String(i + 1).padStart(2, '0') + ' / ' + m.panoramas.length + '</span></figcaption>';
        track.appendChild(d);
      });
      FX.sideways($('chapters'));
    }
    FX.reveal();
  });
})();
