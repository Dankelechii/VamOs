// Generates the 3D globe's country-ID lookup texture.
//
// Approach: rasterize every country's polygon(s) onto an equirectangular raster
// (the standard UV layout for texturing a sphere: u = (lng+180)/360, v = (90-lat)/180),
// encoding each country as a flat index (1..N) in the texture's red channel. At
// runtime a fragment shader samples this texture to know which country a given point
// on the globe belongs to, then looks up that index in a small per-frame "which
// countries are visited" texture to decide the fill color — see src/components/Globe3D.
//
// The index order is taken directly from the existing WORLD_COUNTRIES array (the flat
// 2D map's data) rather than re-deriving it, so the globe and the flat map always
// agree on which id maps to which country. world-atlas's countries-110m.json is the
// exact same Natural Earth 110m source worldCountries.ts was generated from, so every
// id here is expected to resolve.

const fs = require("fs");
const path = require("path");
const topojson = require("topojson-client");
const { PNG } = require("pngjs");
// 50m (not 110m, the flat map's source): world-atlas is a dev-only dependency, used
// only here at generate-time, so its own file size costs the shipped app nothing —
// only the OUTPUT (the raster below, and the ring geometry for hit-testing) ends up in
// the bundle. 50m gives meaningfully more accurate, less blocky border shapes than
// 110m for a still-reasonable jump in that output size; 10m would sharpen further but
// bloats the hit-test ring file for diminishing visual return at globe scale.
const topology = require("world-atlas/countries-50m.json");

// 4x the pixel density of the original 2048x1024: small, closely-packed countries
// (a lot of West Africa, the Balkans) were visibly blocky at the old resolution.
const WIDTH = 4096;
const HEIGHT = 2048;

const ROOT = path.join(__dirname, "..");
const WORLD_COUNTRIES_TS = path.join(ROOT, "src/data/worldCountries.ts");
const OUTPUT_PNG = path.join(ROOT, "assets/globe-id-map.png");
const OUTPUT_RINGS_TS = path.join(ROOT, "src/data/globeCountryRings.ts");

function loadExistingCountryIds() {
  const src = fs.readFileSync(WORLD_COUNTRIES_TS, "utf8");
  const marker = "WORLD_COUNTRIES: CountryGeo[] = ";
  const start = src.indexOf(marker);
  if (start === -1) throw new Error("Could not find WORLD_COUNTRIES array in worldCountries.ts");
  const arrayStart = start + marker.length;
  const arrayText = src.slice(arrayStart).trim().replace(/;\s*$/, "");
  const countries = JSON.parse(arrayText);
  return countries.map((c) => c.id);
}

function lngLatToPixel(lng, lat) {
  const x = ((lng + 180) / 360) * WIDTH;
  const y = ((90 - lat) / 180) * HEIGHT;
  return [x, y];
}

/**
 * Unwraps a ring's longitudes into a continuous sequence, so a ring that crosses the
 * antimeridian (Natural Earth doesn't pre-split at ±180°) doesn't jump from +179° to
 * -179° between consecutive points. Standard angle-unwrap: whenever a step is bigger
 * than 180°, it's the seam, not real geometry, so fold the running offset by ±360 to
 * keep the sequence continuous. Pixel x for an unwrapped ring can land outside
 * [0, WIDTH) — that's expected, and is resolved at fill time by wrapping x back into
 * range, which is what makes a country that straddles the seam paint correctly on
 * both edges of the texture instead of as one wide band cutting across the map.
 */
function unwrapRing(ring) {
  let offset = 0;
  let prevLng = ring[0][0];
  return ring.map(([lng, lat]) => {
    let delta = lng - prevLng;
    if (delta > 180) offset -= 360;
    else if (delta < -180) offset += 360;
    prevLng = lng;
    const unwrappedLng = lng + offset;
    const [x, y] = lngLatToPixel(unwrappedLng, lat);
    return [x, y];
  });
}

/** Even-odd scanline fill across every ring of one Polygon (outer + holes). */
function fillPolygon(buffer, rings, index) {
  const polys = rings.map(unwrapRing);
  let minY = HEIGHT, maxY = 0;
  for (const ring of polys) {
    for (const [, y] of ring) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(HEIGHT - 1, Math.ceil(maxY));

  for (let y = minY; y <= maxY; y++) {
    const scanY = y + 0.5;
    const xs = [];
    for (const ring of polys) {
      for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % ring.length];
        if (y1 === y2) continue;
        if (scanY < Math.min(y1, y2) || scanY >= Math.max(y1, y2)) continue;
        const t = (scanY - y1) / (y2 - y1);
        xs.push(x1 + t * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xStart = Math.round(xs[i]);
      const xEnd = Math.round(xs[i + 1]);
      for (let x = xStart; x <= xEnd; x++) {
        const wrappedX = ((x % WIDTH) + WIDTH) % WIDTH;
        const offset = (y * WIDTH + wrappedX) * 4;
        buffer[offset] = index; // R channel = country index (1..N)
        buffer[offset + 1] = 0;
        buffer[offset + 2] = 0;
        buffer[offset + 3] = 255;
      }
    }
  }
}

function main() {
  const orderedIds = loadExistingCountryIds();
  const geo = topojson.feature(topology, topology.objects.countries);
  const featureById = new Map(geo.features.map((f) => [f.id, f]));

  const png = new PNG({ width: WIDTH, height: HEIGHT });
  // 0 = ocean/no country, left as-is.
  png.data.fill(0);
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255; // opaque alpha

  // Runtime hit-testing (tap-to-select) can't read pixels back off a GPU texture on
  // native, so it needs its own lightweight copy of the same ring geometry — just the
  // outer rings (holes don't matter for "which country was tapped", only for the
  // raster fill), rounded to ~100m precision to keep the bundled file small.
  const hitTestCountries = [];

  let missing = 0;
  orderedIds.forEach((id, i) => {
    const index = i + 1; // 0 reserved for "no country"
    if (index > 255) throw new Error(`Too many countries (${orderedIds.length}) to fit in one byte`);
    const feature = featureById.get(id);
    if (!feature) {
      missing++;
      console.warn(`No world-atlas feature for id ${id} (index ${index}) — left as ocean`);
      return;
    }
    const { type, coordinates } = feature.geometry;
    const polys = type === "Polygon" ? [coordinates] : coordinates;
    for (const poly of polys) fillPolygon(png.data, poly, index);

    const outerRings = polys.map((poly) =>
      poly[0].map(([lng, lat]) => [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000])
    );
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    for (const ring of outerRings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
    hitTestCountries.push({ id, index, rings: outerRings, bounds: [[minLng, minLat], [maxLng, maxLat]] });
  });

  const ringsSrc =
    `// AUTO-GENERATED by geodata/generate-globe-assets.js — do not hand-edit.\n` +
    `// Outer-ring country boundaries in [lng, lat] degrees, for the 3D globe's\n` +
    `// tap-to-select hit-testing (see src/components/Globe3D.tsx). \`index\` is the\n` +
    `// exact value baked into assets/globe-id-map.png's red channel for this country.\n\n` +
    `export interface GlobeCountryRings {\n` +
    `  id: string;\n` +
    `  index: number;\n` +
    `  rings: [number, number][][];\n` +
    `  bounds: [[number, number], [number, number]];\n` +
    `}\n\n` +
    `export const GLOBE_COUNTRY_RINGS: GlobeCountryRings[] = ${JSON.stringify(hitTestCountries)};\n`;
  fs.writeFileSync(OUTPUT_RINGS_TS, ringsSrc);

  fs.mkdirSync(path.dirname(OUTPUT_PNG), { recursive: true });
  png.pack().pipe(fs.createWriteStream(OUTPUT_PNG)).on("finish", () => {
    console.log(`Wrote ${OUTPUT_PNG} (${WIDTH}x${HEIGHT}), ${orderedIds.length} countries, ${missing} missing`);
  });
}

main();
