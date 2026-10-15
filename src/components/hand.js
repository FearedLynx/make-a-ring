// Stylised hand illustration (back of the hand, fingers up) used for the try-on.
// Exposes finger anchors so the 3D ring can be placed exactly on a finger.
import { html } from '../lib/html.js';

export const SKIN_TONES = [
  { id: 0, name: 'Light', skin: '#f3d4bf', shade: '#d9ad92', nail: '#f7e1d6' },
  { id: 1, name: 'Light medium', skin: '#e2b08d', shade: '#c48d69', nail: '#efcdb7' },
  { id: 2, name: 'Medium', skin: '#c68b62', shade: '#a36c47', nail: '#ddb093' },
  { id: 3, name: 'Medium deep', skin: '#8e5c3e', shade: '#6f432a', nail: '#b98a6d' },
  { id: 4, name: 'Deep', skin: '#5c3b28', shade: '#43291a', nail: '#8a644d' },
];

const BASE = {
  index: { bx: 150, by: 300, a: -7, len: 175, w: 40 },
  middle: { bx: 196, by: 290, a: -1, len: 200, w: 42 },
  ring: { bx: 240, by: 296, a: 5, len: 182, w: 39 },
  pinky: { bx: 279, by: 318, a: 13, len: 135, w: 33 },
  thumb: { bx: 128, by: 398, a: -54, len: 128, w: 46 },
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

export function Hand({ tone = 1, build = 'slender', crop = FULL, className = '' }) {
  const t = SKIN_TONES[tone];
  const F = fingers(build);
  const k = build === 'broad' ? 1.08 : 1;
  const finger = (f, id) => html`<g transform=${`translate(${f.bx} ${f.by}) rotate(${f.a})`} key=${id}>
    <rect x=${-f.w / 2} y=${-f.len} width=${f.w} height=${f.len + 40} rx=${f.w / 2} fill=${t.skin} />
    <rect x=${-f.w / 2} y=${-f.len} width=${f.w} height=${f.len + 40} rx=${f.w / 2} fill="url(#finger-shade)" />
    <rect x=${-f.w * 0.3} y=${-f.len + 7} width=${f.w * 0.6} height=${f.w * 0.78} rx=${f.w * 0.28} fill=${t.nail} />
    <path d=${`M${-f.w * 0.22} ${-f.len * 0.66} q${f.w * 0.22} ${-5} ${f.w * 0.44} 0`} stroke=${t.shade} stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7" />
    <path d=${`M${-f.w * 0.26} ${-f.len * 0.36} q${f.w * 0.26} ${-6} ${f.w * 0.52} 0`} stroke=${t.shade} stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".55" />
  </g>`;
  return html`<svg class=${'hand ' + className} viewBox=${`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="finger-shade" x1="0" x2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".16" />
        <stop offset=".35" stop-color="#000" stop-opacity="0" />
        <stop offset=".75" stop-color="#fff" stop-opacity=".06" />
        <stop offset="1" stop-color="#000" stop-opacity=".14" />
      </linearGradient>
      <radialGradient id="palm-shade" cx=".5" cy=".35" r=".7">
        <stop offset="0" stop-color="#fff" stop-opacity=".08" />
        <stop offset="1" stop-color="#000" stop-opacity=".14" />
      </radialGradient>
    </defs>
    <g transform=${`translate(${200 * (1 - k)} 0) scale(${k} 1)`}>
      <rect x="146" y="470" width="128" height="100" fill=${t.skin} />
      <rect x="146" y="470" width="128" height="100" fill="url(#finger-shade)" />
      <rect x="128" y="528" width="164" height="40" rx="10" class="sleeve" />
    </g>
    ${finger(F.thumb, 'thumb')}
    <path transform=${`translate(${200 * (1 - k)} 0) scale(${k} 1)`}
      d="M114 312 Q110 282 142 276 L292 290 Q314 300 310 340 L302 446 Q296 502 250 514 L170 514 Q120 502 114 444 Z" fill=${t.skin} />
    <path transform=${`translate(${200 * (1 - k)} 0) scale(${k} 1)`}
      d="M114 312 Q110 282 142 276 L292 290 Q314 300 310 340 L302 446 Q296 502 250 514 L170 514 Q120 502 114 444 Z" fill="url(#palm-shade)" />
    ${['pinky', 'ring', 'middle', 'index'].map((id) => finger(F[id], id))}
  </svg>`;
}
