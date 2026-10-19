// Hand illustration for the try-on (back of a right hand, fingers up), drawn like a catalogue illustration:
// tapered fingers with joints, nails, knuckles and a soft contour, lit from the upper left.
// Exposes finger anchors so the 3D ring can be placed exactly on a finger.
import { html } from '../lib/html.js';

export const SKIN_TONES = [
  { id: 0, name: 'Light', skin: '#f3d4bf', shade: '#d9ad92', nail: '#f7e1d6' },
  { id: 1, name: 'Light medium', skin: '#e2b08d', shade: '#c48d69', nail: '#efcdb7' },
  { id: 2, name: 'Medium', skin: '#c68b62', shade: '#a36c47', nail: '#ddb093' },
  { id: 3, name: 'Medium deep', skin: '#8e5c3e', shade: '#6f432a', nail: '#b98a6d' },
  { id: 4, name: 'Deep', skin: '#5c3b28', shade: '#43291a', nail: '#8a644d' },
];

// Finger bases (bx, by), angle from vertical (a), length from the knuckle to the tip, and width at the base.
const BASE = {
  index: { bx: 151, by: 300, a: -6, len: 168, w: 46 },
  middle: { bx: 198, by: 292, a: -1, len: 192, w: 48 },
  ring: { bx: 244, by: 298, a: 4.5, len: 176, w: 45 },
  pinky: { bx: 285, by: 318, a: 11, len: 130, w: 38 },
  thumb: { bx: 144, by: 446, a: -36, len: 128, w: 54 },
};
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

/**
 * One finger in its own frame: the knuckle at y = 0, the tip at y = -L. It tapers towards the tip and swells a
 * little at the two joints, which is what stops it reading as a sausage. It runs on into the palm, which covers it.
 */
function fingerPath(L, W) {
  const h = W / 2;
  const tip = h * 0.84;
  const side = [
    [60, h * 1.08],
    [0, h],
    [-0.3 * L, h * 0.92],
    [-0.52 * L, h * 0.95], // middle joint
    [-0.7 * L, h * 0.87],
    [-0.8 * L, h * 0.89], // end joint
    [-L + tip, tip],
  ];
  const left = side.map(([y, hw]) => [-hw, y]);
  const right = side.map(([y, hw]) => [hw, y]).reverse();
  return `M${n(left[0][0])} ${n(left[0][1])}${through(left)} A${n(tip)} ${n(tip * 1.08)} 0 0 1 ${n(tip)} ${n(-L + tip)}${through(right)} Z`;
}

/** The nail: rounded towards the tip, a curved cuticle towards the hand. */
function nailPath(L, W) {
  const w = W * 0.3, top = -L + W * 0.1, bottom = -L + W * 0.98;
  return `M${n(-w)} ${n(bottom)} C${n(-w * 1.04)} ${n(top + w * 0.9)} ${n(-w * 0.72)} ${n(top)} 0 ${n(top)} C${n(w * 0.72)} ${n(top)} ${n(w * 1.04)} ${n(top + w * 0.9)} ${n(w)} ${n(bottom)} Q0 ${n(bottom + W * 0.16)} ${n(-w)} ${n(bottom)} Z`;
}

/** Short skin folds across a joint: back-of-hand creases are a few soft, broken arcs, not one line. */
function creases(y, W, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const yy = y + i * W * 0.11, ww = W * (0.24 - i * 0.04);
    out.push(`M${n(-ww)} ${n(yy)} q${n(ww)} ${n(-W * 0.09)} ${n(ww * 2)} 0`);
  }
  return out.join(' ');
}

// The back of the hand: its top edge runs along the knuckles, it bulges a little over the thumb and narrows to the wrist.
const PALM_PTS = [[124, 312], [150, 297], [198, 289], [244, 295], [285, 313], [306, 330], [308, 378], [300, 428], [286, 466], [266, 494], [232, 504], [190, 504], [156, 494], [136, 468], [118, 428], [116, 376], [124, 312]];
const PALM = `M${PALM_PTS[0][0]} ${PALM_PTS[0][1]}${through(PALM_PTS)} Z`;
// Its outline runs down the sides and round the wrist only: along the knuckles the fingers flow into it.
const SIDES = PALM_PTS.slice(4);
const PALM_EDGE = `M${SIDES[0][0]} ${SIDES[0][1]}${through(SIDES)}`;

export function Hand({ tone = 1, build = 'slender', crop = FULL, className = '' }) {
  const t = SKIN_TONES[tone];
  const F = fingers(build);
  const k = build === 'broad' ? 1.08 : 1;
  const widen = `translate(${200 * (1 - k)} 0) scale(${k} 1)`;
  const finger = (f, id) => {
    const body = fingerPath(f.len, f.w);
    return html`<g transform=${`translate(${f.bx} ${f.by}) rotate(${f.a})`} key=${id} mask="url(#hand-fade)">
      <path d=${body} fill=${t.skin} />
      <path d=${body} fill="url(#hand-across)" />
      <path d=${body} fill="url(#hand-along)" />
      <path d=${body} fill="none" stroke=${t.shade} stroke-width="1.1" stroke-opacity=".75" />
      <path d=${creases(-0.52 * f.len - f.w * 0.1, f.w, 3)} fill="none" stroke=${t.shade} stroke-width="1.3" stroke-linecap="round" opacity=".55" />
      <path d=${creases(-0.8 * f.len, f.w, 2)} fill="none" stroke=${t.shade} stroke-width="1.1" stroke-linecap="round" opacity=".45" />
      <path d=${nailPath(f.len, f.w)} fill=${t.nail} stroke=${t.shade} stroke-width=".9" stroke-opacity=".7" />
      <path d=${nailPath(f.len, f.w)} fill="url(#hand-nail)" />
      <path d=${`M${n(-f.w * 0.12)} ${n(-f.len + f.w * 0.3)} q${n(-f.w * 0.06)} ${n(f.w * 0.25)} 0 ${n(f.w * 0.5)}`} stroke="#fff" stroke-opacity=".55" stroke-width=${n(f.w * 0.06)} stroke-linecap="round" fill="none" />
    </g>`;
  };
  // Knuckles: a soft highlight where each finger meets the back of the hand, and the tendon fanning towards the wrist.
  const knuckle = (f, id) => {
    const r = (f.a * Math.PI) / 180, x = f.bx - Math.sin(r) * 6, y = f.by + Math.cos(r) * 6;
    return html`<g key=${'k' + id}>
      <ellipse cx=${n(x)} cy=${n(y + 4)} rx=${n(f.w * 0.32)} ry=${n(f.w * 0.2)} fill="url(#hand-knuckle)" />
      <path d=${`M${n(x)} ${n(y + f.w * 0.3)} Q${n(x + (200 - x) * 0.2)} ${n(y + 70)} ${n(x + (200 - x) * 0.45)} ${n(y + 150)}`} fill="none" stroke=${t.shade} stroke-width="1.4" stroke-linecap="round" opacity=".13" />
    </g>`;
  };

  return html`<svg class=${'hand ' + className} viewBox=${`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="hand-across" x1="0" x2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".2" />
        <stop offset=".22" stop-color="#000" stop-opacity=".02" />
        <stop offset=".42" stop-color="#fff" stop-opacity=".16" />
        <stop offset=".7" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".24" />
      </linearGradient>
      <linearGradient id="hand-along" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".06" />
        <stop offset=".75" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".18" />
      </linearGradient>
      <linearGradient id="hand-nail" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".45" />
        <stop offset=".55" stop-color="#fff" stop-opacity=".12" />
        <stop offset="1" stop-color="#000" stop-opacity=".08" />
      </linearGradient>
      <radialGradient id="hand-back" cx=".42" cy=".3" r=".75">
        <stop offset="0" stop-color="#fff" stop-opacity=".14" />
        <stop offset=".6" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".2" />
      </radialGradient>
      <radialGradient id="hand-knuckle">
        <stop offset="0" stop-color="#fff" stop-opacity=".28" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="hand-wrist" x1="0" x2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".22" />
        <stop offset=".45" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".26" />
      </linearGradient>
      <linearGradient id="hand-fade-g" gradientUnits="userSpaceOnUse" x1="0" y1="-6" x2="0" y2="34">
        <stop offset="0" stop-color="#fff" />
        <stop offset="1" stop-color="#000" />
      </linearGradient>
      <mask id="hand-fade" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-80" y="-280" width="160" height="380">
        <rect x="-80" y="-280" width="160" height="380" fill="url(#hand-fade-g)" />
      </mask>
      <filter id="hand-drop" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#3a2a1c" flood-opacity=".2" />
      </filter>
      <filter id="hand-lift" x="-30%" y="-10%" width="160%" height="120%">
        <feDropShadow dx="1.5" dy="2" stdDeviation="2.5" flood-color="#2a1a10" flood-opacity=".22" />
      </filter>
    </defs>
    <g filter="url(#hand-drop)">
      <g transform=${widen}>
        <path d="M160 460 C162 500 160 540 156 584 L264 584 C260 540 258 500 260 460 Z" fill=${t.skin} />
        <path d="M160 460 C162 500 160 540 156 584 L264 584 C260 540 258 500 260 460 Z" fill="url(#hand-wrist)" />
      </g>
      <g transform=${widen}>
        <path d=${PALM} fill=${t.skin} />
        <path d=${PALM} fill="url(#hand-back)" />
        <path d=${PALM_EDGE} fill="none" stroke=${t.shade} stroke-width="1.1" stroke-opacity=".7" />
      </g>
      <g filter="url(#hand-lift)">${finger(F.thumb, 'thumb')}</g>
      <g filter="url(#hand-lift)">${['pinky', 'ring', 'middle', 'index'].map((id) => finger(F[id], id))}</g>
      ${['index', 'middle', 'ring', 'pinky'].map((id) => knuckle(F[id], id))}
      <g transform=${widen}>
        <path class="sleeve" d="M138 520 C162 512 258 512 282 520 L288 584 L132 584 Z" />
        <path d="M138 520 C162 512 258 512 282 520" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2" />
        ${[158, 179, 200, 221, 242, 263].map((x) => html`<line x1=${x} y1="522" x2=${x} y2="584" stroke="#000" stroke-opacity=".14" stroke-width="2" key=${x} />`)}
      </g>
    </g>
  </svg>`;
}
