// Builds the ring mesh: a band revolved around the Y axis, with the pattern heightmap
// displaced into the outer surface. Units are millimetres.
// Plain arrays and no DOM, so it also runs in the ring worker; ringGeometry.js wraps it for three.js.
import { sampleHeight } from './heightmap.js';
import { usToDiameter } from './sizes.js';

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

/**
 * `detail` scales the mesh density: 1.25 for the live preview, 1 for exported files.
 * `engraving` is { map, depth, h } for text cut into the inside, or null.
 */
export function buildRingArrays(design, hm, detail = 1.25, engraving = null) {
  const NU = Math.round(1080 * detail); // segments around the ring (~0.05 mm each at detail 1)
  const r = usToDiameter(design.sizeUS) / 2;
  const t = design.thickness;
  const w = design.width;
  const { outer, inner } = profileFns(design.profile, r, t);
  const edgeFade = Math.min(0.2, 0.3 / w); // keep the outer rim clean
  const sign = design.style === 'engraved' ? -1 : 1;
  const antique = design.finish === 'antique';
  const engr = engraving?.map;
  const engrDepth = engraving?.depth || 0;

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
        const half = Math.min(1, (engraving.h * 0.7 + 0.3) / (w / 2));
        const n = Math.ceil((half * w) / 0.05); // 0.05 mm rows resolve the letter strokes
        for (let j = 0; j <= n; j++) ss.push(half - (2 * half * j) / n);
      }
      const rows = [...new Set(ss.map((s) => +s.toFixed(6)))].sort((a, b) => b - a);
      return { rows: rows.map((s) => ({ s, kind: 'inner' })) };
    })(),
    { rows: [0, 0.5, 1].map((k) => ({ s: -1, kind: 'wall', k, from: 'inner' })) },
  ];

  // Per-row values that do not change around the ring, so the vertex loop below stays cheap.
  for (const row of sections[0].rows) {
    row.v = (row.s + 1) / 2;
    row.base = outer(row.s);
    row.fade = smooth(0, edgeFade, row.v) * smooth(0, edgeFade, 1 - row.v);
    row.antique = antique && hm.ranges.some(([a, b]) => row.v >= a && row.v <= b);
  }

  const nRows = sections.reduce((n, sec) => n + sec.rows.length, 0);
  const positions = new Float32Array(NU * nRows * 3);
  const colors = new Uint8Array(NU * nRows * 3); // 0..255 shade; bytes keep the cached rings and GPU upload small
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
          const h = sampleHeight(hm, u, row.v);
          const fade = row.fade;
          rho = row.base + sign * h * design.relief * fade;
          if (row.antique) shade = design.style === 'engraved' ? 1 - 0.6 * h * fade : 0.46 + 0.54 * Math.max(h, 1 - fade);
        } else if (row.kind === 'inner') {
          rho = inner(row.s);
          if (engr) {
            const h = sampleHeight(engr, u, (row.s + 1) / 2);
            rho += engrDepth * h; // cut outwards, into the metal
            if (antique && h > 0.05) shade = 1 - 0.55 * h;
          }
        } else {
          const a = outer(row.s), b = inner(row.s);
          rho = row.from === 'outer' ? a + (b - a) * row.k : b + (a - b) * row.k;
        }
        positions[p] = rho * c;
        positions[p + 1] = (row.s * w) / 2;
        positions[p + 2] = rho * sn;
        colors[p] = colors[p + 1] = colors[p + 2] = Math.round(shade * 255);
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
        indices[q++] = a; indices[q++] = d; indices[q++] = cc;
        indices[q++] = a; indices[q++] = cc; indices[q++] = b;
      }
    }
    base += NU * rows;
  }

  return { positions, colors, indices, normals: vertexNormals(positions, indices), sphere: boundingSphere(positions) };
}

/** Same sphere as three's computeBoundingSphere: centred on the bounding box, out to the farthest vertex. */
function boundingSphere(pos) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (pos[i + k] < lo[k]) lo[k] = pos[i + k];
      if (pos[i + k] > hi[k]) hi[k] = pos[i + k];
    }
  }
  const c = lo.map((v, k) => (v + hi[k]) / 2);
  let r2 = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const dx = pos[i] - c[0], dy = pos[i + 1] - c[1], dz = pos[i + 2] - c[2];
    r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
  }
  return { center: c, radius: Math.sqrt(r2) };
}

/**
 * Same result as three's computeVertexNormals, on the raw arrays: about 10x faster on a 300k-vertex ring.
 * Stored as 16-bit (read back as -1..1), half the size of floats with no visible difference.
 */
function vertexNormals(pos, idx) {
  const nor = new Float32Array(pos.length);
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
    const cbx = pos[c] - pos[b], cby = pos[c + 1] - pos[b + 1], cbz = pos[c + 2] - pos[b + 2];
    const abx = pos[a] - pos[b], aby = pos[a + 1] - pos[b + 1], abz = pos[a + 2] - pos[b + 2];
    const nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
    nor[a] += nx; nor[a + 1] += ny; nor[a + 2] += nz;
    nor[b] += nx; nor[b + 1] += ny; nor[b + 2] += nz;
    nor[c] += nx; nor[c + 1] += ny; nor[c + 2] += nz;
  }
  const out = new Int16Array(nor.length);
  for (let i = 0; i < nor.length; i += 3) {
    const l = (Math.sqrt(nor[i] * nor[i] + nor[i + 1] * nor[i + 1] + nor[i + 2] * nor[i + 2]) || 1) / 32767;
    out[i] = Math.round(nor[i] / l);
    out[i + 1] = Math.round(nor[i + 1] / l);
    out[i + 2] = Math.round(nor[i + 2] / l);
  }
  return out;
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
