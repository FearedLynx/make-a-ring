// Hand illustration for the try-on (back of a right hand, fingers up), drawn as a flat vector illustration:
// one silhouette with a single outline, crisp light and shadow shapes from the upper left, nails and a few creases.
// Exposes finger anchors so the 3D ring can be placed exactly on a finger.
import { html } from '../lib/html.js';

export const SKIN_TONES = [
  { id: 0, name: 'Light', skin: '#f3d4bf', shade: '#e0b398', line: '#a8735a', nail: '#f9e6dc' },
  { id: 1, name: 'Light medium', skin: '#e2b08d', shade: '#cc9470', line: '#8f5a3c', nail: '#f0d2bf' },
  { id: 2, name: 'Medium', skin: '#c68b62', shade: '#ad734c', line: '#6e4127', nail: '#dcb196' },
  { id: 3, name: 'Medium deep', skin: '#8e5c3e', shade: '#76492e', line: '#3f2414', nail: '#b78b70' },
  { id: 4, name: 'Deep', skin: '#5c3b28', shade: '#4a2e1d', line: '#24130a', nail: '#8d6852' },
];

// Finger knuckles (bx, by), angle from vertical (a), length from the knuckle to the tip, and width at the base.
// The fingers touch at the base and fan out a little, as a relaxed hand does.
const BASE = {
  index: { bx: 156, by: 306, a: -3.5, len: 184, w: 45 },
  middle: { bx: 201, by: 298, a: 0, len: 204, w: 46 },
  ring: { bx: 245, by: 304, a: 3.5, len: 190, w: 43 },
  pinky: { bx: 284, by: 324, a: 8.5, len: 148, w: 37 },
};
const THUMB = { bx: 146, by: 428, a: -30, len: 136, w: 52 };
export const VIEW = { w: 400, h: 560 };
export const FULL = { x: 30, y: 70, w: 340, h: 480 };

/** A tight crop centred on the ring, for the close-up view. */
export function closeUp(build, finger) {
  const a = ringAnchor(build, finger);
  return { x: a.x - 85, y: a.y - 120, w: 170, h: 230 };
}

export function fingers(build) {
  const k = build === 'broad' ? 1.16 : 1;
  const out = {};
  for (const [id, f] of Object.entries(BASE)) out[id] = { ...f, w: f.w * k };
  return out;
}

/** Where a ring sits on the finger, in view-box units. */
export function ringAnchor(build, finger) {
  const f = fingers(build)[finger];
  const d = f.len * 0.3;
  const r = (f.a * Math.PI) / 180;
  return { x: f.bx + Math.sin(r) * d, y: f.by - Math.cos(r) * d, angle: f.a, width: f.w };
}

const n = (v) => +v.toFixed(2);

/** A smooth path through points (Catmull-Rom as cubic Béziers), continuing from the current point. */
function through(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d;
}

/** Outline round a spine of [x, y, half width] points running from the base to the tip, closed by a round tip. */
function limb(spine) {
  const L = [], R = [];
  spine.forEach(([x, y, hw], i) => {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(spine.length - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
    R.push([x + nx * hw, y + ny * hw]);
    L.push([x - nx * hw, y - ny * hw]);
  });
  const r = spine.at(-1)[2], l = L.at(-1);
  R.reverse();
  return `M${n(L[0][0])} ${n(L[0][1])}${through(L)} A${n(r)} ${n(r)} 0 0 1 ${n(R[0][0])} ${n(R[0][1])}${through(R)} Z`;
}

/**
 * One finger in its own frame: the knuckle at y = 0, the tip at y = -L. Nearly straight sides that ease in towards
 * the tip and swell a touch at the two joints. It runs on into the back of the hand, which hides the join.
 */
function fingerSpine(L, W) {
  const h = W / 2, r = h * 0.86;
  return [[0, 50, h * 1.04], [0, 0, h], [0, -0.3 * L, h * 0.97], [0, -0.5 * L, h * 0.98], [0, -0.68 * L, h * 0.9], [0, -0.8 * L, h * 0.91], [0, -L + r, r]];
}

/** The thumb, seen from the side as it is from the back of the hand: thick at the base, bending gently in. */
function thumbSpine(L, W) {
  const h = W / 2, r = h * 0.78;
  return [[0, 70, h * 1.1], [0, 0, h], [-1, -0.42 * L, h * 0.9], [0, -0.6 * L, h * 0.86], [3, -0.8 * L, h * 0.84], [6, -L + r, r]];
}

/** The nail: rounded towards the tip, a curved cuticle towards the hand. */
function nailPath(L, W, k = 1, dx = 0) {
  const w = W * 0.29 * k, top = -L + W * 0.1, bottom = -L + W * 0.95;
  const x = (v) => n(v + dx);
  return `M${x(-w)} ${n(bottom)} C${x(-w * 1.04)} ${n(top + w * 0.9)} ${x(-w * 0.72)} ${n(top)} ${x(0)} ${n(top)} C${x(w * 0.72)} ${n(top)} ${x(w * 1.04)} ${n(top + w * 0.9)} ${x(w)} ${n(bottom)} Q${x(0)} ${n(bottom + W * 0.14)} ${x(-w)} ${n(bottom)} Z`;
}

/** Short skin folds across a joint: a few soft arcs, the longest first. */
function creases(y, W, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const yy = y + i * W * 0.1, ww = W * (0.2 - i * 0.045);
    out.push(`M${n(-ww)} ${n(yy)} q${n(ww)} ${n(-W * 0.07)} ${n(ww * 2)} 0`);
  }
  return out.join(' ');
}

// The back of the hand and the wrist as one shape. Along the top it dips between the fingers into the webs; on the
// left it runs into the thumb, so the web between thumb and index is part of the outline.
const PALM_PTS = [[128, 560], [127, 520], [120, 478], [112, 446], [118, 404], [124, 376], [130, 344], [134, 318], [150, 300], [177, 287], [200, 284], [223, 287], [246, 292], [266, 300], [286, 312], [300, 322], [308, 350], [311, 390], [310, 414], [300, 458], [284, 494], [274, 524], [272, 560]];
const PALM = `M${PALM_PTS[0][0]} ${PALM_PTS[0][1]}${through(PALM_PTS)} Z`;

export function Hand({ tone = 1, build = 'slender', crop = FULL, className = '' }) {
  const t = SKIN_TONES[tone];
  const F = fingers(build);
  const k = build === 'broad' ? 1.08 : 1;
  const widen = `translate(${200 * (1 - k)} 0) scale(${k} 1)`;
  // Lines keep about the same weight on screen in the close-up.
  const lw = crop.w < FULL.w ? 0.6 : 1;
  const thumbW = THUMB.w * (build === 'broad' ? 1.12 : 1);
  const digits = [
    { id: 'thumb', ...THUMB, w: thumbW, d: limb(thumbSpine(THUMB.len, thumbW)) },
    ...['pinky', 'ring', 'middle', 'index'].map((id) => ({ id, ...F[id], d: limb(fingerSpine(F[id].len, F[id].w)) })),
  ];
  const at = (f) => `translate(${f.bx} ${f.by}) rotate(${f.a})`;

  // The silhouette twice: a stroked copy underneath, then the plain fill on top, so only the outer outline shows.
  const silhouette = (attrs) => html`
    <path d=${PALM} transform=${widen} ...${attrs} />
    ${digits.map((f) => html`<path d=${f.d} transform=${at(f)} key=${f.id} ...${attrs} />`)}`;

  // Light from the upper left: a shadow down the right of each digit, a soft highlight down the left.
  const digit = (f) => {
    const h = f.w / 2, L = f.len, thumb = f.id === 'thumb';
    return html`<g transform=${at(f)} key=${f.id}>
      <clipPath id=${'hand-clip-' + f.id}><path d=${f.d} /></clipPath>
      <g clip-path=${`url(#hand-clip-${f.id})`}>
        <path d=${`M${n(h * 1.4)} 40 L${n(h * 1.4)} ${n(-L - 10)} L${n(h * 0.3)} ${n(-L - 10)} C${n(h * 0.34)} ${n(-0.6 * L)} ${n(h * 0.4)} ${n(-0.22 * L)} ${n(h * 1.3)} ${n(thumb ? -0.32 * L : -8)} Z`} fill=${t.shade} />
        <path d=${`M${n(-h * 0.5)} ${n(-0.3 * L)} L${n(-h * 0.52)} ${n(-L + h * 1.6)}`} stroke="#fff" stroke-opacity=".12" stroke-width=${n(h * 0.3)} stroke-linecap="round" />
      </g>
      <path d=${creases(-0.5 * L - f.w * 0.08, f.w, 3)} fill="none" stroke=${t.line} stroke-width=${1.1 * lw} stroke-linecap="round" opacity=".35" />
      ${!thumb && html`<path d=${creases(-0.8 * L + f.w * 0.02, f.w, 2)} fill="none" stroke=${t.line} stroke-width=${lw} stroke-linecap="round" opacity=".28" />`}
      <path d=${nailPath(L, f.w, thumb ? 0.85 : 1, thumb ? -h * 0.12 : 0)} fill=${t.nail} stroke=${t.line} stroke-width=${0.9 * lw} stroke-opacity=".5" />
      <path d=${`M${n(-f.w * 0.13 - (thumb ? h * 0.12 : 0))} ${n(-L + f.w * 0.3)} l0 ${n(f.w * 0.36)}`} stroke="#fff" stroke-opacity=".7" stroke-width=${n(f.w * 0.07)} stroke-linecap="round" />
    </g>`;
  };
  // Where two fingers touch, a short line runs down to the web.
  const seam = (f) => {
    const h = f.w / 2;
    return html`<path transform=${at(f)} key=${'s' + f.id} d=${`M${n(h * 0.98)} ${n(-14)} L${n(h * 0.95)} ${n(-0.24 * f.len)}`} stroke=${t.line} stroke-width=${1.2 * lw} stroke-linecap="round" opacity=".45" />`;
  };
  return html`<svg class=${'hand ' + className} viewBox=${`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <filter id="hand-drop" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#3a2a1c" flood-opacity=".16" />
      </filter>
    </defs>
    <g filter="url(#hand-drop)">
      ${silhouette({ fill: t.line, stroke: t.line, 'stroke-width': 3.2 * lw, 'stroke-linejoin': 'round' })}
      ${silhouette({ fill: t.skin })}
      <g transform=${widen}>
        <clipPath id="hand-clip-palm"><path d=${PALM} /></clipPath>
        <path clip-path="url(#hand-clip-palm)" d="M306 320 C292 370 296 440 270 520 L276 580 L340 580 L340 300 Z" fill=${t.shade} />
      </g>
      ${digits.map(digit)}
      ${['index', 'middle', 'ring'].map((id) => seam(F[id]))}
      <g transform=${widen}>
        <path class="sleeve" d="M124 520 C150 510 250 510 276 520 L282 584 L118 584 Z" />
        <path d="M124 520 C150 510 250 510 276 520" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2" />
        ${[146, 168, 189, 211, 232, 254].map((x) => html`<line x1=${x} y1="520" x2=${x} y2="584" stroke="#000" stroke-opacity=".14" stroke-width="2" key=${x} />`)}
      </g>
    </g>
  </svg>`;
}
