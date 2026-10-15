// Decorative ring mandrel on the "Your size" step. A ring drops onto the cone once per session, lands on the
// selected size with a small bounce and rock, glints once, and then slides up or down whenever the size changes.
// Purely decorative (aria-hidden): the size card already tells screen readers the size.
//
// Look: one light source, upper left. Shape comes from tone, not outlines: the cone and handle use a
// cylinder-shading gradient mixed from the theme's ink and surface tokens; the ring is a band with a front
// face in the chosen material, a bevel highlight on its top edge and a contact shadow on the cone. Shadows are
// radial gradients, never blur filters, so the animated parts stay cheap.
//
// Motion runs in requestAnimationFrame and writes SVG attributes through refs, so Preact only re-renders when
// the size (or hovered size) changes, never per frame. Springs are integrated with velocity, so a new target
// mid-motion simply retargets from the current position and speed. Nothing moves unless the person acts, apart
// from the one-time entrance.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { html } from '../lib/html.js';
import { MANDREL as M, ringY, ellipseAtY, ticks, coneHalfWidthAt } from '../lib/mandrel.js';
import { fmtUs, usToDiameter } from '../lib/sizes.js';
import { getMaterial } from '../lib/materials.js';

const DROP_KEY = 'mar.mandrelDropped';
const TICKS = ticks();
const BAND = 9; // band height in viewBox units; the ring's lower edge is where it touches the cone
const coneTopY = M.yTop - 14, coneBotY = M.yTop + M.coneHeight + 14;
const halfAt = (y) => M.topHalfWidth + ((y - M.yTop) / M.coneHeight) * (M.bottomHalfWidth - M.topHalfWidth);
const CONE = [
  [M.cx - halfAt(coneTopY), coneTopY], [M.cx + halfAt(coneTopY), coneTopY],
  [M.cx + halfAt(coneBotY), coneBotY], [M.cx - halfAt(coneBotY), coneBotY],
].map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' ');

// Lathe-turned base: collar, seam, then a tapered handle with a rounded end.
const COLLAR = { top: coneBotY, h: 13, half: M.bottomHalfWidth + 7 };
const HANDLE = { top: COLLAR.top + COLLAR.h + 3, len: 58, half0: 15, half1: 21 };
const handlePath = (() => {
  const { top, len, half0, half1 } = HANDLE, cx = M.cx, bot = top + len;
  return `M${cx - half0} ${top}L${cx + half0} ${top}L${cx + half1} ${bot - 6}Q${cx + half1} ${bot + 4} ${cx} ${bot + 5}Q${cx - half1} ${bot + 4} ${cx - half1} ${bot - 6}Z`;
})();
const GROUND_Y = HANDLE.top + HANDLE.len + 6;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => matchMedia('(pointer: fine)').matches;
const dropDone = () => {
  try {
    return sessionStorage.getItem(DROP_KEY) === '1';
  } catch {
    return false;
  }
};
const markDropped = () => {
  try {
    sessionStorage.setItem(DROP_KEY, '1');
  } catch {}
};

/** Top (back) or bottom (front) half of an ellipse as an open path. */
const arc = ({ cx, cy, rx, ry }, front) => `M${cx - rx} ${cy}A${rx} ${ry} 0 0 ${front ? 0 : 1} ${cx + rx} ${cy}`;
/** The band's front face: from the top edge's front arc, down the right side, back along the lower edge. */
const bandFace = ({ cx, cy, rx, ry }) =>
  `M${cx - rx} ${cy - BAND}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy - BAND}L${cx + rx} ${cy}A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}Z`;

/** Metal tones for the ring from the material's colour (honest to what the person picked). */
function metalTones(materialId) {
  const c = getMaterial(materialId).color;
  return {
    dark: `color-mix(in oklab, ${c} 55%, black)`,
    body: `color-mix(in oklab, ${c} 80%, black)`,
    mid: c,
    light: `color-mix(in oklab, ${c} 35%, white)`,
    back: `color-mix(in oklab, ${c} 45%, black)`,
  };
}

/** A spring stepper shared by the pointer light and the ghost ring (critically damped unless told otherwise). */
const stepSpring = (s, goal, dt, k = 260, zeta = 1) => {
  s.v += (-k * (s.x - goal) - 2 * zeta * Math.sqrt(k) * s.v) * dt;
  s.x += s.v * dt;
  return Math.abs(s.x - goal) < 0.002 && Math.abs(s.v) < 0.01;
};

export function Mandrel({ sizeUS, previewUS = null, materialId = 'silver' }) {
  const svg = useRef(), back = useRef(), face = useRef(), bevel = useRef(), glintFace = useRef(), glintGrad = useRef();
  const contact = useRef(), pulse = useRef(), ghost = useRef(), specular = useRef(), ringHi = useRef(), body = useRef(), groundRef = useRef();
  const anim = useRef(null);
  const target = useRef(ringY(sizeUS));

  // Draw the ring at y with a tilt (degrees); `shadow` 0..1 grows the contact shadow as the ring lands.
  const draw = (y, rot = 0, visible = true, shadow = 1) => {
    const e = ellipseAtY(y);
    const squash = 1 + Math.min(0.12, Math.abs(rot) * 0.012);
    const shape = { ...e, ry: e.ry * squash };
    back.current?.setAttribute('d', arc({ ...shape, cy: shape.cy - BAND }, false));
    face.current?.setAttribute('d', bandFace(shape));
    glintFace.current?.setAttribute('d', bandFace(shape));
    bevel.current?.setAttribute('d', arc({ ...shape, cy: shape.cy - BAND }, true));
    const t = `rotate(${rot.toFixed(2)} ${e.cx} ${e.cy})`;
    for (const g of svg.current?.querySelectorAll('[data-ring]') || []) {
      g.setAttribute('transform', t);
      g.style.opacity = visible ? '' : '0';
    }
    // Contact shadow sits just under the band on the cone, clipped to the cone; it grows and sharpens on landing.
    if (contact.current) {
      const half = coneHalfWidthAt(e.cy);
      contact.current.setAttribute('cx', e.cx);
      contact.current.setAttribute('cy', (e.cy + 3.5).toFixed(2));
      contact.current.setAttribute('rx', (half * (0.6 + 0.4 * shadow)).toFixed(2));
      contact.current.setAttribute('ry', (4 + 1.6 * (1 - shadow)).toFixed(2));
      contact.current.style.opacity = visible ? String(shadow) : '0';
    }
  };

  const playLanding = (y) => {
    if (reduced()) return;
    // A thin ring-shaped highlight expands from the contact edge on impact: confirms "it landed".
    const e = ellipseAtY(y);
    const p = pulse.current;
    if (p?.animate) {
      p.setAttribute('cx', e.cx);
      p.setAttribute('cy', e.cy);
      p.setAttribute('rx', e.rx);
      p.setAttribute('ry', e.ry);
      p.animate([{ transform: 'scale(1)', opacity: 0.7 }, { transform: 'scale(1.18)', opacity: 0 }], { duration: 300, easing: 'ease-out' });
    }
  };

  // Glint: a highlight band rides across the metal face once (moves the overlay gradient, no extra stroke).
  const playGlint = () => {
    if (reduced() || !glintGrad.current) return;
    const g = glintGrad.current, f = glintFace.current;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 350);
      g.setAttribute('gradientTransform', `translate(${(-0.7 + 1.4 * t).toFixed(3)} 0)`);
      f.style.opacity = String(Math.sin(t * Math.PI) * 0.9);
      if (t < 1) requestAnimationFrame(step);
      else f.style.opacity = '0';
    };
    requestAnimationFrame(step);
  };

  // One loop for the ring: fall (eased), then springs for y and the tilt.
  const run = () => {
    const a = anim.current;
    if (!a || a.running) return;
    a.running = true;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const goal = target.current;
      let shadow = 1;
      if (a.phase === 'wait') {
        if (now >= a.startAt) (a.phase = 'fall'), (a.fallStart = now), (a.y0 = a.y);
        shadow = 0;
      } else if (a.phase === 'fall') {
        const t = Math.min(1, (now - a.fallStart) / 450);
        a.y = a.y0 + (goal - a.y0) * t * t; // gravity-like ease-in
        shadow = t * t;
        if (t >= 1) {
          // Land: bounce back up a few px and let a lively spring settle it, while the ring rocks.
          a.phase = 'spring';
          a.y = goal;
          a.v = -340; // about 8 px of upward bounce
          a.k = 300;
          a.zeta = 0.5;
          a.rot = 5;
          a.rotV = 0;
          a.glintPending = true;
          playLanding(goal);
        }
      } else {
        // y spring (stiffness k, damping ratio zeta), then the tilt spring (lightly damped, ~0.5 s)
        const c = 2 * a.zeta * Math.sqrt(a.k);
        a.v += (-a.k * (a.y - goal) - c * a.v) * dt;
        a.y += a.v * dt;
      }
      const rk = 260, rc = 2 * 0.3 * Math.sqrt(rk); // rocks for about half a second
      a.rotV += (-rk * a.rot - rc * a.rotV) * dt;
      a.rot += a.rotV * dt;
      draw(a.y, a.rot, a.phase !== 'wait', shadow);

      const settled = a.phase === 'spring' && Math.abs(a.y - goal) < 0.15 && Math.abs(a.v) < 4 && Math.abs(a.rot) < 0.08 && Math.abs(a.rotV) < 0.5;
      if (a.phase === 'spring' && a.slideWobble && Math.abs(a.y - goal) < 0.6 && Math.abs(a.v) < 12) {
        a.slideWobble = false; // a tiny rock at the end of each slide
        a.rot = a.dir * 2;
      }
      if (settled) {
        a.y = goal;
        a.rot = 0;
        draw(a.y, 0);
        a.running = false;
        if (a.glintPending) {
          a.glintPending = false;
          setTimeout(playGlint, 150);
        }
        return;
      }
      a.raf = requestAnimationFrame(tick);
    };
    a.raf = requestAnimationFrame(tick);
  };

  // Mount: place the ring (no flash at its final spot), then drop once per session unless motion is reduced.
  useLayoutEffect(() => {
    const goal = ringY(sizeUS);
    target.current = goal;
    const skip = reduced() || dropDone() || document.visibilityState === 'hidden';
    anim.current = { phase: skip ? 'spring' : 'wait', y: skip ? goal : -30, v: 0, k: 220, zeta: 0.85, rot: 0, rotV: 0, startAt: performance.now() + 250 };
    draw(anim.current.y, 0, skip, skip ? 1 : 0);
    if (!skip) {
      markDropped();
      run();
    }
    return () => cancelAnimationFrame(anim.current?.raf);
  }, []);

  // Size changes: slide (interruptible), or jump when motion is reduced.
  useEffect(() => {
    const goal = ringY(sizeUS);
    const a = anim.current;
    if (!a || goal === target.current) return;
    a.dir = goal > target.current ? 1 : -1;
    target.current = goal;
    if (reduced()) {
      a.y = goal;
      a.v = 0;
      draw(goal, 0);
      return;
    }
    if (a.phase === 'spring') {
      // Keep velocity; a calm spring with no visible bounce, about half a second.
      a.k = 220;
      a.zeta = 0.85;
      a.slideWobble = true;
    }
    run();
  }, [sizeUS]);

  // If reduced motion is switched on mid-way, stop and place the ring.
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (!mq.matches || !anim.current) return;
      cancelAnimationFrame(anim.current.raf);
      Object.assign(anim.current, { running: false, phase: 'spring', y: target.current, v: 0, rot: 0, rotV: 0 });
      draw(target.current, 0);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Ghost ring: shows where a hovered or focused size sits before you commit. One shared element whose y
  // springs to the hovered size, so sweeping across the pills glides instead of flickering.
  const ghostState = useRef({ x: null, v: 0, raf: 0 });
  useEffect(() => {
    const el = ghost.current;
    if (!el) return;
    if (previewUS == null || previewUS === sizeUS) {
      el.style.opacity = '0';
      return;
    }
    const goal = ringY(previewUS);
    const s = ghostState.current;
    el.style.opacity = '1';
    const place = (y) => {
      const e = ellipseAtY(y);
      el.setAttribute('d', arc({ ...e, cy: e.cy - BAND / 2 }, true));
    };
    if (s.x == null || reduced()) {
      s.x = goal;
      s.v = 0;
      place(goal);
      return;
    }
    cancelAnimationFrame(s.raf);
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const done = stepSpring(s, goal, dt, 420, 1);
      place(s.x);
      if (!done) s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(s.raf);
  }, [previewUS, sizeUS]);

  // Light that follows the pointer (fine pointers only, off under reduced motion): the specular stripe on the
  // steel and the ring's highlight shift toward the cursor, and the tool parallaxes a few px against its shadow.
  useEffect(() => {
    const host = svg.current?.closest('.mandrel-card');
    if (!host || !finePointer() || reduced()) return;
    const s = { x: 0, v: 0, goal: 0, raf: 0 };
    const apply = () => {
      const k = s.x; // -1 (left) … 1 (right)
      specular.current?.setAttribute('offset', (0.22 + 0.06 * k).toFixed(3));
      ringHi.current?.setAttribute('offset', (0.25 + 0.1 * k).toFixed(3));
      body.current?.setAttribute('transform', `translate(${(3 * k).toFixed(2)} 0)`);
      groundRef.current?.setAttribute('transform', `translate(${(-2 * k).toFixed(2)} 0)`);
    };
    const loop = () => {
      let last = performance.now();
      cancelAnimationFrame(s.raf);
      const step = (now) => {
        const dt = Math.min(0.034, (now - last) / 1000);
        last = now;
        const done = stepSpring(s, s.goal, dt, 160, 1);
        apply();
        if (!done) s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    };
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      s.goal = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      loop();
    };
    const onLeave = () => {
      s.goal = 0;
      loop();
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(s.raf);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const sel = Math.round(sizeUS * 2) / 2;
  const hov = previewUS == null ? null : Math.round(previewUS * 2) / 2;
  const tone = metalTones(materialId);
  const steel = (pct) => `color-mix(in oklab, var(--ink) ${pct}%, var(--surface))`;
  const steelStops = (spec) => html`
    <stop offset="0" style=${`stop-color:${steel(46)}`} />
    <stop offset="0.1" style=${`stop-color:${steel(32)}`} />
    <stop offset="0.22" ref=${spec} style=${`stop-color:${steel(6)}`} />
    <stop offset="0.3" style=${`stop-color:${steel(22)}`} />
    <stop offset="0.6" style=${`stop-color:${steel(32)}`} />
    <stop offset="0.85" style=${`stop-color:${steel(46)}`} />
    <stop offset="0.94" style=${`stop-color:${steel(30)}`} />
    <stop offset="1" style=${`stop-color:${steel(46)}`} />`;
  const lathe = [0.18, 0.42, 0.66, 0.86].map((f) => M.yTop + f * M.coneHeight);

  return html`<figure class="mandrel-card" aria-hidden="true">
    <svg class="mandrel" viewBox=${`0 0 ${M.width} ${M.height}`} preserveAspectRatio="xMidYMid meet" ref=${svg}>
      <defs>
        <linearGradient id="mdl-steel" x1="0" x2="1" y1="0" y2="0">${steelStops(specular)}</linearGradient>
        <linearGradient id="mdl-steel-2" x1="0" x2="1" y1="0" y2="0">${steelStops(null)}</linearGradient>
        <linearGradient id="mdl-metal" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style=${`stop-color:${tone.dark}`} />
          <stop offset="0.25" ref=${ringHi} style=${`stop-color:${tone.light}`} />
          <stop offset="0.5" style=${`stop-color:${tone.mid}`} />
          <stop offset="0.82" style=${`stop-color:${tone.body}`} />
          <stop offset="1" style=${`stop-color:${tone.dark}`} />
        </linearGradient>
        <linearGradient id="mdl-glint" ref=${glintGrad} x1="0" x2="1" y1="0" y2="0" gradientTransform="translate(-0.7 0)">
          <stop offset="0.4" stop-color="#fff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.95" />
          <stop offset="0.6" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="mdl-shadow-g"><stop offset="0" style="stop-color:var(--ink);stop-opacity:.26" /><stop offset="1" style="stop-color:var(--ink);stop-opacity:0" /></radialGradient>
        <radialGradient id="mdl-contact-g"><stop offset="0" style="stop-color:var(--ink);stop-opacity:.34" /><stop offset="1" style="stop-color:var(--ink);stop-opacity:0" /></radialGradient>
        <clipPath id="mdl-cone-clip"><polygon points=${CONE} /></clipPath>
      </defs>

      <ellipse ref=${groundRef} class="mdl-ground" cx=${M.cx} cy=${GROUND_Y} rx=${HANDLE.half1 * 1.6} ry="5" fill="url(#mdl-shadow-g)" />
      <g ref=${body}>
        <g data-ring><path ref=${back} class="mdl-band-back" style=${`stroke:${tone.back}`} /></g>

        <!-- the collar sits under the cone, so only its rim shows around the base -->
        <path class="mdl-steel" d=${`M${M.cx - COLLAR.half} ${COLLAR.top}L${M.cx + COLLAR.half} ${COLLAR.top}L${M.cx + COLLAR.half} ${COLLAR.top + COLLAR.h}A${COLLAR.half} ${COLLAR.half * 0.22} 0 0 1 ${M.cx - COLLAR.half} ${COLLAR.top + COLLAR.h}Z`} fill="url(#mdl-steel-2)" />
        <ellipse class="mdl-cap" cx=${M.cx} cy=${COLLAR.top} rx=${COLLAR.half} ry=${COLLAR.half * 0.22} />
        <polygon class="mdl-steel" points=${CONE} fill="url(#mdl-steel)" />
        <line class="mdl-rim" x1=${M.cx - halfAt(coneTopY) + 1.2} y1=${coneTopY + 1} x2=${M.cx - halfAt(coneBotY) + 1.2} y2=${coneBotY - 1} />
        <g clip-path="url(#mdl-cone-clip)">
          ${lathe.map((y) => html`<path class="mdl-lathe" d=${arc({ cx: M.cx, cy: y, rx: halfAt(y), ry: halfAt(y) * 0.22 }, true)} />`)}
          <ellipse ref=${contact} class="mdl-contact" fill="url(#mdl-contact-g)" />
        </g>

        <path class="mdl-seam" d=${arc({ cx: M.cx, cy: HANDLE.top - 1.5, rx: HANDLE.half0 + 1, ry: (HANDLE.half0 + 1) * 0.22 }, true)} />
        <path class="mdl-steel" d=${handlePath} fill="url(#mdl-steel-2)" />

        ${TICKS.map((t) => {
          const on = t.us === sel, hovered = t.us === hov && !on;
          const x0 = M.cx + halfAt(t.y) + 8;
          return html`<g class=${'mdl-tick' + (on ? ' on' : '') + (hovered ? ' hover' : '') + (t.whole ? '' : ' half')} key=${t.us}>
            <line x1=${x0} x2=${x0 + (t.whole ? 16 : 9)} y1=${t.y} y2=${t.y} />
            <line class="mdl-tick-lit" x1=${x0} x2=${x0 + (t.whole ? 16 : 9)} y1=${t.y + 1} y2=${t.y + 1} />
            ${t.whole && html`<text x=${x0 + 21} y=${t.y + 3.5}>${t.us}</text>`}
            ${!t.whole && (on || hovered) && html`<text x=${x0 + 14} y=${t.y + 3.5}>${fmtUs(t.us)}</text>`}
          </g>`;
        })}

        <path ref=${ghost} class="mdl-ghost" />
        <g data-ring>
          <path ref=${face} class="mdl-band" fill="url(#mdl-metal)" />
          <path ref=${glintFace} class="mdl-band-glint" fill="url(#mdl-glint)" />
          <path ref=${bevel} class="mdl-bevel" />
        </g>
        <ellipse ref=${pulse} class="mdl-pulse" />
      </g>
    </svg>
    <figcaption class="mdl-caption"><${RollingText} text=${`US ${fmtUs(sizeUS)} · Ø ${usToDiameter(sizeUS).toFixed(1)} mm`} /></figcaption>
  </figure>`;
}

/** Digits roll vertically to their new value (tabular numerals); other characters stay put. */
function RollingText({ text }) {
  return html`<span class="roll" aria-hidden="true">
    ${[...text].map((ch, i) =>
      /\d/.test(ch)
        ? html`<span class="roll-digit" key=${i}><span class="roll-strip" style=${`transform: translateY(${-+ch}em)`}>${'0123456789'.split('').map((d) => html`<span>${d}</span>`)}</span></span>`
        : html`<span class="roll-char" key=${i}>${ch}</span>`
    )}
  </span>`;
}
