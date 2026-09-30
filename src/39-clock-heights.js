  // =====================================================================
  // HEIGHTS: how tall each clock stands, in metres. Places with a roof use
  // this in their accepts() so a water tower never ends up in a shed.
  // =====================================================================
  var CLOCK_HEIGHTS = {
    'Horizontal Sundial': 1.3, 'Analemmatic Sundial': 2.1, 'Armillary Sphere': 5.1, 'Split-Flap Board': 7,
    'Flip Monument': 3.9, 'Orbital': 8.6, 'Blossom Binary': 6, 'Solar Henge': 6.2, 'Concourse Clock': 6,
    'Water Clock': 6, 'Hourglass': 4.2, 'Word Clock': 5.6, 'Kinetic Pin Field': 1.6,
    'Skeleton Clock': 5.2, 'Astronomical Clock': 13.5, 'Motel Sign': 11, 'Water Tower Clock': 21
  };
  (function () { for (var k in CLOCK_HEIGHTS) if (CLOCK_DEFS[k] && CLOCK_DEFS[k].height == null) CLOCK_DEFS[k].height = CLOCK_HEIGHTS[k]; })();
