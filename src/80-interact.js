  // =====================================================================
  // INTERACT: click anything with a story, camera views, keys, captions
  // =====================================================================
  var HELP = [
    ['Drag', 'walk around'],
    ['Ctrl + scroll / pinch', 'move closer'],
    ['Click', 'read what you clicked'],
    ['L', 'live Marfa time'],
    ['T', 'time-lapse'],
    ['S', 'the residency minute'],
    ['A', 'the annual alignment minute'],
    ['J', 'the Fourth of July fireworks'],
    ['N', 'New Year at midnight'],
    ['K', 'the next day on the calendar'],
    ['[  ]', 'an hour back or on'],
    [',  .', 'a day back or on'],
    ['Space', 'hold time still'],
    ['C', 'change the view'],
    ['F', 'change the film'],
    ['I', 'show the label'],
    ['P', 'save a still (PNG)'],
    ['G', 'save three seconds (GIF)'],
    ['Shift G', 'save the whole day (GIF)'],
    ['?', 'these keys']
  ];
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  var CARD_CSS = 'position:absolute;z-index:5;max-width:340px;padding:12px 14px;background:rgba(13,13,13,0.82);color:#F0F4F8;' +
    'font:13px/1.45 Georgia,"Times New Roman",serif;pointer-events:none;transition:opacity .25s;border-left:3px solid #2962FF';
  function Interact(api, canvas, W, opts) {
    this.api = api; this.W = W; this.canvas = canvas;
    var host = opts.overlayHost || canvas.parentNode;
    if (host && host !== document.body && getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.card = el('div', CARD_CSS + ';left:14px;top:14px;opacity:0');
    this.help = el('div', CARD_CSS + ';right:14px;top:14px;opacity:0;border-left-color:#22D3EE');
    this.label = el('div', CARD_CSS + ';left:14px;bottom:14px;opacity:0;font:12px/1.5 Consolas,Menlo,monospace;letter-spacing:.04em;max-width:min(640px,calc(100% - 56px));columns:2 240px;column-gap:18px');
    if (host && opts.overlay !== false) { host.appendChild(this.card); host.appendChild(this.help); host.appendChild(this.label); }
    var h = '';
    HELP.forEach(function (q) { h += '<div><b style="font-family:Consolas,Menlo,monospace;display:inline-block;min-width:9em">' + q[0] + '</b>' + q[1] + '</div>'; });
    this.help.innerHTML = h;
    this.ray = new THREE.Raycaster();
    this.hideAt = 0;
  }
  Interact.prototype.say = function (name, line) {
    this.card.innerHTML = '';
    this.card.appendChild(el('div', 'font:11px Consolas,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#9BB3FF;margin-bottom:4px', name));
    this.card.appendChild(el('div', '', line));
    this.card.style.opacity = 1;
    this.hideAt = (root.performance ? performance.now() : 0) + 6500;
  };
  Interact.prototype.tick = function () {
    if (this.hideAt && root.performance && performance.now() > this.hideAt) { this.card.style.opacity = 0; this.hideAt = 0; }
  };
  Interact.prototype.toggleHelp = function () { this.help.style.opacity = this.help.style.opacity === '1' ? 0 : 1; };
  Interact.prototype.toggleLabel = function () {
    var F = this.W.P.features, t = this.api.getTime(), s = '';
    for (var k in F) s += '<div><span style="color:#8899AA">' + k + '</span> ' + F[k] + '</div>';
    s += '<div style="margin-top:6px;color:#9BB3FF">MARFA ' + pad2(t.h) + ':' + pad2(t.m) + ' ' + t.zone + '</div>';
    this.label.innerHTML = s;
    this.label.style.opacity = this.label.style.opacity === '1' ? 0 : 1;
  };
  Interact.prototype.click = function (x, y, cam) {
    var rect = this.canvas.getBoundingClientRect();
    var v = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(v, cam);
    var picks = this.W.picks, objs = picks.map(function (p) { return p.obj; });
    var hit = this.ray.intersectObjects(objs, true)[0];
    if (!hit) return null;
    for (var o = hit.object; o; o = o.parent) {
      for (var i = 0; i < picks.length; i++) if (picks[i].obj === o) { this.say(picks[i].name, picks[i].line); return picks[i]; }
    }
    return null;
  };
  Interact.prototype.dispose = function () {
    [this.card, this.help, this.label].forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
  };
