// 2D renderings of patterns: card previews and the unrolled band map.
import { useRef } from 'preact/hooks';
import { html } from '../lib/html.js';

let uid = 0;
import { resolveZones, bandMetrics } from '../lib/band.js';
import { layoutZones, getSplit, SPLIT } from '../lib/templates.js';

const pathFor = (strokes, map, onlyFill = false) =>
  strokes
    .filter((s) => (onlyFill ? s.fill : true) && s.pts.length)
    .map((s) => s.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${map(x, y).map((n) => n.toFixed(2)).join(' ')}`).join('') + (s.closed ? 'Z' : ''))
    .join('');

/**
 * Card preview of a single pattern.
 *  layout 'strip' – horizontal row of tiles
 *  layout 'column' – vertical column (middle cards in the studio, like the sketch)
 *  layout 'pair' – two mirrored vertical columns (side cards in the studio)
 */
export function PatternArt({ pattern, layout = 'strip', repeats = 3, className = '' }) {
  if (!pattern) {
    return html`<div class=${'pattern-art plain ' + className} aria-hidden="true"><span>Plain</span></div>`;
  }
  const tw = pattern.aspect * 100;
  const sw = pattern.sw * 100;
  let vb, d = '', fill = '';
  if (layout === 'strip') {
    vb = `${-sw} ${-sw} ${repeats * tw + 2 * sw} ${100 + 2 * sw}`;
    for (let i = 0; i < repeats; i++) {
      const m = (x, y) => [i * tw + x * tw, y * 100];
      d += pathFor(pattern.strokes, m);
      fill += pathFor(pattern.strokes, m, true);
    }
  } else if (layout === 'column') {
    vb = `${-sw} 0 ${100 + 2 * sw} ${repeats * tw}`;
    for (let i = -1; i <= repeats; i++) {
      const m = (x, y) => [100 - y * 100, i * tw + x * tw];
      d += pathFor(pattern.strokes, m);
      fill += pathFor(pattern.strokes, m, true);
    }
  } else {
    const W = 300;
    vb = `${-sw} 0 ${W + 2 * sw} ${repeats * tw}`;
    for (let i = -1; i <= repeats; i++) {
      const l = (x, y) => [y * 90, i * tw + x * tw];
      const r = (x, y) => [W - y * 90, i * tw + x * tw];
      d += pathFor(pattern.strokes, l) + pathFor(pattern.strokes, r);
      fill += pathFor(pattern.strokes, l, true) + pathFor(pattern.strokes, r, true);
    }
  }
  return html`<svg class=${'pattern-art ' + className} viewBox=${vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <path d=${d} fill="none" stroke="currentColor" stroke-width=${sw} stroke-linecap="round" stroke-linejoin="round" />
    ${fill && html`<path d=${fill} fill="currentColor" />`}
  </svg>`;
}

/** The band unrolled flat, with every zone drawn exactly as it will be tiled on the ring. */
export function BandMap({ design, getPattern, activeZones = [], onZone, onSplit, className = '', labelled = false }) {
  const idp = useRef('bm' + ++uid).current;
  const { circ } = bandMetrics(design);
  const W = circ, H = design.width;
  const zones = resolveZones(design, getPattern);
  const names = { middle: 'Middle', sideL: 'Left side', sideR: 'Right side' };
  return html`<svg class=${'band-map ' + className} viewBox=${`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
    role=${onZone ? 'group' : 'img'} aria-label="Unrolled band preview">
    <rect x="0" y="0" width=${W} height=${H} rx=${H * 0.08} class="band-bg" />
    ${zones.map((z) => {
      const y0 = z.from * H, zh = (z.to - z.from) * H;
      const active = activeZones.includes(z.id);
      let d = '', fill = '';
      if (z.pattern) {
        const tw = W / z.repeats;
        for (let i = 0; i < z.repeats; i++) {
          const m = (x, y) => [i * tw + x * tw, z.flip ? y0 + zh - y * zh : y0 + y * zh];
          d += pathFor(z.pattern.strokes, m);
          fill += pathFor(z.pattern.strokes, m, true);
        }
      }
      const clip = `${idp}-${z.id}`;
      return html`<g class=${'band-zone' + (active ? ' active' : '') + (onZone ? ' clickable' : '')}
        onClick=${onZone && (() => onZone(z.id))}
        role=${onZone ? 'button' : undefined} tabindex=${onZone ? 0 : undefined}
        aria-label=${onZone ? `${names[z.id]}: ${z.pattern?.name || 'plain'}` : undefined}
        aria-pressed=${onZone ? active : undefined}
        onKeyDown=${onZone && ((e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onZone(z.id)))}>
        <clipPath id=${clip}><rect x="0" y=${y0} width=${W} height=${zh} /></clipPath>
        <rect class="zone-hit" x="0" y=${y0} width=${W} height=${zh} />
        <g clip-path=${`url(#${clip})`}>
          <path d=${d} fill="none" stroke-width=${z.lineMM} stroke-linecap="round" stroke-linejoin="round" vector-effect="none" />
          ${fill && html`<path d=${fill} class="fill" />`}
        </g>
        ${labelled && html`<text x="1" y=${y0 + zh / 2} class="zone-label">${names[z.id]}</text>`}
      </g>`;
    })}
    ${layoutZones(design).dividers.map((f) => html`<line x1="0" x2=${W} y1=${f * H} y2=${f * H} class="divider" stroke-width="0.3" />`)}
    ${onSplit && SPLIT[design.layout] && layoutZones(design).handles.map((f, i) => html`<${SplitHandle} key=${i} f=${f} W=${W} H=${H} design=${design} onSplit=${onSplit} />`)}
  </svg>`;
}

// Drag (or arrow-key) handle on a zone boundary. Both boundaries move together to stay symmetric.
function SplitHandle({ f, W, H, design, onSplit }) {
  const cfg = SPLIT[design.layout];
  const s = getSplit(design);
  const toFrac = (e) => {
    const svg = e.currentTarget.ownerSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const v = p.y / H;
    return v <= 0.5 ? v : 1 - v;
  };
  return html`<g class="split-handle" tabindex="0" role="slider" aria-label=${cfg.label}
    aria-valuemin=${Math.round(cfg.min * 100)} aria-valuemax=${Math.round(cfg.max * 100)} aria-valuenow=${Math.round(s * 100)}
    aria-valuetext=${`${Math.round(s * 100)}% of the band, ${(s * design.width).toFixed(1)} mm`}
    onPointerDown=${(e) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.drag = '1';
    }}
    onPointerMove=${(e) => e.currentTarget.dataset.drag && onSplit(toFrac(e))}
    onPointerUp=${(e) => delete e.currentTarget.dataset.drag}
    onKeyDown=${(e) => {
      const d = { ArrowUp: f < 0.5 ? -0.01 : 0.01, ArrowDown: f < 0.5 ? 0.01 : -0.01 }[e.key];
      if (d) {
        e.preventDefault();
        e.stopPropagation();
        onSplit(s + d);
      }
    }}>
    <rect x="0" y=${f * H - 0.45} width=${W} height="0.9" class="split-hit" />
    <line x1="0" x2=${W} y1=${f * H} y2=${f * H} class="split-line" />
    <rect x=${W / 2 - 2.2} y=${f * H - 0.38} width="4.4" height="0.76" rx="0.38" class="split-grip" />
  </g>`;
}
