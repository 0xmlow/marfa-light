#!/bin/sh
# Rebuild the images, film and engine the proposal site (proposal-site/) serves.
# Needs macOS sips and ffmpeg. Run from marfa-light/:  sh tools/proposal-assets.sh
set -e
OUT=proposal-site/img
mkdir -p "$OUT" renders/web

# the engine the page loads: the minified token script
cp dist/marfa-light.min.js proposal-site/marfa-light.js

# a still of every clock and every new place, 1400 px JPEG
for f in renders/v0.4/clock-*.png renders/v0.4/place-*.png; do
  sips -s format jpeg -s formatOptions 72 --resampleWidth 1400 "$f" --out "$OUT/$(basename "$f" .png).jpg" >/dev/null
done

# four GIF loops and the logo
cp renders/v0.4/gifs/noon-cannon-at-noon.gif renders/v0.4/gifs/station-clock.gif renders/v0.4/gifs/windmill-clock.gif renders/v0.4/gifs/pumpjack.gif "$OUT/"
cp site/img/logo_white.png "$OUT/"

# twelve Memories renderers, 640 px
for f in terminator_globe azimuthal_range compass_rose contour_stack antipode si_interference si_moire si_standing_wave si_aperture si_displace si_quantise si_horizon; do
  sips -s format jpeg -s formatOptions 76 --resampleWidth 640 "site/img/$f.jpg" --out "$OUT/mem-$f.jpg" >/dev/null
done

# the hype film at web size (about 12 MB, under the 15 MB artifact limit) and a poster
ffmpeg -v error -y -i renders/hype/cuts/marfa_light_hype_cuts_16x9-web_2026-09-27.mp4 -vf "scale=1280:-2,fps=24" \
  -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "$OUT/film.mp4"
ffmpeg -v error -y -ss 20 -i "$OUT/film.mp4" -frames:v 1 -q:v 4 "$OUT/film-poster.jpg"

# web cuts for the handoff: the film, the vertical film, the motion reel
cp "$OUT/film.mp4" renders/web/marfa-light-film-web.mp4
ffmpeg -v error -y -i renders/hype/cuts/marfa_light_hype_cuts_9x16_2026-09-27.mp4 -vf "scale=720:-2,fps=24" \
  -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart renders/web/marfa-light-film-vertical-web.mp4
if [ -f reel/out/mlow-motion-reel.mp4 ]; then
  ffmpeg -v error -y -i reel/out/mlow-motion-reel.mp4 -vf "scale=1280:-2" \
    -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart renders/web/mlow-motion-reel-web.mp4
fi
echo "proposal-site assets rebuilt"
