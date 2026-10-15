// three.js side of the ring mesh: wraps the plain arrays from ringMesh.js in a BufferGeometry.
import * as THREE from 'three';
import { buildRingArrays } from './ringMesh.js';
import { buildEngravingMap, engravingLayout } from './engraving.js';
export { bendAt, rimFade } from './ringMesh.js';

/** Inside engraving for the mesh builder. It draws text with the page's web fonts, so it is built here, not in the worker. */
export function engravingFor(design) {
  const map = buildEngravingMap(design);
  if (!map) return null;
  const { depth, h } = engravingLayout(design);
  return { map, depth, h };
}

export function toGeometry({ positions, colors, normals, indices, sphere }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...sphere.center), sphere.radius);
  return g;
}

/** `detail` scales the mesh density: 1.25 for the live preview, 1 for exported files. */
export const buildRingGeometry = (design, hm, detail = 1.25) => toGeometry(buildRingArrays(design, hm, detail, engravingFor(design)));
