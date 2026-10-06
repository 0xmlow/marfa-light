#!/bin/sh
# Concatenates src/ into the single file Art Blocks runs.
#   ./build.sh            -> marfa-light.js, copied into site/
#   ./build.sh out.js     -> out.js only (for parallel work and tests)
cd "$(dirname "$0")"
OUT="${1:-marfa-light.js}"
{
cat <<'HEAD'
/*
  MARFA LIGHT // By MLow, V1
  Michael Low (MLow). mlow.xyz

  Every token is a working clock for Marfa, Texas, 30.3095 N 104.0206 W.
  The hash picks one of 29 clocks and its variations, one of 22 places, the
  material, the sky, the wind, the film stock, a quoted label, the easter eggs
  hidden around it, and a generative layer of lens, framing, condition, bloom,
  visitors, light work, birds, sky events and the rare anomaly. The sun, the moon, and the stars are computed for
  Marfa and for the minute you are looking.

  Art Blocks format. Reads tokenData.hash. Depends on three.js r124, which
  Art Blocks stores onchain. No network. Live mode reads the wall clock on
  purpose: it is a clock. Every feature comes from the hash alone.

  Keys: L live, T time-lapse, S residency minute, [ ] hour, , . day,
  Space hold, C view, F film, I label, P save a still, G save a GIF,
  Shift G save the day as a GIF, ? help. Drag to look. Click things.
*/
(function (root) {
  'use strict';
HEAD
for f in src/*.js; do cat "$f"; echo; done
echo '})(typeof window !== "undefined" ? window : globalThis);'
} > "$OUT"
if [ -z "$1" ]; then cp marfa-light.js site/marfa-light.js; fi
wc -c "$OUT"
