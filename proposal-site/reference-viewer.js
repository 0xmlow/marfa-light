/* Website-only original artwork previews and player. No network in token code. */
(function () {
  'use strict';
  var names = ['Ringers', 'Fidenza', 'Archetype', 'Meridian'];
  var artists = ['Dmitri Cherniak', 'Tyler Hobbs', 'Kjetil Golid', 'Matt DesLauriers'];
  var $ = function (id) { return document.getElementById(id); }, active = null, returnFocus = null, currentUrl = '';
  function urls(ref) {
    var key = ref.chain + '/' + ref.contract + '/' + ref.id;
    return { image: 'https://media-proxy.artblocks.io/' + key + '.png', live: 'https://generator.artblocks.io/' + key, token: 'https://www.artblocks.io/token/' + key };
  }
  function open(ref) {
    var u = urls(ref), dlg = $('referenceDialog');
    returnFocus = document.activeElement;
    if (active) active.stop();
    $('referenceTitle').textContent = ref.name + ' #' + ref.n;
    $('referenceCredit').textContent = (ref.artist || artists[names.indexOf(ref.name)]) + ' · Original Art Blocks player. Token metadata lists CC BY-NC 4.0. This preview does not imply a collaboration or a separately granted licence.';
    $('referenceDirect').href = u.live; $('referenceToken').href = u.token;
    currentUrl = u.live; $('referenceFrame').src = u.live;
    if (!dlg.open) dlg.showModal(); $('referenceClose').focus();
  }
  $('referenceClose').onclick = function () { $('referenceDialog').close(); };
  $('referenceRetry').onclick = function () { $('referenceFrame').src = currentUrl; };
  $('referenceDialog').addEventListener('click', function (e) { if (e.target === this) this.close(); });
  $('referenceDialog').addEventListener('close', function () { $('referenceFrame').src = 'about:blank'; if (active) active.start(); if (returnFocus && returnFocus.isConnected) returnFocus.focus(); });
  window.MarfaReferences = { attach: function (api) {
    active = api; var W = api.world, alive = true, pending = 0, failed = 0;
    W.openReference = open;
    (W.disposers = W.disposers || []).push(function () { alive = false; if (active === api) active = null; });
    var buttons = $('referenceButtons'); buttons.textContent = '';
    names.forEach(function (name, i) {
      var ref = marfaLight.exhibits.reference(api.plan.hash, name); ref.artist = artists[i];
      var b = document.createElement('button'); b.className = 'btn'; b.textContent = name + ' #' + ref.n; b.onclick = function () { open(ref); }; buttons.appendChild(b);
    });
    var refs = W.referenceScreens || [];
    function status() { if (alive) $('referenceStatus').textContent = pending ? 'Loading ' + pending + ' original artwork preview' + (pending === 1 ? '' : 's') : failed ? 'Some previews are unavailable; the credited studies remain visible. The original players are available above.' : refs.length ? refs.length + ' original artwork preview' + (refs.length === 1 ? '' : 's') + ' in this scene. Click a display to play it.' : 'Choose an original above, or draw another token to find its display in the landscape.'; }
    pending = refs.length; status();
    refs.forEach(function (ref) {
      new THREE.TextureLoader().load(urls(ref).image, function (tex) {
        if (!alive) { tex.dispose(); return; }
        tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
        var old = ref.mesh.material.map; ref.mesh.material.map = tex; ref.mesh.material.color.setHex(0xffffff); ref.mesh.material.needsUpdate = true; if (old) old.dispose();
        pending--; status();
      }, undefined, function () { if (!alive) return; pending--; failed++; status(); });
    });
  } };
})();
