// Cost wheel for the landing page: one slice per way of making the ring. The slices are equal on purpose:
// this is a selector, not a share-of-total chart (the routes are alternatives, so a pie of them would mean
// nothing). The selected slice is the only accent-coloured mark; its price range sits in the centre and its
// explanation on the right.
import { useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { money } from '../lib/checks.js';

const CX = 160, CY = 160, R_OUT = 150, R_IN = 90, GAP_DEG = 1.4;

const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

function slicePath(a0, a1) {
  const [x0, y0] = polar(R_OUT, a0), [x1, y1] = polar(R_OUT, a1);
  const [x2, y2] = polar(R_IN, a1), [x3, y3] = polar(R_IN, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3}Z`;
}

/** routes: [{ id, short, label, lo, hi, text }] */
export function CostWheel({ routes, initial = 0 }) {
  const [sel, setSel] = useState(initial);
  const n = routes.length;
  const step = 360 / n;
  const cur = routes[sel];
  const pick = (i) => setSel(((i % n) + n) % n);
  const onKey = (e, i) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (d) {
      e.preventDefault();
      pick(i + d);
      requestAnimationFrame(() => document.getElementById(`cw-${routes[((i + d) % n + n) % n].id}`)?.focus());
    }
  };
  return html`<div class="cost-wheel">
    <svg class="cw-svg" viewBox="-16 -16 352 352" role="radiogroup" aria-label="Ways to make the ring">
      ${routes.map((r, i) => {
        const a0 = i * step + GAP_DEG / 2, a1 = (i + 1) * step - GAP_DEG / 2; // slices centred on the diagonals, where labels have room
        const [lx, ly] = polar((R_OUT + R_IN) / 2, (a0 + a1) / 2);
        const on = i === sel;
        return html`<g id=${`cw-${r.id}`} class=${'cw-slice' + (on ? ' on' : '')} role="radio" aria-checked=${on} tabindex=${on ? 0 : -1}
          aria-label=${`${r.label}: ${money(r.lo)} to ${money(r.hi)}`}
          onClick=${() => pick(i)} onKeyDown=${(e) => onKey(e, i)}>
          <path d=${slicePath(a0, a1)} />
          <text class="cw-label" x=${lx} y=${ly - 4}>${r.short}</text>
          <text class="cw-price" x=${lx} y=${ly + 12}>${money(r.lo)}–${money(r.hi)}</text>
        </g>`;
      })}
      <text class="cw-center-k" x=${CX} y=${CY - 18}>${cur.short}</text>
      <text class="cw-center-v" x=${CX} y=${CY + 10}>${money(cur.lo)}</text>
      <text class="cw-center-s" x=${CX} y=${CY + 30}>to ${money(cur.hi)}</text>
    </svg>
    <div class="cw-text" aria-live="polite">
      <span class="cw-kicker">${String(sel + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')} · ${cur.label}</span>
      <p class="cw-range">${money(cur.lo)}–${money(cur.hi)}</p>
      <p>${cur.text}</p>
      <p class="cw-foot">Prices are estimates for the metal and making only; a jeweller's quote for a custom design adds design and labour on top.</p>
    </div>
    <table class="sr-only">
      <caption>Estimated price by way of making it</caption>
      <thead><tr><th scope="col">Route</th><th scope="col">From</th><th scope="col">To</th></tr></thead>
      <tbody>${routes.map((r) => html`<tr><th scope="row">${r.label}</th><td>${money(r.lo)}</td><td>${money(r.hi)}</td></tr>`)}</tbody>
    </table>
  </div>`;
}
