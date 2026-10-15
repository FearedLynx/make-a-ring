// Builds the ring mesh: a band revolved around the Y axis, with the pattern heightmap
// displaced into the outer surface. Units are millimetres.
import * as THREE from 'three';
import { sampleHeight } from './heightmap.js';
import { usToDiameter } from './sizes.js';

const NU = 1080; // segments around the ring (~0.06 mm each)

function profileFns(profile, r, t) {
  const dome = (s) => Math.sqrt(Math.max(0, 1 - s * s));
  switch (profile) {
    case 'domed':
      return { outer: (s) => r + t * (0.55 + 0.45 * dome(s)), inner: () => r };
    case 'comfort':
      return { outer: (s) => r + t * (0.8 + 0.2 * dome(s)), inner: (s) => r + t * 0.22 * s * s };
    case 'bevel':
      return { outer: (s) => r + t - t * 0.35 * Math.max(0, (Math.abs(s) - 0.8) / 0.2), inner: () => r };
    default:
      return { outer: () => r + t, inner: () => r };
  }
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function buildRingGeometry(design, hm) {
  const r = usToDiameter(design.sizeUS) / 2;
  const t = design.thickness;
  const w = design.width;
  const { outer, inner } = profileFns(design.profile, r, t);
  const edgeFade = Math.min(0.2, 0.3 / w); // keep the outer rim clean
  const sign = design.style === 'engraved' ? -1 : 1;
  const antique = design.finish === 'antique';

  // Each section is a list of rows; a row is { s, rho(u) , outerSurface }.
  const outerRows = Math.round(Math.min(200, Math.max(90, w / 0.045)));
  const sections = [
    { rows: Array.from({ length: outerRows + 1 }, (_, j) => ({ s: -1 + (2 * j) / outerRows, kind: 'outer' })) },
    { rows: [0, 0.5, 1].map((k) => ({ s: 1, kind: 'wall', k, from: 'outer' })) },
    { rows: Array.from({ length: 25 }, (_, j) => ({ s: 1 - (2 * j) / 24, kind: 'inner' })) },
    { rows: [0, 0.5, 1].map((k) => ({ s: -1, kind: 'wall', k, from: 'inner' })) },
  ];

  const positions = [];
  const colors = [];
  const indices = [];
  let base = 0;

  for (const sec of sections) {
    const rows = sec.rows.length;
    for (let i = 0; i < NU; i++) {
      const u = i / NU;
      const th = u * Math.PI * 2;
      const c = Math.cos(th), sn = Math.sin(th);
      for (const row of sec.rows) {
        let rho;
        let shade = 1;
        if (row.kind === 'outer') {
          const v = (row.s + 1) / 2;
          const h = sampleHeight(hm, u, v);
          const fade = smooth(0, edgeFade, v) * smooth(0, edgeFade, 1 - v);
          rho = outer(row.s) + sign * h * design.relief * fade;
          if (antique && hm.ranges.some(([a, b]) => v >= a && v <= b)) shade = design.style === 'engraved' ? 1 - 0.6 * h * fade : 0.46 + 0.54 * Math.max(h, 1 - fade);
        } else if (row.kind === 'inner') {
          rho = inner(row.s);
        } else {
          const a = outer(row.s), b = inner(row.s);
          rho = row.from === 'outer' ? a + (b - a) * row.k : b + (a - b) * row.k;
        }
        positions.push(rho * c, (row.s * w) / 2, rho * sn);
        colors.push(shade, shade, shade);
      }
    }
    for (let i = 0; i < NU; i++) {
      const i2 = (i + 1) % NU;
      for (let j = 0; j < rows - 1; j++) {
        const a = base + i * rows + j;
        const b = base + i2 * rows + j;
        const cc = base + i2 * rows + j + 1;
        const d = base + i * rows + j + 1;
        indices.push(a, d, cc, a, cc, b);
      }
    }
    base += NU * rows;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
