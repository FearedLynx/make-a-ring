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

  useEffect(() => {
    viewer.current = new RingViewer(host.current, { mode, autoRotate, zoom });
    onViewer?.(viewer.current);
    return () => {
      cancelAnimationFrame(pending.current);
      viewer.current.dispose();
    };
  }, []);

  useEffect(() => viewer.current?.setAutoRotate(autoRotate), [autoRotate]);

  const pats = ['middle', 'sideL', 'sideR'].map((z) => getPattern(design.patterns[z]));
  useEffect(() => {
    cancelAnimationFrame(pending.current);
    pending.current = requestAnimationFrame(() => {
      const hm = buildHeightmap(design, getPattern);
      const geom = buildRingGeometry(design, hm);
      const { innerD, outerD } = bandMetrics(design);
      viewer.current.setGeometry(geom, innerD, outerD + 2 * design.relief);
      viewer.current.setLook(renderLook(design));
    });
  }, [design, ...pats]);

  const m = getMaterial(design.materialId);
  const desc =
    label ||
    `3D preview of the ring in ${m.name}. ${pats[0] ? `Middle: ${pats[0].name}.` : ''} ${pats[1] ? `Sides: ${pats[1].name}${pats[2] && pats[2] !== pats[1] ? ' and ' + pats[2].name : ''}.` : ''} Drag to rotate.`;
  return html`<div class=${'ring-view ' + className} ref=${host} role="img" aria-label=${desc}></div>`;
}
