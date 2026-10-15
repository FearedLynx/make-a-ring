// Draws the unrolled band (all zones, tiled) into a grayscale heightmap.
// u (x) runs around the circumference, v (y) runs across the band width.
import { layoutZones } from './templates.js';
import { bandMetrics, resolveZones } from './band.js';

const W = 3072; // ~50 px per mm around a typical ring
let canvas;

function ctx2d(w, h) {
  if (!canvas) canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext('2d', { willReadFrequently: true });
}

export function buildHeightmap(design, getPattern) {
  const { circ } = bandMetrics(design);
  const pxPerMM = W / circ;
  const H = Math.max(64, Math.min(640, Math.round(design.width * pxPerMM)));
  const ctx = ctx2d(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ctx.fillStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const ranges = []; // zones that carry a pattern (the antique finish only darkens these)
  for (const z of resolveZones(design, getPattern)) {
    if (!z.pattern) continue;
    ranges.push([z.from, z.to]);
    const y0 = z.from * H;
    const zh = (z.to - z.from) * H;
    const tileW = W / z.repeats;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, W, zh);
    ctx.clip();
    ctx.lineWidth = Math.max(1, z.lineMM * pxPerMM);
    const mapY = z.flip ? (y) => y0 + zh - y * zh : (y) => y0 + y * zh;
    // Draw one extra tile on each end so strokes that overhang a tile wrap around the seam.
    for (let i = -1; i <= z.repeats; i++) {
      const x0 = i * tileW;
      for (const s of z.pattern.strokes) {
        if (!s.pts.length) continue;
        ctx.beginPath();
        s.pts.forEach(([x, y], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, x0 + x * tileW, mapY(y)));
        if (s.closed) ctx.closePath();
        if (s.fill) ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Thin raised rails between zones.
  ctx.lineWidth = Math.max(1.5, 0.3 * pxPerMM);
  for (const f of layoutZones(design).dividers) {
    ctx.beginPath();
    ctx.moveTo(0, f * H);
    ctx.lineTo(W, f * H);
    ctx.stroke();
  }

  const img = ctx.getImageData(0, 0, W, H).data;
  let data = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) data[i] = img[i * 4] / 255;
  data = blur(data, W, H);
  return { data, W, H, ranges };
}

// Separable box blur (wraps around u) to soften the relief edges.
function blur(src, w, h, r = 1) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + ((x + k + w) % w)];
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = s / n;
    }
  }
  return out;
}

/** Bilinear sample, u wraps, v clamps. u, v in 0..1. */
export function sampleHeight(hm, u, v) {
  const x = u * hm.W, y = v * (hm.H - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const xa = ((x0 % hm.W) + hm.W) % hm.W, xb = (xa + 1) % hm.W;
  const ya = Math.min(hm.H - 1, Math.max(0, y0)), yb = Math.min(hm.H - 1, ya + 1);
  const d = hm.data;
  const a = d[ya * hm.W + xa], b = d[ya * hm.W + xb], c = d[yb * hm.W + xa], e = d[yb * hm.W + xb];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
}
