import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GLOBE_COUNTRY_RINGS, GlobeCountryRings } from "../data/globeCountryRings";

const ID_MAP_ASSET = require("../../assets/globe-id-map.png");

// Matches geodata/generate-globe-assets.js's lngLatToPixel: u=(lng+180)/360,
// v=(90-lat)/180. THREE's default sphere UVs are used as-is for the shader sample
// (vUv), so as long as this inverse is the one used everywhere a UV needs converting
// back to a coordinate (only here, for tap-to-select), the texture and the hit-test
// necessarily agree with each other regardless of which way the sphere "actually"
// faces — a mismatch there would show up as the whole globe looking rotated, not as
// taps landing on the wrong country.
function uvToLngLat(u: number, v: number): [number, number] {
  return [u * 360 - 180, 90 - v * 180];
}

// Same fix as generate-globe-assets.js's unwrapRing, applied at hit-test time instead
// of at raster time: GLOBE_COUNTRY_RINGS stores raw (non-unwrapped) lng/lat, so a ring
// that touches the antimeridian (Russia, Fiji, ...) has a "seam" edge jumping from
// ~+179° to ~-179° between consecutive points. A plain ray-cast treats that as a real
// edge spanning nearly the whole globe, which corrupts the inside/outside parity for
// every test point at that ring's latitude — not just points near the seam — which is
// exactly why Russia was swallowing chunks of Alaska. Unwrapping the ring into a
// continuous sequence (which can run outside [-180, 180]) fixes the parity; testing
// the tapped point at lng, lng+360, and lng-360 covers whichever "copy" of the point
// lines up with wherever the ring's own unwrapped range ended up.
function unwrapRingLngLat(ring: [number, number][]): [number, number][] {
  let offset = 0;
  let prevLng = ring[0][0];
  return ring.map(([lng, lat]) => {
    const delta = lng - prevLng;
    if (delta > 180) offset -= 360;
    else if (delta < -180) offset += 360;
    prevLng = lng;
    return [lng + offset, lat];
  });
}

function rayCastInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  const unwrapped = unwrapRingLngLat(ring);
  return (
    rayCastInRing(lng, lat, unwrapped) ||
    rayCastInRing(lng + 360, lat, unwrapped) ||
    rayCastInRing(lng - 360, lat, unwrapped)
  );
}

function hitTestCountry(lng: number, lat: number): GlobeCountryRings | null {
  for (const country of GLOBE_COUNTRY_RINGS) {
    const [[minLng, minLat], [maxLng, maxLat]] = country.bounds;
    // Bounds are also raw/non-unwrapped, so a seam-touching country's bbox is already
    // wide (close to the full -180..180 span) rather than wrong — safe to bbox-reject
    // on latitude, but skip the longitude bbox check for anything wide enough to
    // plausibly be a seam country rather than risk a false reject.
    const spansSeam = maxLng - minLng > 180;
    if (lat < minLat || lat > maxLat) continue;
    if (!spansSeam && (lng < minLng || lng > maxLng)) continue;
    for (const ring of country.rings) {
      if (pointInRing(lng, lat, ring)) return country;
    }
  }
  return null;
}

// Widening rings of sample points around a near-miss, checked closest-first. Exists
// because touch/mouse precision and border precision are both finite — a tap that
// lands just outside a country's actual boundary (easy to do for anything small, and
// for anything currently near the edge of the visible globe where the surface is
// heavily foreshortened) should still resolve to "the country you were obviously
// aiming at" rather than silently doing nothing.
const FUZZY_RADII_DEG = [0.15, 0.3, 0.5, 0.8];

function hitTestCountryFuzzy(lng: number, lat: number): GlobeCountryRings | null {
  const exact = hitTestCountry(lng, lat);
  if (exact) return exact;
  for (const radius of FUZZY_RADII_DEG) {
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = (angle * Math.PI) / 180;
      const candidate = hitTestCountry(lng + radius * Math.cos(rad), lat + radius * Math.sin(rad));
      if (candidate) return candidate;
    }
  }
  return null;
}

const VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// uIdMap's red channel (0..1) decodes back to a country index 0..255 (0 = ocean).
// uVisited is a tiny 256x1 lookup texture, one texel per possible index, red channel
// 1.0/0.0 — indirection through a texture (rather than a uniform array indexed by a
// value computed in-shader) is what GLSL ES / WebGL1 actually allows on all hardware.
const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D uIdMap;
  uniform sampler2D uVisited;
  uniform vec2 uTexelSize;
  uniform vec3 uOceanColor;
  uniform vec3 uUnvisitedColor;
  uniform vec3 uVisitedColor;
  uniform vec3 uSelectedColor;
  uniform vec3 uBorderColor;
  uniform float uSelectedIndex;
  uniform vec3 uSunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;

  float idAt(vec2 uv) {
    return floor(texture2D(uIdMap, uv).r * 255.0 + 0.5);
  }

  void main() {
    float id = idAt(vUv);
    vec3 base;
    if (id < 0.5) {
      base = uOceanColor;
    } else if (abs(id - uSelectedIndex) < 0.5) {
      base = uSelectedColor;
    } else {
      float visited = texture2D(uVisited, vec2((id + 0.5) / 256.0, 0.5)).r;
      base = mix(uUnvisitedColor, uVisitedColor, visited);
    }

    // Coastline/border: a two-ring neighbour check (1 texel, then 2 texels out) in 8
    // directions, so a border reads as a solid ~2px line with a soft half-strength
    // feather at its outer edge instead of the old single hard 1-texel-wide (and
    // frequently anti-aliased-away-to-invisible) edge.
    vec2 t1 = uTexelSize;
    vec2 t2 = uTexelSize * 2.0;
    bool border1 =
      idAt(vUv + vec2(0.0, t1.y)) != id || idAt(vUv - vec2(0.0, t1.y)) != id ||
      idAt(vUv + vec2(t1.x, 0.0)) != id || idAt(vUv - vec2(t1.x, 0.0)) != id ||
      idAt(vUv + vec2(t1.x, t1.y)) != id || idAt(vUv + vec2(-t1.x, t1.y)) != id ||
      idAt(vUv + vec2(t1.x, -t1.y)) != id || idAt(vUv + vec2(-t1.x, -t1.y)) != id;
    bool border2 =
      idAt(vUv + vec2(0.0, t2.y)) != id || idAt(vUv - vec2(0.0, t2.y)) != id ||
      idAt(vUv + vec2(t2.x, 0.0)) != id || idAt(vUv - vec2(t2.x, 0.0)) != id;
    float borderStrength = border1 ? 1.0 : (border2 ? 0.45 : 0.0);

    vec3 color = mix(base, uBorderColor, borderStrength);

    // Floor raised well above the old 0.45: this is a country-selection UI, not a
    // photoreal render, and the previous floor crushed land/ocean/border contrast to
    // near-black on whichever third of the globe was rotated away from the fixed
    // light direction at any given moment — exactly the countries a user might be
    // trying to tap.
    float lambert = max(dot(normalize(vNormal), normalize(uSunDirection)), 0.0);
    float lighting = 0.72 + 0.28 * lambert;
    gl_FragColor = vec4(color * lighting, 1.0);
  }
`;

interface GlobeUniforms {
  [key: string]: THREE.IUniform;
  uIdMap: { value: THREE.Texture | null };
  uVisited: { value: THREE.DataTexture };
  uTexelSize: { value: THREE.Vector2 };
  uOceanColor: { value: THREE.Color };
  uUnvisitedColor: { value: THREE.Color };
  uVisitedColor: { value: THREE.Color };
  uSelectedColor: { value: THREE.Color };
  uBorderColor: { value: THREE.Color };
  uSelectedIndex: { value: number };
  uSunDirection: { value: THREE.Vector3 };
}

const INDEX_BY_ID = new Map(GLOBE_COUNTRY_RINGS.map((c) => [c.id, c.index]));
const MAX_TILT = 1.35; // radians — stops just short of looking straight down a pole

function makeVisitedTexture(): THREE.DataTexture {
  const data = new Uint8Array(256 * 4);
  const texture = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

interface GlobeSceneProps {
  visitedIds: Set<string>;
  selectedId: string | null;
  onSelectCountry: (id: string) => void;
  rotationRef: React.MutableRefObject<{ x: number; y: number }>;
  draggingRef: React.MutableRefObject<boolean>;
  colors: GlobeColors;
}

export interface GlobeColors {
  ocean: string;
  unvisited: string;
  visited: string;
  selected: string;
  border: string;
}

function GlobeScene({
  visitedIds,
  selectedId,
  onSelectCountry,
  rotationRef,
  draggingRef,
  colors,
}: GlobeSceneProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const idMap = useLoader(THREE.TextureLoader, ID_MAP_ASSET) as THREE.Texture;
  idMap.minFilter = THREE.NearestFilter;
  idMap.magFilter = THREE.NearestFilter;
  idMap.wrapS = THREE.RepeatWrapping;

  const visitedTexture = useMemo(() => makeVisitedTexture(), []);

  useEffect(() => {
    const data = visitedTexture.image.data as Uint8Array;
    data.fill(0);
    for (const id of visitedIds) {
      const index = INDEX_BY_ID.get(id);
      if (index === undefined) continue;
      data[index * 4] = 255;
    }
    visitedTexture.needsUpdate = true;
  }, [visitedIds, visitedTexture]);

  const uniforms = useMemo<GlobeUniforms>(
    () => ({
      uIdMap: { value: idMap },
      uVisited: { value: visitedTexture },
      uTexelSize: { value: new THREE.Vector2(1 / 4096, 1 / 2048) },
      uOceanColor: { value: new THREE.Color(colors.ocean) },
      uUnvisitedColor: { value: new THREE.Color(colors.unvisited) },
      uVisitedColor: { value: new THREE.Color(colors.visited) },
      uSelectedColor: { value: new THREE.Color(colors.selected) },
      // Lightened well past the theme's own border token: at globe scale a
      // same-family border reads as barely-there, and the whole point of this pass
      // is a border a user can actually see to tell two countries apart.
      uBorderColor: { value: new THREE.Color(colors.border).offsetHSL(0, 0, 0.22) },
      uSelectedIndex: { value: -1 },
      uSunDirection: { value: new THREE.Vector3(0.6, 0.5, 0.7) },
    }),
    [idMap, visitedTexture, colors]
  );

  useEffect(() => {
    uniforms.uSelectedIndex.value = selectedId ? INDEX_BY_ID.get(selectedId) ?? -1 : -1;
  }, [selectedId, uniforms]);

  useFrame((_, delta) => {
    if (!draggingRef.current) {
      rotationRef.current.y += delta * 0.06; // slow idle spin, "Google Earth" style
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = rotationRef.current.y;
      groupRef.current.rotation.x = rotationRef.current.x;
    }
  });

  // Rotation and tap-to-select both live on the sphere's own r3f pointer events
  // rather than splitting them across a separate RN gesture library — two systems
  // racing to interpret the same touch is what made plain taps get eaten as
  // micro-drags. moved.current is what tells pointerUp whether this was a drag
  // (rotate) or a tap (select); it only flips once real movement crosses the
  // threshold, so a stationary tap is never misread as a drag.
  const pointer = useRef({ down: false, startX: 0, startY: 0, startRotX: 0, startRotY: 0, moved: false });

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      pointer.current = {
        down: true,
        startX: event.clientX,
        startY: event.clientY,
        startRotX: rotationRef.current.x,
        startRotY: rotationRef.current.y,
        moved: false,
      };
      // Freeze the idle spin for the whole touch, not just once it's recognized as a
      // drag: the idle spin previously kept running for however long a finger sat on
      // the globe deciding whether to tap, so the country under a stationary tap could
      // drift away from what was actually pressed by release time — worst for
      // small, tightly-packed countries (a lot of West Africa) where even a
      // fraction of a degree of drift lands the tap in a neighbour instead.
      draggingRef.current = true;
    },
    [rotationRef, draggingRef]
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!pointer.current.down) return;
      const dx = event.clientX - pointer.current.startX;
      const dy = event.clientY - pointer.current.startY;
      if (!pointer.current.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      pointer.current.moved = true; // idle spin is already frozen, from pointerDown
      rotationRef.current.y = pointer.current.startRotY + dx * 0.008;
      rotationRef.current.x = Math.max(
        -MAX_TILT,
        Math.min(MAX_TILT, pointer.current.startRotX + dy * 0.008)
      );
    },
    [rotationRef, draggingRef]
  );

  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!pointer.current.moved && event.uv) {
        const [lng, lat] = uvToLngLat(event.uv.x, event.uv.y);
        const hit = hitTestCountryFuzzy(lng, lat);
        if (hit) onSelectCountry(hit.id);
      }
      pointer.current.down = false;
      draggingRef.current = false;
    },
    [onSelectCountry, draggingRef]
  );

  return (
    <>
      <ambientLight intensity={0.5} />
      <group ref={groupRef}>
        <mesh
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <sphereGeometry args={[1, 64, 64]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={VERTEX_SHADER}
            fragmentShader={FRAGMENT_SHADER}
          />
        </mesh>
      </group>
    </>
  );
}

export interface Globe3DProps {
  visitedIds: Set<string>;
  selectedId?: string | null;
  onSelectCountry: (id: string) => void;
  colors: GlobeColors;
}

export default function Globe3D({
  visitedIds,
  selectedId = null,
  onSelectCountry,
  colors,
}: Globe3DProps) {
  const rotationRef = useRef({ x: -0.15, y: 0.4 });
  const draggingRef = useRef(false);

  return (
    // A narrower fov (pushed back further to compensate, keeping the sphere the same
    // apparent size) trades wide-angle "fisheye" character for something closer to
    // orthographic — the point isn't taste, it's that wide-fov perspective compresses
    // the sphere's surface hard near the limb, so a fixed screen-space tap area covers
    // much more real surface there than at the center. Countries near the edge of
    // whatever's currently in view (which is most of a continent as wide as Asia,
    // most of the time) were disproportionately hard to land a tap on as a direct
    // result. distance * tan(fov/2) >= radius(1) is still the fit-in-frame floor.
    <Canvas style={{ flex: 1 }} camera={{ position: [0, 0, 6.5], fov: 24 }}>
      <React.Suspense fallback={null}>
        <GlobeScene
          visitedIds={visitedIds}
          selectedId={selectedId}
          onSelectCountry={onSelectCountry}
          rotationRef={rotationRef}
          draggingRef={draggingRef}
          colors={colors}
        />
      </React.Suspense>
    </Canvas>
  );
}
