import { useEffect, useRef } from 'preact/hooks';
import { html } from '../lib/html.js';
import { RingViewer } from '../lib/viewer.js';
import { buildHeightmap } from '../lib/heightmap.js';
import { buildRingGeometry } from '../lib/ringGeometry.js';
import { bandMetrics } from '../lib/band.js';
import { renderLook, getMaterial } from '../lib/materials.js';
import { patternById } from '../state.js';

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
    viewer.current.setLook(renderLook(design));
    // Material and plating only change the look, so the mesh is kept.
    const key = [JSON.stringify({ ...design, materialId: 0, plating: 0 }), ...pats];
    if (shape.current && key.every((k, i) => k === shape.current[i])) return;
    shape.current = key;

    const build = (W, detail) => {
      const geom = buildRingGeometry(design, buildHeightmap(design, getPattern, W), detail);
      const { innerD, outerD } = bandMetrics(design);
      viewer.current.setGeometry(geom, innerD, outerD + 2 * design.relief);
    };
    // A single change goes straight to the sharp ring (about 160 ms), so it never flashes a rough one.
    // Only while the user flicks quickly (changes under 400 ms apart) does a quicker build keep up,
    // and the sharp one follows once the input has been still for 200 ms.
    const now = performance.now();
    const burst = now - lastChange.current < 400;
    lastChange.current = now;
    cancelAnimationFrame(pending.current);
    clearTimeout(fine.current);
    pending.current = requestAnimationFrame(() => {
      if (!burst) return build(3072, 1.25);
      build(1536, 0.75);
      fine.current = setTimeout(() => build(3072, 1.25), 200);
    });
  }, [design, ...pats]);

  const m = getMaterial(design.materialId);
  const desc =
    label ||
    `3D preview of the ring in ${m.name}. ${pats[0] ? `Middle: ${pats[0].name}.` : ''} ${pats[1] ? `Sides: ${pats[1].name}${pats[2] && pats[2] !== pats[1] ? ' and ' + pats[2].name : ''}.` : ''} Drag to rotate.`;
  return html`<div class=${'ring-view ' + className} ref=${host} role="img" aria-label=${desc}></div>`;
}
