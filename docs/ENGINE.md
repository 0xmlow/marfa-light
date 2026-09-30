# Marfa Light engine: how to add a clock, a place, or an easter egg

Everything is plain ES5-style JavaScript inside one IIFE. `build.sh` concatenates
`src/*.js` in filename order into `marfa-light.js`. All files share one scope, so
every helper below is callable from any file. three.js is **r124** (the version
Art Blocks stores onchain): always use the `*BufferGeometry` class names
(`BoxBufferGeometry`, `CylinderBufferGeometry`, `ExtrudeBufferGeometry`, ...).

## Hard rules

- **Deterministic.** Never call `Math.random`, `Date.now` or `new Date()` in a
  builder. Use `W.r()` (the world's seeded stream). Time only arrives through
  `ctx` in update functions.
- **No network, no images, no fonts to load.** Textures are procedural
  (`mtl`, `detail`) or drawn on canvas (`canvasTex`, `textPlane`).
- **Metres.** Ground is y = 0. North is -z, east is +x. The clock stands at the
  origin. The camera looks at it from `W.cam.pos`.
- **Never share one material between an InstancedMesh and a plain Mesh.** r124 keeps one program per material and does not re-check instancing per object, so the render crashes (`isInterleavedBufferAttribute` of undefined). Clone the material.
- **Sit on the ground with `W.groundAt(x, z)`** when a place sets it (terrain places do); otherwise the ground is y = 0 near the clock.
- **Emissive in daylight stays under ~1.2** or it blooms into a white blob.
  Use `W.glow(material, dayIntensity, nightIntensity)` so glow follows the dark.
- **Voice rules for any text in the world:** no em dashes, no exclamation
  marks. Abloh owns labels: quoted caps like "CLOCK" are welcome.
- **Canon:** THE SOFT CONSPIRACY is always MLow x Andres Del Vecchio, never solo.
  317 is MLow's number. Never mention Tel Aviv. At most one NEW YORKERS figure
  per scene. Taxis are 5,000+, countries are 13 (50 Art Crush exhibitions in 2026).

- **Materials are unshared for you.** After a world is built, `unshareMaterials` gives each
  kind of mesh (plain, instanced, instanced with colour) its own copy of a shared material.
  Still clone on purpose where you can: a material updated each frame only updates the original.
- **`outdoor: true`** on a clock keeps it out of roofed places; `solar: true` does the same and
  also turns the camera to the south side.

## The generative layer (`48-generative.js`)

`plan()` calls `genPlan(hash, clock, cd, place, pd, sky)`, which draws only from
`hashRng(hash, 11)` and returns `{ features }`; the plan keeps it as `P.gen`.
`buildWorld()` calls `genCamera(P, hero)` for `{ fov, distK, hK, azOff }` and
`genBuild(W, hero)` after the eggs. Add a trait there, never in `plan()`, so no
existing draw moves.

## Registries (in `00-core.js`)

```js
defineClock(name, {
  w: 9,                         // weight in the draw, 0 = never picked
  keeps: 'Shadow',              // the "Keeps Time By" trait
  solar: true,                  // optional: camera prefers the south side
  height: 5.2,                  // metres; set in 39-clock-heights.js; roofed places filter on it
  mats: ['Brass', 'Concrete'],  // allowed MATERIALS keys (see 20-world.js)
  eggs: ['New Yorker'],         // optional: eggs this clock always carries
  line: 'What a visitor reads when they click the clock.',
  traits: function (r) { return { 'Face': pick(r, ['A', 'B']) }; },  // optional, extra trait columns
  build: function (W, matName) { ...; return hero; }
});
definePlace(name, { w: 12, eggs: ['Prada Marfa'], skies: [['Clear', 1]], accepts: function (clock, def) { return true; }, build: function (W) { ... } });
defineEgg(name,   { w: 7, line: 'Caption on click.', places: ['Highway 90'], build: function (W) { ... } });
```

Traits from `traits(r)` land in `W.P.clockTraits` and in the token's features.

## What a clock builder returns

```js
return {
  group: g,            // THREE.Group at the origin, everything inside
  R: 4.2,              // footprint radius in metres (camera and scatter keep clear)
  lookY: 1.8,          // camera looks at (0, lookY, 0)
  dist: 12,            // camera distance
  camH: [1.6, 2.6],    // camera height range
  face: true,          // true: the group is turned so local +z faces the camera
  close: { zoom: 0.45, el: 0.05, look: 0 },   // optional close-up view
  shadowPad: 7,        // optional: extra shadow-map radius around R
  update: function (ctx) { ... }              // optional, every frame
};
```

`ctx` in every update: `utc`, `t` (Marfa time: `h m s sec hours y mo d zone dst days`),
`sun` and `moon` (`el az`, moon also `illum waxing age`), `dt` (real seconds),
`real` (seconds since start), `snap` (true when time jumped: set things
directly, do not animate), `fast` (time-lapse), `night` (0..1), `wind`,
`windDir`, `camera`.

## World helpers (`W`)

| Helper | What it does |
|---|---|
| `W.r()` | seeded random 0..1 |
| `W.add(obj)` | add to the scene |
| `W.onUpdate(fn)` | fn(ctx) every frame |
| `W.glow(mat, day, night)` | emissive intensity follows the dark |
| `W.lamp(hex, intensity, distance, vec3, parent?)` | point light that turns on at night; give a parent group so it turns with a `face: true` clock |
| `W.claim(x, z, r)` / `W.free(x, z, r)` | reserve ground; free() also keeps the camera's sightline clear |
| `W.inView(offDeg, dist)` | a ground point `offDeg` right of the camera's line to the clock, `dist` m from the camera |
| `W.face(obj)` | turn obj so its +z faces the camera |
| `W.pick(obj, name, line)` | make obj clickable with a caption |
| `W.cam` | `{ pos, dir, right, dist, h, lookY }` |
| `W.P` | the plan: `clock place material sky wind film tag eggs clockTraits seed` |
| `W.dst` | daylight saving at build time |
| `W.road`, `W.court` | set by Highway 90 and Adobe Courtyard |
| `W.shadowExtent = 45` | a place can widen the sun's shadow map (interiors need their roof to cast) |
| `W.heroR` | the clock's footprint radius |

## Geometry and material helpers

| Helper | What it does |
|---|---|
| `box(w,h,d,mat)`, `cyl(rTop,rBot,h,seg,mat)`, `sph(r,mat,ws,hs)` | meshes |
| `std(hex, rough, metal, extra)` | MeshStandardMaterial; `extra.tex` + `extra.tile` add surface detail |
| `mtl(hex, kind, rough, metal, tileMetres)` | textured material in one call. kinds: `stone marble concrete brushed rust plaster wood sand paint terrazzo cracks crystal` |
| `heroMat(name)` | the token's hero material from `MATERIALS` |
| `glowMat(hex, strength)` | dark body with emissive colour |
| `shade(obj)` | cast and receive shadows on every mesh inside |
| `textPlane(lines, {height, px, font, color, bg, glow, spacing, align})` | text on a plane, sized in metres; `.userData.w` is its width |
| `canvasTex(w, h, drawFn)` | CanvasTexture from a 2D drawing |
| `blobShadow(w, d, alpha)` | soft contact shadow for things outside the shadow map |
| `newYorker(r, W)` | a NEW YORKERS figure, `.userData.update(ctx)` animates it |
| `placeInView(W, radius, offMin, offMax, dMin, dMax)` | claims and returns a free spot in frame, or null |
| `primShape(kind, quarterTurns, size)` / `blossomPlate(r, w, h, n, inset, skip)` | the six Blossom shapes and pierced plates |
| `FlapRow(n, w, h, gap, mat, parent, x0, y0, z)` + `flapMaterial(W)` | split-flap rows; `.set(text, snap)` and `.update(dt, jump)` |
| `dirAzEl(az, el)` | a direction vector from azimuth and elevation |
| `haForClock(H)` | sun hour angle when a Central Standard clock reads H |
| `sunEvents(t)`, `moonEvents(t)` | rise and set as HH:MM |
| `dayOfYear(t)`, `bloomState(t)` | the season |
| `BRAND` | `blue cyan green ink cloud pink` |
| `FONT_SERIF FONT_MONO FONT_SANS` | font stacks |

## Test

```sh
./build.sh                 # the real build
./build.sh .agent/mine.js  # a private build when several people work at once; add &script=.agent/mine.js to test.html
node -e "require('./marfa-light.js'); console.log(marfaLight.plan('0x' + 'ab'.repeat(32)).features)"
# render: add &clock=Water%20Clock or &hour=19.5 to filter
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=90000 --window-size=1500,1100 --screenshot=out.png "file://$PWD/test.html?seed=611&n=6&w=720&hour=18.6&clock=Orbital"
```

Look at every render. Check day (hour 11), golden hour (19.8) and night (22).
