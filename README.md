# Marfa Light

**A long-form generative series by MLow.** Every token is a working clock for Marfa, Texas (30.3095° N, 104.0206° W), standing somewhere around town, keeping live Marfa time. The hash decides the clock, how it is made, where it stands, the weather, the wind, the film it is shot on, the label it wears, and what is hidden around it. The sun, the moon and the stars are computed for Marfa and for the minute you are looking.

Working title. Prototype v0.4.1, September 2026. **Live site: https://0xmlow.github.io/marfa-light/** Made for the Art Blocks x OpenSea Artist Residency in Marfa.

![Marfa Light](proposal-site/img/clock-01-horizontal-sundial.jpg)

## What is in a token

| | |
|---|---|
| **Clocks** | 29 kinds. Nine read the sky: sundials of every major type (horizontal, analemmatic, armillary, wall, bow, heliochronometer, meridian obelisk, noon cannon) and a nocturnal that reads the stars. The rest keep time by flaps, water, sand, words, pins, gears, fire, bulbs, strokes, wind, neon, and the turning of the Earth under a Foucault pendulum. Each has two or three variation traits of its own. |
| **Places** | 19 places around Marfa and the Big Bend, each with the real mountain skyline on the horizon. Roofed places refuse clocks that need the sun or the open air. |
| **Easter eggs** | 30 of them, two to seven per token: Marfa, Art Blocks homages, and MLow's own collections. Click one to read about it. |
| **Generative layer** | Nine traits every token carries, from their own stream of the hash: Lens, Framing, Condition, Ground Bloom, Visitors, Light Work, Birds, Sky Event, and a rare Anomaly. Sky events obey the real sky: a rainbow needs a monsoon and a low sun behind you, sun dogs sit 22° from the sun, meteors wait for full dark. |
| **Sky** | Clear, Scattered, Monsoon (lightning at night), Dust, Blue Norther. The sun, moon phase and stars are real. |
| **Film** | Seven stocks: Clean, Kodachrome, Ektachrome, Velvia, Cinestill (halation), Polaroid, Tri-X (black and white). |
| **Label** | Every clock wears a museum label in quotation marks with one safety orange zip tie. |

The full list, generated from the code, is in [docs/CATALOGUE.md](docs/CATALOGUE.md). How often each trait appears is in [docs/TRAITS.md](docs/TRAITS.md).

## How it keeps time

- **Live** (default): Marfa's real time, Central with daylight saving, computed without a Date object. A token keeps Marfa time wherever it is shown.
- **Time-lapse**: a day in 96 seconds.
- **Residency minute**: the one minute of April 2027 the hash chose, for thumbnails and stills.

The sundials are built for latitude 30.3°. Their hour lines are corrected for Marfa's longitude, 56 minutes behind the Central meridian, so the shadow reads clock time to within the equation of time. About two in three horizontal dials carry a noon mark: a bead on the gnomon whose shadow walks a figure eight through the year (the analemma, computed from the same sun model), and some add the solstice and equinox date lines. Read the bead's shadow against the figure and the dial is right to the minute. After dark the moon casts the same shadow and reads wrong, the way real dials do.

## Controls

| | |
|---|---|
| Drag | walk around the clock |
| Scroll (Ctrl + scroll on a page), pinch | move closer |
| Click | read what you clicked; click the clock for a close-up |
| L / T / S | live, time-lapse, residency minute |
| [ ] | an hour back or on |
| , . | a day back or on |
| Space | hold time still |
| C | cycle views: hero, close, wide, ground, plan |
| F | cycle film stocks |
| I | show the token's label (all of its traits) |
| P | save a still (PNG, twice the screen size) |
| G | save three seconds as a GIF |
| Shift G | save the whole day, midnight to midnight, as a GIF |
| ? | all keys |

## Run it

```sh
npm run build     # src/*.js -> marfa-light.js (and site/marfa-light.js)
npm run serve     # then open http://localhost:8317/site/index.html
```

Open `tools/token.html?hash=0x...` for one token full screen, the way Art Blocks shows it.

## Art Blocks

- **Script:** `marfa-light.js`, one file, no build step needed at mint.
- **Dependency:** three.js **r124**, the version Art Blocks stores onchain. Only `*BufferGeometry` class names are used.
- **Input:** `tokenData.hash`. Every feature comes from the hash alone. `calculateFeatures(tokenData)` returns them.
- **Clock:** live mode reads the wall clock on purpose. It is a clock.
- **Network:** none. Textures are computed, text is drawn on canvas, relics are packed into the script.
- **Size:** about 1.08 MB as written, about 657 KB minified (`dist/marfa-light.min.js`). The two relics account for about 65 KB of it. This is large for onchain storage; cutting it down (or splitting the catalogue) is a week-three job with Art Blocks engineering.
- **Traits:** about 22 per token, 83 trait names and 404 values across the series. `calculateFeatures` returns them.

## Save and share

- In any token: **P** saves a PNG, **G** a three second GIF, **Shift G** the whole day as a GIF. The encoder is part of the script (a median cut palette and LZW), so nothing loads. A three second GIF is about 200 KB; a day is a few MB.
- On the page: the Save row does the same and keeps the files in a tray to open or save.
- From code: `api.saveStill({ long: 3000 })` and `api.recordGif({ day: true, frames: 96, long: 720, download: false })` return promises with the blob.

## Single-file HTML

`npm run standalone` writes two files to `dist/`:
- `marfa-light-standalone.html`: three.js r124 and the engine inlined, about 1.3 MB. Opens from the disk with no network.
- `marfa-light-token.html`: the engine inlined, three.js from cdnjs, the way Art Blocks serves a token.

Both take `?hash=0x...` (64 hex digits) or draw a random token.

## Tools

| Command | What it does |
|---|---|
| `npm run build` | concatenates `src/` into `marfa-light.js`; `node tools/build.js out.js extra.js` builds a private copy with work in progress merged in |
| `npm run page` | writes `site/page.html` (the hosted form) from `site/index.html` |
| `npm run standalone` | writes the two single-file HTML versions |
| `npm run handoff` | assembles `handoff/marfa-light-v0.4/` and its zip |
| `npm run traits` | draws 2,000 hashes and writes the trait distribution to `docs/TRAITS.md` |
| `node tools/docs.js` | writes `docs/CATALOGUE.md` from the registries |
| `npm run render` | renders stills with headless Chrome (no GPU needed) |
| `npm run film` | records a film from real engine frames over the DevTools protocol, then ffmpeg |
| `node tools/export-glb.js 0xHASH 19.5` | exports a token as GLB twice: the whole world (with a Sun light and the hero camera) and the clock alone; `--hashes list.json --out dir` does a batch on the GPU |
| `Blender -b -P tools/blender/render_glb.py -- token.glb token.json out.png` | renders that GLB in Cycles, lit by the real sun for that minute |
| `npm run relics` | re-sculpts the relics in headless Blender and repacks them into `src/06-relics.js` |

## Source

| File | |
|---|---|
| `src/00-core.js` | randomness, noise, Marfa time, sun and moon, the registries |
| `src/05-textures.js` | procedural surface detail projected in world metres (triplanar, with bump) |
| `src/06-relics.js` | Blender relics, quantized and packed |
| `src/10-look.js` | light by solar elevation, sky, stars by sidereal time, moon, clouds, text |
| `src/15-post.js` | HDR, bloom, film grades, grain, vignette |
| `src/20-world.js`, `src/25-places-new.js` | materials, ground, mountains, plants, places |
| `src/30-clocks.js`, `src/35-*.js`, `src/36-*.js` | the clocks |
| `src/26-places-more.js` | eight more places (depot, arroyo, rodeo, ghost town, aerostat field, drive-in, empty pool, hot springs) |
| `src/37-clocks-solar.js`, `src/38-clocks-desert.js` | sky clocks and machines of the high desert |
| `src/40-eggs.js`, `src/45-eggs-new.js`, `src/47-relic-eggs.js` | easter eggs and life |
| `src/48-generative.js` | the generative layer (`genPlan`, `genCamera`, `genBuild`) |
| `src/85-export.js` | PNG and GIF export, with its own GIF encoder |
| `src/80-interact.js` | click captions, help, labels |
| `src/90-main.js` | the plan, world building, the render loop, the API |

To add a clock, a place or an egg, read [docs/ENGINE.md](docs/ENGINE.md). It is one function and one `define...()` call.

## Credits and homages

The design language comes from MLow's virtual architecture practice: Daniel Arsham (the calcified relics), Zaha Hadid (the pavilion), Frank Lloyd Wright (the terrace, Cherokee red), and Virgil Abloh (the quoted labels, the orange zip tie). Easter eggs pay homage to Donald Judd's works at the Chinati Foundation, Elmgreen & Dragset's Prada Marfa, the 1956 film Giant, and Art Blocks projects by Snowfro, Dmitri Cherniak, Tyler Hobbs, Kjetil Golid, Matt DesLauriers and Alexis André. None of this is affiliated with or endorsed by them.

MLow's own worlds appear throughout: NEW YORKERS ([n3wyorkers.com](https://n3wyorkers.com)), fLOWers and The Salon ([mlow.nyc](https://mlow.nyc)), STILL WAITING, THE COMMUTE, BLOOM CYCLE, The MLow Show, and THE SOFT CONSPIRACY, a collaboration with painter Andrés Del Vecchio ([thesoftconspiracy.com](https://thesoftconspiracy.com)). MLow's work has run on 5,000+ NYC taxis and shown in more than ten countries. [mlow.xyz](https://mlow.xyz)

## License

All rights reserved. See [LICENSE](LICENSE).
