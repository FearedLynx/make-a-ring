// Size drawing on the "Your size" step: the ring in front view as a dimensioned engineering drawing, in the same
// technical-drawing language as the landing page. Flat, no card, straight on the page.
// On a size change the contours ease to the new diameter (one critically damped spring, no bounce), the Ø figure
// ticks over with them, and the inner contour is inked again with a pen stroke. A hovered size pill shows as a
// dashed construction circle with a leader note. The Ø arrowheads are handles: drag either one out or in (or focus
// the drawing and use the arrow keys) to change the size; the pills beside it do the same.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { html } from '../lib/html.js';
import { DRAW as D, innerRadius, outerRadius, annulus, circle, diaLabel, sizeAtRadius } from '../lib/size-drawing.js';
import { tick } from '../lib/sound.js';
import { fmtUs, usToCircumference, usToDiameter } from '../lib/sizes.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const HALF = D.w / 2 - 14; // centre lines and the dimension line stay inside the sheet

export function SizeDrawing({ sizeUS, previewUS = null, onChange }) {
  const svg = useRef(), body = useRef(), outer = useRef(), inner = useRef(), dim = useRef(), num = useRef(), grips = useRef([]);
  const drag = useRef(null);
  const s = useRef({ x: sizeUS, v: 0, raf: 0 });

  const paint = (us) => {
    const ri = innerRadius(us), ro = outerRadius(us);
    body.current?.setAttribute('d', annulus(ri, ro));
    outer.current?.setAttribute('d', circle(ro));
    inner.current?.setAttribute('d', circle(ri));
    dim.current?.setAttribute('d', `M${D.cx - ri + 1} ${D.cy}H${D.cx + ri - 1}`);
    grips.current.forEach((g, i) => g?.setAttribute('transform', `translate(${D.cx + (i ? ri : -ri)} ${D.cy})`));
    if (num.current) num.current.textContent = diaLabel(us);
  };

  const animateTo = (goal) => {
    const st = s.current;
    cancelAnimationFrame(st.raf);
    if (reduced()) {
      st.x = goal;
      st.v = 0;
      return paint(goal);
    }
    let last = performance.now();
    const k = 120, c = 2 * Math.sqrt(k); // critically damped: settles in ~0.5 s without overshoot
    const step = (now) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      st.v += (-k * (st.x - goal) - c * st.v) * dt;
      st.x += st.v * dt;
      const done = Math.abs(st.x - goal) < 0.002 && Math.abs(st.v) < 0.01;
      if (done) st.x = goal;
      paint(st.x);
      if (!done) st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  };

  // Repaint after every render, so a freshly keyed (re-inked) contour gets its path at once.
  useLayoutEffect(() => paint(s.current.x));
  useEffect(() => () => cancelAnimationFrame(s.current.raf), []);
  useEffect(() => {
    if (!drag.current) animateTo(sizeUS);
  }, [sizeUS]);

  // Drag a Ø arrowhead: the ring follows the pointer, the size snaps to quarter sizes as it goes.
  const toSvgX = (e) => {
    const m = svg.current.getScreenCTM();
    return m ? (e.clientX - m.e) / m.a : D.cx;
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    cancelAnimationFrame(s.current.raf);
    drag.current = { last: sizeUS };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const dx = toSvgX(e) - D.cx;
    const us = sizeAtRadius(dx); // the ring steps in quarter sizes under the pointer
    s.current.x = us;
    paint(us);
    if (us !== drag.current.last) {
      drag.current.last = us;
      tick();
      onChange?.(us);
    }
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
  };
  const onKey = (e) => {
    const d = { ArrowRight: 0.25, ArrowUp: 0.25, ArrowLeft: -0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 }[e.key];
    if (d == null || !onChange) return;
    e.preventDefault();
    const us = Math.min(D.max, Math.max(D.min, sizeUS + d));
    if (us !== sizeUS) (tick(), onChange(us));
  };

  const ghost = previewUS != null && previewUS !== sizeUS ? previewUS : null;
  const gr = ghost == null ? 0 : innerRadius(ghost);
  // leader from the ghost circle (at 45°, upper right) out to a note in the corner
  const gx = D.cx + gr * Math.SQRT1_2, gy = D.cy - gr * Math.SQRT1_2;
  const nx = D.w - 16, ny = 46;

  return html`<figure class="size-drawing">
    <svg ref=${svg} viewBox=${`0 0 ${D.w} ${D.h}`} class=${'sd-svg' + (onChange ? ' live' : '')}
      role=${onChange ? 'slider' : 'img'} tabindex=${onChange ? 0 : undefined} onKeyDown=${onKey}
      aria-label=${onChange ? 'Ring size: drag the diameter arrows' : `Drawing of a US ${fmtUs(sizeUS)} ring: inner diameter ${usToDiameter(sizeUS).toFixed(1)} millimetres`}
      aria-valuemin=${onChange ? D.min : undefined} aria-valuemax=${onChange ? D.max : undefined} aria-valuenow=${onChange ? sizeUS : undefined}
      aria-valuetext=${onChange ? `US ${fmtUs(sizeUS)}, ${usToDiameter(sizeUS).toFixed(1)} millimetres` : undefined}>
      <defs>
        <pattern id="sd-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line class="sd-hatch-line" x1="0" y1="0" x2="0" y2="6" />
        </pattern>
        <marker id="sd-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path class="sd-arrow" d="M0 1.5L10 5L0 8.5Z" />
        </marker>
      </defs>

      <text class="sd-head" x="14" y="20">SIZE · FRONT VIEW</text>
      <text class="sd-head end" x=${D.w - 14} y="20">ENLARGED · mm</text>
      <line class="sd-rule" x1="14" x2=${D.w - 14} y1="28" y2="28" />

      <line class="sd-centre" x1=${D.cx - HALF} x2=${D.cx + HALF} y1=${D.cy} y2=${D.cy} />
      <line class="sd-centre" x1=${D.cx} x2=${D.cx} y1="40" y2=${D.h - 8} />

      <path ref=${body} class="sd-body" fill-rule="evenodd" />
      <path ref=${outer} class="sd-line" pathLength="1" />
      <path ref=${inner} key=${sizeUS} class="sd-fit" pathLength="1" />

      ${ghost != null &&
      html`<g class="sd-ghost">
        <circle cx=${D.cx} cy=${D.cy} r=${gr} />
        <path d=${`M${gx} ${gy}L${gx + 22} ${ny}H${nx}`} />
        <text x=${nx} y=${ny - 6}>US ${fmtUs(ghost)} · ${diaLabel(ghost)}</text>
      </g>`}

      <path ref=${dim} class="sd-dim" marker-start="url(#sd-arrow)" marker-end="url(#sd-arrow)" />
      <text ref=${num} class="sd-num" x=${D.cx} y=${D.cy - 9} />
      ${onChange &&
      [0, 1].map((i) => html`<g ref=${(el) => (grips.current[i] = el)} class="sd-grip"
        onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}>
        <circle class="sd-grip-hit" r="16" />
        <circle class="sd-grip-dot" r="5.5" />
      </g>`)}
    </svg>
    ${onChange && html`<p class="sd-hint">Drag the arrows to resize</p>`}
    <dl class="title-block sd-block">
      <div class="tb-wide"><dt class="sr-only">Part</dt><dd class="tb-name">Your fit</dd><span class="sd-sheet">US ${fmtUs(sizeUS)}</span></div>
      <div><dt>Circ.</dt><dd>${usToCircumference(sizeUS).toFixed(1)} mm</dd></div>
      <div><dt>Wall</dt><dd>${D.wallMm.toFixed(1)} mm</dd></div>
      <div><dt>Tol.</dt><dd>± 0.1 mm</dd></div>
    </dl>
  </figure>`;
}
