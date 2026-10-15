// Decorative ring mandrel on the "Your size" step. A ring drops onto the cone once per session, lands on the
// selected size with a small bounce and rock, glints once, and then slides up or down whenever the size changes.
// Purely decorative (aria-hidden): the size card already tells screen readers the size.
//
// Motion runs in requestAnimationFrame and writes SVG attributes through refs, so Preact only re-renders when
// the size changes (to move the red tick), never per frame. Springs are integrated with velocity, so a new
// target mid-motion simply retargets from the current position and speed.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { html } from '../lib/html.js';
import { MANDREL as M, ringY, ellipseAtY, ticks } from '../lib/mandrel.js';
import { fmtUs } from '../lib/sizes.js';

const DROP_KEY = 'mar.mandrelDropped';
const TICKS = ticks();
const coneTopY = M.yTop - 14, coneBotY = M.yTop + M.coneHeight + 14;
const halfAt = (y) => M.topHalfWidth + ((y - M.yTop) / M.coneHeight) * (M.bottomHalfWidth - M.topHalfWidth);
const CONE = [
  [M.cx - halfAt(coneTopY), coneTopY], [M.cx + halfAt(coneTopY), coneTopY],
  [M.cx + halfAt(coneBotY), coneBotY], [M.cx - halfAt(coneBotY), coneBotY],
].map((p) => p.join(',')).join(' ');

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
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

/** Top or bottom half of an ellipse as a path (the back half is drawn behind the cone, the front half in front). */
const arc = ({ cx, cy, rx, ry }, front) => `M${cx - rx} ${cy}A${rx} ${ry} 0 0 ${front ? 0 : 1} ${cx + rx} ${cy}`;

export function Mandrel({ sizeUS }) {
  const back = useRef(), front = useRef(), glint = useRef(), group = useRef();
  const anim = useRef(null);
  const target = useRef(ringY(sizeUS));

  // Draw the ring at y with a tilt (degrees) and a small squash for the rocking wobble.
  const draw = (y, rot = 0, visible = true) => {
    const e = ellipseAtY(y);
    const squash = 1 + Math.min(0.12, Math.abs(rot) * 0.012);
    const shape = { ...e, ry: e.ry * squash };
    back.current?.setAttribute('d', arc(shape, false));
    front.current?.setAttribute('d', arc(shape, true));
    glint.current?.setAttribute('d', arc(shape, true));
    const t = `rotate(${rot.toFixed(2)} ${e.cx} ${e.cy})`;
    for (const g of group.current?.querySelectorAll('[data-ring]') || []) {
      g.setAttribute('transform', t);
      g.style.opacity = visible ? '' : '0';
    }
  };

  const playGlint = () => {
    if (!glint.current?.animate || reduced()) return;
    glint.current.animate(
      [{ strokeDashoffset: 1.25, opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0.9, offset: 0.75 }, { strokeDashoffset: -0.25, opacity: 0 }],
      { duration: 350, easing: 'ease-in-out' }
    );
  };

  // One loop for everything: fall (eased), then springs for y and the tilt.
  const run = () => {
    const a = anim.current;
    if (!a || a.running) return;
    a.running = true;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const goal = target.current;
      if (a.phase === 'wait') {
        if (now >= a.startAt) (a.phase = 'fall'), (a.fallStart = now), (a.y0 = a.y);
      } else if (a.phase === 'fall') {
        const t = Math.min(1, (now - a.fallStart) / 450);
        a.y = a.y0 + (goal - a.y0) * t * t; // gravity-like ease-in
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
      draw(a.y, a.rot, a.phase !== 'wait');

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
    draw(anim.current.y, 0, skip);
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

  const sel = Math.round(sizeUS * 2) / 2;
  const handleTop = coneBotY + 2;
  return html`<figure class="mandrel-card" aria-hidden="true">
    <svg class="mandrel" viewBox=${`0 0 ${M.width} ${M.height}`} ref=${group}>
      <g data-ring><path ref=${back} class="mdl-ring back" /></g>
      <polygon class="mdl-cone" points=${CONE} />
      <rect class="mdl-cone" x=${M.cx - M.bottomHalfWidth - 6} y=${handleTop} width=${(M.bottomHalfWidth + 6) * 2} height="10" rx="3" />
      <rect class="mdl-cone" x=${M.cx - 14} y=${handleTop + 12} width="28" height=${M.height - handleTop - 22} rx="8" />
      ${TICKS.map((t) => {
        const on = t.us === sel;
        const x0 = M.cx + halfAt(t.y) + 8;
        return html`<g class=${'mdl-tick' + (on ? ' on' : '')} key=${t.us}>
          <line x1=${x0} x2=${x0 + (t.whole ? 16 : 9)} y1=${t.y} y2=${t.y} />
          ${t.whole && html`<text x=${x0 + 21} y=${t.y + 3.5}>${t.us}</text>`}
          ${!t.whole && on && html`<text x=${x0 + 14} y=${t.y + 3.5}>${fmtUs(t.us)}</text>`}
        </g>`;
      })}
      <g data-ring>
        <path ref=${front} class="mdl-ring front" />
        <path ref=${glint} class="mdl-glint" pathLength="1" />
      </g>
    </svg>
  </figure>`;
}
