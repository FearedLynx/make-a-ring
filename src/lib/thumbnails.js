// Renders still images of designs with one shared, off-screen renderer,
// so a grid of templates doesn't need a WebGL context per card.
import { useEffect, useState } from 'preact/hooks';
import { RingViewer } from './viewer.js';
import { buildHeightmap } from './heightmap.js';
import { buildRingGeometry } from './ringGeometry.js';
import { bandMetrics } from './band.js';
import { renderLook } from './materials.js';

let viewer = null;
const cache = new Map();
const queue = [];
let busy = false;

function getViewer() {
  if (viewer) return viewer;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;height:320px;pointer-events:none;';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  viewer = new RingViewer(el, { mode: 'hero' });
  return viewer;
}

function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const run = () => {
    const job = queue.shift();
    if (!cache.has(job.key)) {
      const v = getViewer();
      const hm = buildHeightmap(job.design, job.getPattern);
      const { innerD, outerD } = bandMetrics(job.design);
      v.setGeometry(buildRingGeometry(job.design, hm), innerD, outerD + 2 * job.design.relief);
      v.resetView();
      v.setLook(renderLook(job.design));
      cache.set(job.key, v.snapshot());
    }
    job.done.forEach((fn) => fn(cache.get(job.key)));
    busy = false;
    if (queue.length) (window.requestIdleCallback || setTimeout)(pump);
  };
  (window.requestIdleCallback || setTimeout)(run);
}

/** Returns a data URL for the design once rendered (null until then). */
export function useThumbnail(key, design, getPattern) {
  const [url, setUrl] = useState(() => cache.get(key) || null);
  useEffect(() => {
    if (cache.has(key)) return setUrl(cache.get(key));
    let alive = true;
    const done = (u) => alive && setUrl(u);
    const existing = queue.find((j) => j.key === key);
    if (existing) existing.done.push(done);
    else queue.push({ key, design, getPattern, done: [done] });
    pump();
    return () => (alive = false);
  }, [key]);
  return url;
}
