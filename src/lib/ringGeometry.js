// Builds the ring mesh: a band revolved around the Y axis, with the pattern heightmap
// displaced into the outer surface. Units are millimetres.
import * as THREE from 'three';
import { sampleHeight } from './heightmap.js';
import { usToDiameter } from './sizes.js';
import { buildEngravingMap, engravingLayout, ENGRAVE_DEPTH } from './engraving.js';

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

/** `detail` scales the mesh density: 1.25 for the live preview, higher for exported files. */
export function buildRingGeometry(design, hm, detail = 1.25) {
  const NU = Math.round(1080 * detail); // segments around the ring (~0.05 mm each at detail 1)
  const r = usToDiameter(design.sizeUS) / 2;
  const t = design.thickness;
  const w = design.width;
  const { outer, inner } = profileFns(design.profile, r, t);
  const edgeFade = Math.min(0.2, 0.3 / w); // keep the outer rim clean
  const sign = design.style === 'engraved' ? -1 : 1;
  const antique = design.finish === 'antique';
  const engr = buildEngravingMap(design); // text cut into the inside, or null

  // Each section is a list of rows; a row is { s, rho(u) , outerSurface }.
  const outerRows = Math.round(detail * Math.min(200, Math.max(90, w / 0.045)));
  const sections = [
    { rows: Array.from({ length: outerRows + 1 }, (_, j) => ({ s: -1 + (2 * j) / outerRows, kind: 'outer' })) },
    { rows: [0, 0.5, 1].map((k) => ({ s: 1, kind: 'wall', k, from: 'outer' })) },
    // The inside only needs a few rows, plus dense ones across the engraving band (letters with
    // descenders and a little margin) so the text resolves without bloating the exported file.
    (() => {
      const ss = Array.from({ length: 25 }, (_, j) => 1 - j / 12);
      if (engr) {
        const half = Math.min(1, (engravingLayout(design).h * 0.7 + 0.3) / (w / 2));
        const n = Math.ceil((half * w) / 0.05); // 0.05 mm rows resolve the letter strokes
        for (let j = 0; j <= n; j++) ss.push(half - (2 * half * j) / n);
      }
      const rows = [...new Set(ss.map((s) => +s.toFixed(6)))].sort((a, b) => b - a);
      return { rows: rows.map((s) => ({ s, kind: 'inner' })) };
    })(),
    { rows: [0, 0.5, 1].map((k) => ({ s: -1, kind: 'wall', k, from: 'inner' })) },
  ];

  const nRows = sections.reduce((n, sec) => n + sec.rows.length, 0);
  const positions = new Float32Array(NU * nRows * 3);
  const colors = new Float32Array(NU * nRows * 3);
  const indices = new Uint32Array(NU * (nRows - sections.length) * 6);
  let base = 0, p = 0, q = 0;

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
          if (engr) {
            const h = sampleHeight(engr, u, (row.s + 1) / 2);
            rho += ENGRAVE_DEPTH * h; // cut outwards, into the metal
            if (antique && h > 0.05) shade = 1 - 0.55 * h;
          }
        } else {
          const a = outer(row.s), b = inner(row.s);
          rho = row.from === 'outer' ? a + (b - a) * row.k : b + (a - b) * row.k;
        }
        positions.set([rho * c, (row.s * w) / 2, rho * sn], p);
        colors.fill(shade, p, p + 3);
        p += 3;
      }
    }
    for (let i = 0; i < NU; i++) {
      const i2 = (i + 1) % NU;
      for (let j = 0; j < rows - 1; j++) {
        const a = base + i * rows + j;
        const b = base + i2 * rows + j;
        const cc = base + i2 * rows + j + 1;
        const d = base + i * rows + j + 1;
        indices.set([a, d, cc, a, cc, b], q);
        q += 6;
      }
    }
    base += NU * rows;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * How far the outer surface falls away from its highest point at s (-1..1 across the band),
 * as a fraction of the thickness. The editor uses this to shade where a pattern will bend.
 */
export function bendAt(profile, s) {
  const dome = 1 - Math.sqrt(Math.max(0, 1 - s * s));
  if (profile === 'domed') return 0.45 * dome;
  if (profile === 'comfort') return 0.2 * dome;
  if (profile === 'bevel') return 0.35 * Math.max(0, (Math.abs(s) - 0.8) / 0.2);
  return 0;
}

/** Width (as a fraction of the band) of the rim strip where the pattern fades out. */
export const rimFade = (width) => Math.min(0.2, 0.3 / width);
