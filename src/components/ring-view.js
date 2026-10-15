import { useEffect, useRef } from 'preact/hooks';
import { html } from '../lib/html.js';
import { RingViewer } from '../lib/viewer.js';
import { buildHeightmap } from '../lib/heightmap.js';
import { buildRingGeometry } from '../lib/ringGeometry.js';
import { bandMetrics } from '../lib/band.js';
import { renderLook, getMaterial } from '../lib/materials.js';
import { patternById } from '../state.js';

const shapeKey = (design, getPattern) => [
  JSON.stringify({ ...design, materialId: 0, plating: 0 }),
  ...['middle', 'sideL', 'sideR'].map((z) => getPattern(design.patterns[z])),
];
const sameKey = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

// The last few sharp rings, so going back is instant and the landing slideshow can build the next one early.
// ponytail: about 13 MB each, so only 3 are kept.
const cache = [];
function sharpGeometry(design, getPattern, key = shapeKey(design, getPattern)) {
  let hit = cache.find((c) => sameKey(c.key, key));
  if (!hit) {
    hit = { key, geom: buildRingGeometry(design, buildHeightmap(design, getPattern, 3072), 1.25) };
    cache.unshift(hit);
    cache.length = Math.min(cache.length, 3);
  }
  return hit.geom;
}

/** Builds a ring's sharp mesh ahead of time, so a RingView shows it the moment its design arrives. */
export const prebuildRing = (design, getPattern = patternById) => void sharpGeometry(design, getPattern);

/**
 * 3D ring. `getPattern` lets the pattern editor inject a draft pattern.
 * `onViewer` receives the RingViewer instance (for reset view, snapshots, try-on scaling).
 */
export function RingView({ design, getPattern = patternById, mode = 'studio', autoRotate = false, zoom, className = '', onViewer, label }) {
  const host = useRef();
  const viewer = useRef();
  const pending = useRef(0);
  const fine = useRef(0);
  const shape = useRef(null);
  const lastChange = useRef(-Infinity);

  useEffect(() => {
    viewer.current = new RingViewer(host.current, { mode, autoRotate, zoom });
    onViewer?.(viewer.current);
    return () => {
      cancelAnimationFrame(pending.current);
      clearTimeout(fine.current);
      viewer.current.dispose();
    };
  }, []);

  useEffect(() => viewer.current?.setAutoRotate(autoRotate), [autoRotate]);

  const pats = ['middle', 'sideL', 'sideR'].map((z) => getPattern(design.patterns[z]));
  useEffect(() => {
    // Material and plating only change the look, so the mesh is kept.
    const key = shapeKey(design, getPattern);
    if (shape.current && sameKey(key, shape.current)) return viewer.current.setLook(renderLook(design));
    shape.current = key;

    // Shape and look change together, so the ring never shows the new colour on the old pattern.
    const show = (geom) => {
      const { innerD, outerD } = bandMetrics(design);
      viewer.current.setGeometry(geom, innerD, outerD + 2 * design.relief);
      viewer.current.setLook(renderLook(design));
    };
    const sharp = () => show(sharpGeometry(design, getPattern, key));
    cancelAnimationFrame(pending.current);
    clearTimeout(fine.current);
    // Built ahead of time (the landing slideshow does this): show it now, with the rest of the page.
    if (cache.some((c) => sameKey(c.key, key))) return sharp();
    // A single change goes straight to the sharp ring (about 160 ms), so it never flashes a rough one.
    // Only while the user flicks quickly (changes under 400 ms apart) does a quicker build keep up,
    // and the sharp one follows once the input has been still for 200 ms.
    const now = performance.now();
    const burst = now - lastChange.current < 400;
    lastChange.current = now;
    pending.current = requestAnimationFrame(() => {
      if (!burst) return sharp();
      show(buildRingGeometry(design, buildHeightmap(design, getPattern, 1536), 0.75));
      fine.current = setTimeout(sharp, 200);
    });
  }, [design, ...pats]);

  const m = getMaterial(design.materialId);
  const desc =
    label ||
    `3D preview of the ring in ${m.name}. ${pats[0] ? `Middle: ${pats[0].name}.` : ''} ${pats[1] ? `Sides: ${pats[1].name}${pats[2] && pats[2] !== pats[1] ? ' and ' + pats[2].name : ''}.` : ''} Drag to rotate.`;
  return html`<div class=${'ring-view ' + className} ref=${host} role="img" aria-label=${desc}></div>`;
}
