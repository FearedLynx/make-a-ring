// Small looping demos shown inside tour cards. Pure SVG + CSS keyframes (see technical.css, .ta-*).
import { html } from '../lib/html.js';

const card = (x, y, w, h, cls = '') => html`<rect class=${'ta-card ' + cls} x=${x} y=${y} width=${w} height=${h} rx="4" />`;
const motif = (cx, cy, s = 5) => html`<path class="ta-motif" d=${`M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z`} />`;

const ANIMS = {
  rotate: () => html`
    <g class="ta-spin">
      <ellipse class="ta-ring" cx="100" cy="45" rx="30" ry="30" />
      <ellipse class="ta-ring inner" cx="100" cy="45" rx="22" ry="22" />
    </g>
    <path class="ta-cursor ta-drag-x" d="M120 52l0 14 4-4 3 6 3-1-3-6 5 0Z" />`,

  vertical: () => html`
    <g class="ta-slide-y">
      ${[0, 1, 2, 3].map((i) => html`<g>${card(80, 6 + i * 28, 40, 22)}${motif(100, 17 + i * 28)}</g>`)}
    </g>
    <rect class="ta-frame" x="76" y="30" width="48" height="30" rx="5" />
    <text class="ta-key" x="150" y="40">↑</text><text class="ta-key" x="150" y="60">↓</text>`,

  // Cards are 34 wide on a 44 step, centred on the fixed frame at x = 100; one extra card on the right
  // slides in as the row moves one step left, so the frame always holds exactly one card.
  horizontal: () => html`
    <g class="ta-slide-x">
      ${[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 83 + (i - 2) * 44;
        return html`<g>${card(x, 22, 34, 46)}<path class="ta-motif-line" d=${`M${x + 8} 30q4 7 0 14t0 14M${x + 26} 30q-4 7 0 14t0 14`} /></g>`;
      })}
    </g>
    <rect class="ta-frame" x="79" y="18" width="42" height="54" rx="5" />`,

  link: () => html`
    <rect class="ta-band" x="40" y="22" width="120" height="46" rx="6" />
    <rect class="ta-side left" x="40" y="22" width="120" height="10" />
    <rect class="ta-side right" x="40" y="58" width="120" height="10" />
    <g class="ta-chain"><circle cx="95" cy="45" r="6" /><circle cx="105" cy="45" r="6" /></g>
    <line class="ta-break" x1="92" y1="54" x2="108" y2="36" />`,

  band: () => html`
    <rect class="ta-band" x="20" y="20" width="160" height="50" rx="4" />
    <rect class="ta-zone side top" x="20" y="20" width="160" height="12" />
    <rect class="ta-zone mid" x="20" y="32" width="160" height="26" />
    <rect class="ta-zone side bottom" x="20" y="58" width="160" height="12" />
    <g class="ta-handle"><line x1="20" x2="180" y1="32" y2="32" /><rect x="92" y="29" width="16" height="6" rx="3" /></g>
    <path class="ta-cursor ta-drag-y" d="M110 30l0 14 4-4 3 6 3-1-3-6 5 0Z" />`,

  search: () => html`
    <rect class="ta-input" x="30" y="10" width="140" height="18" rx="9" />
    <text class="ta-type" x="44" y="23">leaf</text>
    <line class="ta-caret" x1="70" x2="70" y1="14" y2="25" />
    ${[0, 1, 2].map((i) => html`<g class=${'ta-result r' + i}>${card(30 + i * 48, 38, 42, 40)}<path class="ta-motif-line" d=${`M${38 + i * 48} 58q6-10 12 0t12 0`} /></g>`)}`,

  draw: () => html`
    <rect class="ta-board" x="30" y="6" width="140" height="78" rx="6" />
    <path class="ta-grid" d="M30 32h140M30 58h140M65 6v78M100 6v78M135 6v78" />
    <path class="ta-messy" pathLength="1" d="M42 62c6-4 5-22 14-22s6 26 16 25c9 0 4-30 15-31 10 0 7 32 18 31 9-1 6-27 16-27 8 0 6 18 12 22" />
    <path class="ta-smooth" pathLength="1" d="M42 62C52 62 50 40 60 40S72 64 82 64 92 34 102 34 114 66 124 66 136 40 146 40 152 58 158 62" />`,

  layout: () => html`
    ${[0, 1, 2, 3].map((i) => html`<g class=${'ta-lay l' + i}>
      <rect class="ta-card" x=${12 + i * 46} y="24" width="40" height="42" rx="4" />
      ${i === 0 && html`<rect class="ta-z s" x="12" y="24" width="40" height="9" /><rect class="ta-z m" x="12" y="33" width="40" height="24" /><rect class="ta-z s" x="12" y="57" width="40" height="9" />`}
      ${i === 1 && html`<rect class="ta-z s" x="58" y="24" width="40" height="12" /><rect class="ta-z s" x="58" y="54" width="40" height="12" />`}
      ${i === 2 && html`<rect class="ta-z m" x="104" y="32" width="40" height="26" />`}
      ${i === 3 && html`<rect class="ta-z m" x="150" y="24" width="40" height="42" />`}
    </g>`)}`,

  checks: () => html`
    <g class="ta-warn"><path d="M100 14 128 66H72Z" /><path class="ta-mark" d="M100 32v16M100 56v1" /></g>
    <g class="ta-ok"><circle cx="100" cy="44" r="26" /><path d="M88 45l8 8 16-17" /></g>`,

  price: () => html`
    <rect class="ta-card" x="30" y="20" width="140" height="50" rx="8" />
    <text class="ta-price" x="46" y="52">$76</text>
    <rect class="ta-btn" x="110" y="33" width="48" height="24" rx="12" />
    <path class="ta-arrow" d="M124 45h20M138 39l6 6-6 6" />`,

  tools: () => html`
    ${['P', 'L', 'S', 'C', 'D', 'T', 'V', 'E'].map((k, i) => html`<g class=${'ta-tool t' + i}><rect x=${12 + i * 22} y="30" width="18" height="30" rx="4" /><text x=${21 + i * 22} y="50">${k}</text></g>`)}`,

  symmetry: () => html`
    <rect class="ta-board" x="55" y="5" width="90" height="80" rx="6" />
    <path class="ta-axis" d="M100 5v80M55 45h90" />
    <path class="ta-sym s0" pathLength="1" d="M92 37c-6-14-24-12-26 0" />
    <path class="ta-sym s1" pathLength="1" d="M108 37c6-14 24-12 26 0" />
    <path class="ta-sym s2" pathLength="1" d="M92 53c-6 14-24 12-26 0" />
    <path class="ta-sym s3" pathLength="1" d="M108 53c6 14 24 12 26 0" />`,

  stamps: () => html`
    <rect class="ta-board" x="20" y="8" width="160" height="74" rx="6" />
    ${[0, 1, 2].map((i) => html`<path class=${'ta-stamp p' + i} transform=${`translate(${55 + i * 45} 45) rotate(${-30 + i * 30})`} d="M-14 0Q0-11 14 0Q0 11-14 0Z" />`)}`,

  steady: () => ANIMS.draw(),

  zoom: () => html`
    <g class="ta-zoom"><rect class="ta-board" x="40" y="10" width="120" height="70" rx="4" /><path class="ta-grid" d="M40 33h120M40 56h120M80 10v70M120 10v70" /><path class="ta-motif-line" d="M60 60c10-30 30-30 40 0s30 30 40 0" /></g>
    <text class="ta-key" x="172" y="40">+</text><text class="ta-key" x="172" y="62">−</text>`,

  weight: () => html`
    <line class="ta-weight" x1="30" x2="170" y1="40" y2="40" />
    <line class="ta-limit" x1="30" x2="170" y1="66" y2="66" />
    <text class="ta-label" x="30" y="80">min. printable</text>`,

  generate: () => html`
    <rect class="ta-board" x="20" y="8" width="160" height="74" rx="6" />
    <path class="ta-gen" pathLength="1" d="M20 45c13-26 27-26 40 0s27 26 40 0 27-26 40 0 27 26 40 0" />
    <path class="ta-gen g2" pathLength="1" d="M20 45c13 26 27 26 40 0s27-26 40 0 27 26 40 0 27-26 40 0" />`,

  preview: () => ANIMS.rotate(),
};

export function TourAnim({ kind }) {
  const a = ANIMS[kind];
  if (!a) return null;
  return html`<div class="tour-anim" aria-hidden="true"><svg viewBox="0 0 200 90" class=${'ta ta-' + kind}>${a()}</svg></div>`;
}
