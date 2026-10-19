import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { RingViewer } from '../lib/viewer.js';
import { buildHeightmap } from '../lib/heightmap.js';
import { buildRingArrays } from '../lib/ringMesh.js';
import { toGeometry, engravingFor } from '../lib/ringGeometry.js';
import { bandMetrics } from '../lib/band.js';
import { renderLook, getMaterial } from '../lib/materials.js';
import { patternById } from '../state.js';

const ZONES = ['middle', 'sideL', 'sideR'];
const shapeKey = (design, getPattern) => [
  JSON.stringify({ ...design, materialId: 0, plating: 0 }),
  ...ZONES.map((z) => getPattern(design.patterns[z])),
];
const sameKey = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

// A full ring takes about 160 ms to build, so it is built in a worker and the page keeps animating meanwhile.
// One job runs at a time; a newer request from the same view replaces its queued one, so fast flicking
// never builds a backlog of rings nobody will see.
let worker = null;
let running = null;
const queue = [];

function pump() {
  if (running || !queue.length) return;
  running = queue.shift();
  if (worker !== false) {
    try {
      worker ||= startWorker();
      return worker.postMessage(running.msg);
    } catch {
      worker = false;
    }
  }
  // No worker (very old browser, or it failed to load): build here, on the main thread.
  const { design, patterns, W, detail, engraving } = running.msg;
  try {
    finish(buildRingArrays(design, buildHeightmap(design, (id) => patterns[id], W), detail, engraving));
  } catch (err) {
    console.error(err);
    running.resolve(null);
    running = null;
    setTimeout(pump);
  }
}

function finish(mesh) {
  const job = running;
  running = null;
  job.resolve(toGeometry(mesh));
  setTimeout(pump);
}

function startWorker() {
  const w = new Worker(new URL('../lib/ring-worker.js', import.meta.url), { type: 'module' });
  w.onmessage = ({ data }) => finish(data.mesh);
  w.onerror = (e) => {
    e.preventDefault();
    worker = false;
    w.terminate();
    if (running) queue.unshift(running), (running = null);
    pump();
  };
  return w;
}

function requestBuild(design, getPattern, owner, background) {
  const patterns = Object.fromEntries(ZONES.map((z) => [design.patterns[z], getPattern(design.patterns[z])]).filter(([, p]) => p));
  const msg = { design, patterns, W: 3072, detail: 1.25, engraving: engravingFor(design) };
  return new Promise((resolve) => {
    if (!background) for (let i = queue.length - 1; i >= 0; i--) if (queue[i].owner === owner) queue.splice(i, 1)[0].resolve(null);
    // Rings someone is waiting for go ahead of rings built early.
    queue[background ? 'push' : 'unshift']({ msg, owner, resolve });
    pump();
  });
}

// The last few rings, so going back is instant and the next ones can be built early:
// the slideshow's next ring, the studio carousel's four neighbours.
// ponytail: about 14 MB each, so only 6 are kept.
const cache = [];
function sharpRing(design, getPattern, key, owner, background = false) {
  let hit = cache.find((c) => sameKey(c.key, key));
  if (hit) return hit;
  hit = { key, geom: null };
  hit.promise = requestBuild(design, getPattern, owner, background).then((geom) => {
    if (geom) hit.geom = geom;
    else if (cache.includes(hit)) cache.splice(cache.indexOf(hit), 1); // replaced by a newer request
    return geom;
  });
  cache.unshift(hit);
  cache.length = Math.min(cache.length, 6);
  return hit;
}

/** Builds rings ahead of time, in order, so a RingView shows them the moment their design arrives. Replaces the last list. */
export function prebuildRings(designs, getPattern = patternById) {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].owner === 'prebuild') queue.splice(i, 1)[0].resolve(null);
  for (const d of designs) sharpRing(d, getPattern, shapeKey(d, getPattern), 'prebuild', true);
}

/** Resolves once this design's ring is built (true) or replaced by a newer request (false), so a page can switch its text and the ring in the same frame. */
export const ringReady = (design, getPattern = patternById) =>
  sharpRing(design, getPattern, shapeKey(design, getPattern), 'ready').promise.then(Boolean);

/**
 * 3D ring. `getPattern` lets the pattern editor inject a draft pattern.
 * `focus` (optional) returns the element to frame the ring on when the view fills a larger area.
 * `onViewer` receives the RingViewer instance (for reset view, snapshots, try-on scaling).
 */
export function RingView({ design, getPattern = patternById, mode = 'studio', autoRotate = false, zoom, focus, className = '', onViewer, label }) {
  const host = useRef();
  const viewer = useRef();
  const shape = useRef(null);
  const asked = useRef(0); // numbers each ring this view asks for
  const shown = useRef(0); // number of the ring on screen
  const [ready, setReady] = useState(false); // until the first ring arrives, the view says it is on its way

  useLayoutEffect(() => {
    viewer.current = new RingViewer(host.current, { mode, autoRotate, zoom, focus });
    onViewer?.(viewer.current);
    return () => {
      viewer.current.dispose();
      viewer.current = null;
    };
  }, []);

  useEffect(() => viewer.current?.setAutoRotate(autoRotate), [autoRotate]);

  const pats = ZONES.map((z) => getPattern(design.patterns[z]));
  // Before paint, so a ring that is already built lands in the same frame as the cards and band map.
  useLayoutEffect(() => {
    // Material and plating only change the look, so the mesh is kept.
    const key = shapeKey(design, getPattern);
    if (shape.current && sameKey(key, shape.current)) return viewer.current.setLook(renderLook(design));
    shape.current = key;

    // Shape and look change together, so the ring never shows the new colour on the old pattern.
    // While flicking, a ring that finishes after the view moved on still shows if it is newer than the one
    // on screen, so the ring keeps up with the carousel instead of waiting for the last pick.
    const n = ++asked.current;
    const show = (geom) => {
      if (!geom || !viewer.current || n < shown.current) return;
      shown.current = n;
      setReady(true);
      const { innerD, outerD } = bandMetrics(design);
      viewer.current.setGeometry(geom, innerD, outerD + 2 * design.relief);
      viewer.current.setLook(renderLook(design));
    };
    const ring = sharpRing(design, getPattern, key, shape);
    if (ring.geom) show(ring.geom);
    else ring.promise.then(show);
  }, [design, ...pats]);

  const m = getMaterial(design.materialId);
  const desc =
    label ||
    `3D preview of the ring in ${m.name}. ${pats[0] ? `Middle: ${pats[0].name}.` : ''} ${pats[1] ? `Sides: ${pats[1].name}${pats[2] && pats[2] !== pats[1] ? ' and ' + pats[2].name : ''}.` : ''} Drag to rotate.`;
  // The waiting label is a CSS ::after on the host, so it never touches the canvas three.js puts inside.
  return html`<div class=${'ring-view ' + className + (ready ? '' : ' loading')} ref=${host} role="img" aria-label=${desc}
    aria-busy=${ready ? undefined : 'true'} data-loading=${mode === 'tryon' ? 'Placing your ring…' : 'Building your ring…'}></div>`;
}
