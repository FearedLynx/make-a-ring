// Builds ring meshes off the main thread, so the page keeps rotating and scrolling while a ring is made.
import { buildHeightmap } from './heightmap.js';
import { buildRingArrays } from './ringMesh.js';

onmessage = ({ data: { id, design, patterns, W, detail, engraving } }) => {
  const m = buildRingArrays(design, buildHeightmap(design, (pid) => patterns[pid], W), detail, engraving);
  postMessage({ id, mesh: m }, [m.positions.buffer, m.colors.buffer, m.normals.buffer, m.indices.buffer]);
};
