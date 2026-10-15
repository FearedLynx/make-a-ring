// §4 Cost as a jeweller's display tray: one ring per way of making it, each with a hanging price tag.
// It is a picker, not a chart: picking a ring shows its price and explanation in the detail panel on the right.
// Line art in the theme's ink with flat surface tints; materials differ by texture (print layers, sintered
// stipple, a polished highlight, gold's double highlight and sparkle), so the accent colour only ever marks the
// selected ring and its tag.
//
// Motion has a job: the selected ring lifts out of its slot and its tag swings once (confirms the pick); hover
// lifts a little (it's clickable); the rings drop into their slots once, the first time the tray scrolls into
// view. Springs run in one rAF loop writing transforms through refs; nothing re-renders per frame.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { money } from '../lib/checks.js';

const W = 640, H = 380;
const SLOT_Y = 214; // where the slot's front edge crosses the ring
const LIP_Y = 252; // top of the tray's front lip, where the tag strings hang from
const RING = { rx: 46, ry: 50 };
const TAG = { w: 118, h: 48 };
const DROP_KEY = 'mar.trayDropped';
// Each metal gets its own colour and polish: a diagonal gradient with a bright highlight band, plus an edge tone.
// Home print stays flat with its print layers. (Material colours are data, like the studio's material swatches.)
const METALS = {
  metal: { edge: '#4f5459', stops: [[0, '#5d6268'], [0.32, '#c3c7cc'], [0.45, '#8c9197'], [0.75, '#6c7177'], [1, '#4c5055']] }, // titanium / steel: cool, satin
  // silver or brass: half and half, a hard seam down the middle (silver left, brass right)
  cast: { edge: '#7a7466', horizontal: true, stops: [[0, '#8f949a'], [0.16, '#ffffff'], [0.34, '#d9dce0'], [0.5, '#b9bdc3'], [0.5, '#b8913f'], [0.64, '#f5e2a3'], [0.82, '#d2aa4e'], [1, '#8a6a28']] },
  gold: { edge: '#8a6420', stops: [[0, '#8f6a24'], [0.3, '#fff0b8'], [0.44, '#e6bd55'], [0.74, '#c4952f'], [1, '#86621f']] }, // 14k: warm, rich
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoverable = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const spoken = (r) => `${r.label}, ${money(r.lo)} to ${money(r.hi)}`;

// Spring step: critically damped by default; returns true when at rest.
const step = (s, goal, dt, k, zeta = 1) => {
  s.v += (-k * (s.x - goal) - 2 * zeta * Math.sqrt(k) * s.v) * dt;
  s.x += s.v * dt;
  return Math.abs(s.x - goal) < 0.05 && Math.abs(s.v) < 0.5;
};

/** routes: [{ id, short, label, lo, hi, text }], bandMm: band width used for the estimate (sets ring thickness). */
export function DisplayTray({ routes, initial = null, bandMm = 7 }) {
  const [sel, setSel] = useState(initial);
  const [hover, setHover] = useState(-1);
  const n = routes.length;
  const cur = sel == null ? null : routes[sel]; // nothing is picked until the person picks
  const host = useRef();
  const ringEls = useRef([]), tagEls = useRef([]), sparkEls = useRef([]);
  const st = useRef(null); // per ring: lift spring, tag swing spring, entrance drop
  const raf = useRef(0);
  const selRef = useRef(sel), hoverRef = useRef(-1);
  selRef.current = sel;
  hoverRef.current = hover;

  const band = Math.max(9, Math.min(18, bandMm * 1.9)); // wider bands read wider, within a legible range
  const slotX = (i) => W / 2 + (i - (n - 1) / 2) * 140;

  const write = () => {
    st.current.forEach((r, i) => {
      ringEls.current[i]?.setAttribute('transform', `translate(0 ${(r.drop.x - r.lift.x).toFixed(2)})`);
      const g = tagEls.current[i];
      if (g) {
        g.setAttribute('transform', `rotate(${r.swing.x.toFixed(2)} ${slotX(i)} ${LIP_Y})`);
        g.style.opacity = r.tagShown ? '' : '0';
      }
    });
  };

  const loop = () => {
    cancelAnimationFrame(raf.current);
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      let busy = false;
      st.current.forEach((r, i) => {
        const goalLift = i === selRef.current ? 12 : i === hoverRef.current ? 3 : 0;
        // lift: a touch of overshoot on the way up, settles in ~450 ms; drops back faster
        if (!step(r.lift, goalLift, dt, goalLift > r.lift.x ? 260 : 420, goalLift > r.lift.x ? 0.7 : 0.95)) busy = true;
        // tag swing: a lightly damped pendulum (~900 ms)
        if (!step(r.swing, 0, dt, 70, 0.22)) busy = true;
        if (r.drop.phase === 'wait' && now >= r.drop.at) (r.drop.phase = 'fall'), (r.drop.t0 = now);
        if (r.drop.phase === 'fall') {
          const t = Math.min(1, (now - r.drop.t0) / 380);
          r.drop.x = -260 * (1 - t * t); // ease-in fall into the slot
          if (t >= 1) (r.drop.phase = 'bounce'), (r.drop.x = 0), (r.drop.v = -120), (r.tagShown = true), (r.swing.v += 40);
          busy = true;
        } else if (r.drop.phase === 'bounce') {
          if (step(r.drop, 0, dt, 520, 0.45)) r.drop.phase = 'done';
          else busy = true;
        } else if (r.drop.phase === 'wait') busy = true;
      });
      write();
      if (busy) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  // Set up before first paint: rings hidden above the tray until the entrance (no flash), or in place if it ran already.
  useLayoutEffect(() => {
    let played = false;
    try {
      played = sessionStorage.getItem(DROP_KEY) === '1';
    } catch {}
    const skip = played || reduced();
    st.current = routes.map((_, i) => ({
      lift: { x: i === sel ? 12 : 0, v: 0 },
      swing: { x: 0, v: 0 },
      drop: skip ? { phase: 'done', x: 0, v: 0 } : { phase: 'hold', x: -260, v: 0 },
      tagShown: skip,
    }));
    write();
    if (skip) return;
    // The first time the tray is mostly in view, the rings drop in one after another.
    const play = () => {
      try {
        sessionStorage.setItem(DROP_KEY, '1');
      } catch {}
      const now = performance.now();
      st.current.forEach((r, i) => (r.drop = { phase: 'wait', at: now + i * 90, x: -260, v: 0 }));
      loop();
    };
    if (!('IntersectionObserver' in window)) return play(), () => cancelAnimationFrame(raf.current);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        play();
      },
      { threshold: 0.4 }
    );
    io.observe(host.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const pick = (i, focus = false) => {
    const j = ((i % n) + n) % n;
    if (j !== sel && st.current && !reduced()) st.current[j].swing.v += 70; // the new tag swings from its string
    setSel(j);
    if (focus) requestAnimationFrame(() => host.current?.querySelector(`[data-ring-i="${j}"]`)?.focus());
  };
  useEffect(() => {
    if (!st.current) return;
    if (reduced()) {
      st.current.forEach((r, i) => ((r.lift.x = i === sel ? 12 : 0), (r.lift.v = 0)));
      write();
    } else loop();
  }, [sel, hover]);

  const onKey = (e, i) => {
    const map = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    pick(map[e.key], true);
  };
  const onHover = (i) => {
    if (!hoverable()) return;
    setHover(i);
    if (i >= 0 && st.current && !reduced()) {
      st.current[i].swing.v += 22; // a small sway
      const sp = sparkEls.current[i];
      sp?.animate?.([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.4)' }], { duration: 520 });
    }
  };

  return html`<div class="tray-wrap" ref=${host}>
    <svg class="tray" viewBox=${`0 0 ${W} ${H}`} role="radiogroup" aria-label="Making method">
      <defs>
        <pattern id="tx-layers" width="6" height="3" patternUnits="userSpaceOnUse"><line x1="0" y1="1.5" x2="6" y2="1.5" class="tx-line" /></pattern>
        ${Object.entries(METALS).map(([id, mt]) => html`<linearGradient id=${`mt-${id}`} x1="0" y1="0" x2="1" y2=${mt.horizontal ? 0 : 1}>
          ${mt.stops.map(([o, c]) => html`<stop offset=${o} stop-color=${c} />`)}
        </linearGradient>`)}
        <pattern id="tx-stipple" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="0.7" class="tx-dot" /><circle cx="3.7" cy="3.6" r="0.6" class="tx-dot" /></pattern>
      </defs>

      <g aria-hidden="true">
        <rect class="tray-body" x="20" y="118" width=${W - 40} height="168" rx="20" />
        <rect class="tray-floor" x="36" y="132" width=${W - 72} height="118" rx="12" />
        ${routes.map((_, i) => html`<ellipse class="tray-slot" cx=${slotX(i)} cy=${SLOT_Y} rx=${RING.rx + 10} ry="11" />`)}
      </g>

      ${routes.map((r, i) => {
        const cx = slotX(i), cy = SLOT_Y - RING.ry + 18, on = i === sel;
        const outer = `M${cx - RING.rx} ${cy}a${RING.rx} ${RING.ry} 0 1 0 ${RING.rx * 2} 0a${RING.rx} ${RING.ry} 0 1 0 ${-RING.rx * 2} 0Z`;
        const irx = RING.rx - band, iry = RING.ry - band;
        const inner = `M${cx - irx} ${cy}a${irx} ${iry} 0 1 0 ${irx * 2} 0a${irx} ${iry} 0 1 0 ${-irx * 2} 0Z`;
        const m = METALS[r.id]; // null for home print: flat and layered, as printed
        const hi = (k) => `M${cx - RING.rx + band * 0.5} ${cy + 6}A${RING.rx - band * 0.5} ${RING.ry - band * 0.5} 0 0 1 ${cx - RING.rx * 0.18} ${cy - RING.ry + band * 0.5}`;
        return html`<g class=${'tray-ring' + (on ? ' on' : '') + (m ? ' metal' : '')} ref=${(el) => (ringEls.current[i] = el)} aria-hidden="true">
          <ellipse class="ring-halo" cx=${cx} cy=${cy} rx=${RING.rx + 6} ry=${RING.ry + 6} />
          <path class="ring-band" d=${outer + inner} fill-rule="evenodd" style=${m ? `fill:url(#mt-${r.id});stroke:${m.edge}` : undefined} />
          ${!m && html`<path d=${outer + inner} fill-rule="evenodd" fill="url(#tx-layers)" class="ring-tex" />`}
          ${r.id === 'metal' && html`<path d=${outer + inner} fill-rule="evenodd" fill="url(#tx-stipple)" class="ring-tex sintered" />`}
          <path class="ring-depth" d=${`M${cx - irx} ${cy}A${irx} ${iry} 0 0 1 ${cx + irx} ${cy}`} style=${m ? `stroke:${m.edge}` : undefined} />
          ${m && html`<path class=${'ring-shine ' + r.id} d=${hi()} />`}
          ${m && html`<path class="ring-shine soft" d=${`M${cx + RING.rx * 0.3} ${cy - RING.ry + band * 0.55}A${RING.rx - band * 0.5} ${RING.ry - band * 0.5} 0 0 1 ${cx + RING.rx - band * 0.55} ${cy - 12}`} />`}
          ${r.id === 'gold' && html`<path ref=${(el) => (sparkEls.current[i] = el)} class=${'ring-spark' + (on ? ' on' : '')}
            d=${`M${cx + 30} ${cy - 46}l2.4 7 7 2.4 -7 2.4 -2.4 7 -2.4 -7 -7 -2.4 7 -2.4Z`} />`}
        </g>`;
      })}

      <g aria-hidden="true">
        <path class="tray-floor" d=${`M36 ${SLOT_Y}H${W - 36}V${LIP_Y - 2}H36Z`} />
        ${routes.map((_, i) => html`<path class="tray-slot-edge" d=${`M${slotX(i) - RING.rx - 10} ${SLOT_Y}A${RING.rx + 10} 11 0 0 0 ${slotX(i) + RING.rx + 10} ${SLOT_Y}`} />`)}
        <rect class="tray-lip" x="20" y=${LIP_Y} width=${W - 40} height="24" rx="10" />
      </g>

      ${routes.map((r, i) => {
        const cx = slotX(i), on = i === sel, len = i % 2 ? 46 : 16; // staggered strings keep neighbouring tags apart
        const ty = LIP_Y + 12 + len;
        return html`<g ref=${(el) => (tagEls.current[i] = el)} class=${'tray-tag' + (on ? ' on' : '')} aria-hidden="true">
          <path class="tag-string" d=${`M${cx} ${LIP_Y + 2}C${cx - 6} ${LIP_Y + 8} ${cx - 3} ${ty - 6} ${cx} ${ty + 4}`} />
          <path class="tag-card" d=${`M${cx - TAG.w / 2 + 10} ${ty}H${cx + TAG.w / 2 - 10}L${cx + TAG.w / 2} ${ty + 10}V${ty + TAG.h}H${cx - TAG.w / 2}V${ty + 10}Z`} />
          <circle class="tag-hole" cx=${cx} cy=${ty + 7} r="2.6" />
          <text class="tag-name" x=${cx} y=${ty + 25}>${r.short}</text>
          <text class="tag-price" x=${cx} y=${ty + 40}>${money(r.lo)}–${money(r.hi)}</text>
        </g>`;
      })}

      ${routes.map((r, i) => {
        const cx = slotX(i), on = i === sel;
        return html`<g data-ring-i=${i} class="tray-hit" role="radio" aria-checked=${on} tabindex=${on || (sel == null && i === 0) ? 0 : -1} aria-label=${spoken(r)}
          onClick=${() => pick(i)} onKeyDown=${(e) => onKey(e, i)}
          onPointerEnter=${() => onHover(i)} onPointerLeave=${() => onHover(-1)}>
          <rect class="tray-hit-area" x=${cx - 66} y="96" width="132" height=${H - 100} rx="14" />
          <rect class="tray-focus" x=${cx - 66} y="96" width="132" height=${H - 100} rx="14" />
        </g>`;
      })}
    </svg>

    <div class="cw-text" aria-live="polite">
      ${cur
        ? html`<span class="cw-kicker">${String(sel + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')} · ${cur.label}</span>
          <p class="cw-range">${money(cur.lo)}–${money(cur.hi)}</p>
          <p>${cur.text}</p>`
        : html`<span class="cw-kicker">${n} ways to make it</span>
          <p class="cw-range">${money(Math.min(...routes.map((r) => r.lo)))}–${money(Math.max(...routes.map((r) => r.hi)))}</p>
          <p>The same file can be printed at home or cast in precious metal. Pick a ring to see what each way costs and how it's made.</p>`}
      <p class="cw-foot">Prices are estimates for the metal and making only; a jeweller's quote for a custom design adds design and labour on top.</p>
    </div>
    <table class="sr-only">
      <caption>Estimated price by way of making it</caption>
      <thead><tr><th scope="col">Route</th><th scope="col">From</th><th scope="col">To</th></tr></thead>
      <tbody>${routes.map((r) => html`<tr><th scope="row">${r.label}</th><td>${money(r.lo)}</td><td>${money(r.hi)}</td></tr>`)}</tbody>
    </table>
  </div>`;
}
