// Specs rail: size, layout, band shape, relief, material, printability and price.
import { html } from '../lib/html.js';
import { Icon, Segmented, Slider } from './ui.js';
import { useEffect, useState } from 'preact/hooks';
import { LAYOUTS, SPLIT, getSplit, splitPatch, hasMiddle, hasSides } from '../lib/templates.js';
import { MATERIALS, PLATINGS, getMaterial } from '../lib/materials.js';
import { sizeSummary, US_MIN, US_MAX, fmtUs } from '../lib/sizes.js';
import { resolveZones } from '../lib/band.js';
import { runChecks, estimate, money } from '../lib/checks.js';
import { store, setDesign, setRails, patternById, go, toast } from '../state.js';
import { RailStrip } from './rail-strip.js';
import { clink, tick, snap, engrave } from '../lib/sound.js';
import { ENGRAVE_KINDS, ENGRAVE_FONTS, ENGRAVE_MARGIN, LETTER_MIN, LETTER_MAX, DEPTH_MIN, DEPTH_MAX, MAX_CUSTOM, getFont, getEngraving, engravingLayout, cleanInitials, cleanCustom } from '../lib/engraving.js';

const profileIcon = {
  flat: 'M3 6h18v12H3Z',
  domed: 'M3 18V11C3 6 21 6 21 11v7Z',
  comfort: 'M3 17V9c0-4 18-4 18 0v8c0 2-18 2-18 0Z',
  bevel: 'M3 18V9l3-3h12l3 3v9Z',
};

const layoutIcon = (id) => {
  const z = LAYOUTS[id].zones;
  return html`<svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true">
    <rect x="1" y="1" width="32" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="1.4" />
    ${z.map((zz) => html`<rect x=${2 + zz.from * 30} y="3" width=${(zz.to - zz.from) * 30} height="16" rx="1.5"
      fill=${zz.id === 'middle' ? 'var(--zone-mid)' : 'var(--zone-side)'} opacity="0.85" />`)}
  </svg>`;
};

const REPEAT_MIN = 2, REPEAT_MAX = 80;

function Repeats({ label, axis, design, natural }) {
  const v = design.repeats[axis];
  const cur = v || natural;
  const [text, setText] = useState(String(cur));
  const [err, setErr] = useState('');
  useEffect(() => setText(String(cur)), [cur]);
  const set = (n) => setDesign({ repeats: { ...design.repeats, [axis]: n } });
  const commit = () => {
    const n = parseInt(text, 10);
    if (!text.trim()) return set(0), setErr('');
    if (Number.isNaN(n) || n < REPEAT_MIN || n > REPEAT_MAX) {
      setErr(`Enter a whole number from ${REPEAT_MIN} to ${REPEAT_MAX}.`);
      setText(String(cur));
      return;
    }
    setErr('');
    set(n);
  };
  const id = `rep-${axis}`;
  return html`<div class="repeat-row">
    <label for=${id}>${label}</label>
    <div class="stepper" role="group" aria-label=${`${label} repeats`}>
      <button onClick=${() => set(Math.max(REPEAT_MIN, cur - 1))} aria-label="Fewer repeats">−</button>
      <input id=${id} inputmode="numeric" value=${text} aria-describedby=${err ? id + '-err' : undefined}
        onInput=${(e) => setText(e.currentTarget.value.replace(/[^0-9]/g, ''))}
        onBlur=${commit} onKeyDown=${(e) => e.key === 'Enter' && (e.preventDefault(), commit(), e.currentTarget.blur())} />
      <button onClick=${() => set(Math.min(REPEAT_MAX, cur + 1))} aria-label="More repeats">+</button>
    </div>
    <button class=${'link-btn' + (v ? '' : ' is-auto')} disabled=${!v} onClick=${() => set(0)} title="Fit the repeats to the ring automatically">${v ? 'Auto' : 'auto'}</button>
    ${err && html`<p class="field-err" id=${id + '-err'} role="alert">${err}</p>`}
  </div>`;
}

function SplitControl({ design }) {
  const cfg = SPLIT[design.layout];
  if (!cfg) return null;
  const s = getSplit(design);
  const mid = design.layout === 'rails' ? 'polished centre' : 'middle';
  return html`<${Slider} label=${cfg.label} value=${s} min=${cfg.min} max=${cfg.max} step=${0.01} unit=""
    format=${(v) => `${(v * design.width).toFixed(1)} mm ${cfg.unit}`}
    hint=${`${mid[0].toUpperCase() + mid.slice(1)}: ${((1 - 2 * s) * design.width).toFixed(1)} mm. You can also drag the handles on the unrolled band.`}
    onInput=${(v) => setDesign(splitPatch(design, v))} />`;
}

export function ChecksList({ design, compact = false, only }) {
  const { checks } = runChecks(design, patternById);
  const shown = (compact ? checks.filter((c) => c.level !== 'ok') : checks).filter((c) => !only || only(c));
  const icon = { error: 'alert', warn: 'alert', info: 'info', ok: 'check' };
  if (!shown.length) return html`<p class="checks-clear"><${Icon} name="check" size=${16} /> Ready to print. All checks pass.</p>`;
  return html`<ul class="checks">
    ${shown.map(
      (c) => html`<li class=${'check ' + c.level}>
        <span class="check-icon"><${Icon} name=${icon[c.level]} size=${15} /></span>
        <div>
          <strong>${c.title}</strong>
          <p>${c.detail}</p>
          ${c.fix &&
          html`<button class="fix-btn" onClick=${() => {
            const prev = store.get().design;
            setDesign(c.fix.patch);
            toast(`Fixed: ${c.fix.label}`, { label: 'Undo', run: () => store.set({ design: prev }) });
          }}><${Icon} name="sparkle" size=${13} /> ${c.fix.label}</button>`}
        </div>
      </li>`
    )}
  </ul>`;
}

/** Inside engraving: pick a style, type the initials or text, set the letter size. */
function EngravingPanel({ design }) {
  const e = getEngraving(design);
  const set = (patch) => setDesign({ engraving: { ...e, ...patch } });
  const L = engravingLayout(design);
  const twoNames = e.kind === 'for' || e.kind === 'heart';
  const m = getMaterial(design.materialId);
  const font = getFont(e.font);
  const minH = Math.min(LETTER_MAX, Math.ceil((m.minDetail / font.stroke) * 10) / 10);
  const engChecks = runChecks(design, patternById).checks.filter((c) => /ngrav/.test(c.title) && c.level !== 'ok');
  return html`<section class="spec-sec" id="spec-engraving">
    <h3 class="sr-only">Inside engraving</h3>
    <p class="hint engr-lead">Cut into the inside of the band. Pick a style, a font, and how big and deep the letters are.</p>
    <div class="engr-kinds" role="radiogroup" aria-label="Engraving style">
      ${ENGRAVE_KINDS.map((k) => html`<button role="radio" aria-checked=${e.kind === k.id} class=${'chip sm' + (e.kind === k.id ? ' on' : '')}
        title=${k.hint || ''} onClick=${() => set({ kind: k.id })}>${k.label}</button>`)}
    </div>

    ${(e.kind === 'initials' || twoNames) &&
    html`<div class="engr-names">
      <label class="field">${twoNames ? 'From' : 'Initials'}
        <input value=${e.a} maxlength="3" autocapitalize="characters" spellcheck="false" aria-describedby="engr-names-hint"
          onInput=${(ev) => (engrave(), set({ a: cleanInitials(ev.currentTarget.value) }))} /></label>
      ${twoNames && html`<label class="field">To
        <input value=${e.b} maxlength="3" autocapitalize="characters" spellcheck="false" aria-describedby="engr-names-hint"
          onInput=${(ev) => (engrave(), set({ b: cleanInitials(ev.currentTarget.value) }))} /></label>`}
    </div>
    <p class="hint" id="engr-names-hint">Up to three letters each.</p>`}

    ${e.kind === 'custom' &&
    html`<label class="field">Text
      <input value=${e.text} maxlength=${MAX_CUSTOM} spellcheck="false" placeholder="e.g. always · 10.10.26"
        onInput=${(ev) => (engrave(), set({ text: cleanCustom(ev.currentTarget.value) }))} /></label>
    <p class="hint">${(e.text || '').length} / ${MAX_CUSTOM}. Letters, numbers, spaces and . , & ' + − ♥</p>`}

    ${e.kind !== 'none' &&
    html`<span class="field-label">Font</span>
      <div class="engr-fonts" role="radiogroup" aria-label="Engraving font">
        ${ENGRAVE_FONTS.map((f) => html`<button role="radio" aria-checked=${font.id === f.id} class=${'engr-font' + (font.id === f.id ? ' on' : '')}
          title=${f.hint} onClick=${() => set({ font: f.id })}>
          <span class="engr-font-sample" style=${`font: ${f.css.replace('100px', '17px')}`} aria-hidden="true">Ag</span>
          <span class="engr-font-name">${f.label}</span>
        </button>`)}
      </div>
      <p class="hint">${font.hint}.</p>
      <${Slider} label="Letter height" value=${e.size} min=${LETTER_MIN} max=${LETTER_MAX} step=${0.1} unit=" mm"
        format=${(v) => `${v.toFixed(1)} mm`} onInput=${(v) => set({ size: +v.toFixed(1) })} />
      <p class="hint">${m.name} needs ${font.label.toLowerCase()} letters of at least ${minH} mm; this band fits up to ${L ? L.maxH : (design.width - 1.4).toFixed(1)} mm.</p>
      <${Slider} label="Depth" value=${L ? L.depth : e.depth} min=${DEPTH_MIN} max=${DEPTH_MAX} step=${0.05} unit=" mm"
        format=${(v) => `${v.toFixed(2)} mm`} onInput=${(v) => set({ depth: +v.toFixed(2) })} />
      <p class="hint">Deeper reads better and survives polishing, but keep it under about 1.5× the stroke width${L ? ` (${(L.strokeMM * 1.5).toFixed(2)} mm here)` : ''}.</p>
      ${L && html`<${EngravingPreview} design=${design} L=${L} />`}
      ${engChecks.length > 0 && html`<${ChecksList} design=${design} only=${(c) => engChecks.some((x) => x.title === c.title)} />`}`}
  </section>`;
}

/** The inside of the band laid flat at true proportions, with the clear margins marked. */
function EngravingPreview({ design, L }) {
  const span = Math.min(L.innerCirc, Math.max(L.lengthMM + 10, 24));
  const W = design.width;
  const fontSize = L.h / L.capEm; // so capital letters come out exactly L.h mm tall
  const tooLong = L.lengthMM > L.maxLength;
  return html`<figure class="engr-preview">
    <svg viewBox=${`0 0 ${span} ${W}`} role="img" aria-label=${`Inside of the band, ${W} mm wide, engraved “${L.text}” in ${L.h} mm letters`}>
      <rect class="engr-band" x="0" y="0" width=${span} height=${W} />
      <rect class="engr-safe" x="0" y=${ENGRAVE_MARGIN} width=${span} height=${Math.max(0, W - 2 * ENGRAVE_MARGIN)} />
      <text class=${'engr-text' + (L.h > L.maxH || tooLong ? ' bad' : '')} x=${span / 2} y=${W / 2 + L.h / 2}
        style=${`font: ${L.font.css.replace('100px', `${fontSize}px`)}`}>${L.text}</text>
    </svg>
    <figcaption>Inside, laid flat · ${span.toFixed(0)} of ${L.innerCirc.toFixed(0)} mm shown · text ${L.lengthMM.toFixed(0)} mm long · ${L.depth} mm deep</figcaption>
  </figure>`;
}

export const SPEC_CATS = [
  { id: 'size', label: 'Size', icon: 'ruler' },
  { id: 'layout', label: 'Layout', icon: 'layout' },
  { id: 'band', label: 'Band & relief', icon: 'band' },
  { id: 'material', label: 'Material & finish', icon: 'swatch' },
  { id: 'engraving', label: 'Inside engraving', icon: 'type' },
  { id: 'checks', label: 'Printability', icon: 'shield' },
];

function checkStatus(design) {
  const { errors, warnings } = runChecks(design, patternById);
  return errors
    ? { level: 'error', text: `${errors} to fix`, short: errors }
    : warnings
      ? { level: 'warn', text: `${warnings} warning${warnings > 1 ? 's' : ''}`, short: warnings }
      : { level: 'ok', text: 'All good' };
}

/** The category strip for the specs panel; the Printability tab carries the check count. */
export function SpecStrip() {
  const design = store.use((s) => s.design);
  store.use((s) => s.customPatterns);
  const rails = store.use((s) => s.rails);
  const status = checkStatus(design);
  const items = SPEC_CATS.map((c) => (c.id === 'checks' && status.level !== 'ok' ? { ...c, badge: status } : c));
  return html`<${RailStrip} side="spec" label="Specification categories" items=${items} value=${rails.specCat || 'size'} open=${rails.specOpen}
    onPick=${(id) => setRails({ specCat: id, specOpen: true })} onClose=${() => setRails({ specOpen: false })} />`;
}

export function Specs({ onHide }) {
  const design = store.use((s) => s.design);
  store.use((s) => s.customPatterns);
  const cat = store.use((s) => s.rails.specCat) || 'size';
  const size = sizeSummary(design.sizeUS);
  const m = getMaterial(design.materialId);
  const zones = resolveZones(design, patternById);
  const nat = (id) => zones.find((z) => z.id === id && z.pattern)?.repeats;
  const status = checkStatus(design);
  const price = estimate(design);
  const groups = [...new Set(MATERIALS.map((x) => x.group))];
  const title = SPEC_CATS.find((c) => c.id === cat)?.label;

  return html`<aside class="rail specs" aria-label="Ring specifications">
    <div class="rail-title">
      <span>${title}</span>
      ${onHide && html`<button class="rail-hide" onClick=${onHide} aria-label="Hide specs panel" title="Hide panel (])"><${Icon} name="panelR" size=${16} /></button>`}
    </div>
    <div class="rail-body" id="spec-panel" role="tabpanel" aria-labelledby=${`spec-tab-${cat}`} key=${cat}>
      ${cat === 'size' &&
      html`<section class="spec-sec">
        <h3 class="sr-only">Size</h3>
        <div class="size-display">
          <span class="size-big">US ${size.us}</span>
          <span class="size-alt">EU ${size.eu} · UK ${size.uk} · Ø ${size.diameter.toFixed(1)} mm</span>
        </div>
        <${Slider} label="Ring size (US)" value=${design.sizeUS} min=${US_MIN} max=${US_MAX} step=${0.25} unit=""
          format=${fmtUs} onInput=${(v) => (tick(), setDesign({ sizeUS: v }))} onCommit=${snap} />
        <button class="btn ghost sm size-find" onClick=${() => store.set({ sizeFinderOpen: true })}><${Icon} name="ruler" size=${14} /> Find my size</button>
      </section>`}

      ${cat === 'layout' &&
      html`<section class="spec-sec" id="spec-layout">
        <h3 class="sr-only">Layout</h3>
        <${Segmented} label="Layout" size="full layout-seg" value=${design.layout}
          options=${Object.keys(LAYOUTS).map((id) => ({ value: id, title: LAYOUTS[id].hint, node: html`${layoutIcon(id)}<span>${LAYOUTS[id].name}</span>` }))}
          onChange=${(v) => setDesign({ layout: v })} />
        <p class="hint">${LAYOUTS[design.layout].hint}</p>
        <${SplitControl} design=${design} />
      </section>`}

      ${cat === 'band' &&
      html`<section class="spec-sec">
        <h3>Band</h3>
        <${Slider} label="Width" value=${design.width} min=${2} max=${12} step=${0.5} onInput=${(v) => setDesign({ width: v })} />
        <${Slider} label="Thickness" value=${design.thickness} min=${1} max=${3} step=${0.1} onInput=${(v) => setDesign({ thickness: +v.toFixed(1) })} />
        <span class="field-label">Profile</span>
        <${Segmented} label="Profile" size="full layout-seg" value=${design.profile}
          options=${['flat', 'domed', 'comfort', 'bevel'].map((p) => ({
            value: p,
            node: html`<svg width="22" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d=${profileIcon[p]} fill="currentColor" opacity=".8" /></svg><span>${p[0].toUpperCase() + p.slice(1)}</span>`,
          }))}
          onChange=${(v) => setDesign({ profile: v })} />
      </section>
      <section class="spec-sec">
        <h3>Pattern relief</h3>
        <${Segmented} label="Relief style" size="full" value=${design.style}
          options=${[{ value: 'raised', label: 'Raised' }, { value: 'engraved', label: 'Engraved' }]}
          onChange=${(v) => setDesign({ style: v })} />
        <${Slider} label="Depth" value=${design.relief} min=${0.1} max=${0.7} step=${0.05} onInput=${(v) => setDesign({ relief: +v.toFixed(2) })} />
        ${hasMiddle(design.layout) && nat('middle') && html`<${Repeats} label="Middle repeats" axis="middle" design=${design} natural=${nat('middle')} />`}
        ${hasSides(design.layout) && (nat('sideL') || nat('sideR')) && html`<${Repeats} label="Side repeats" axis="side" design=${design} natural=${nat('sideL') || nat('sideR')} />`}
      </section>`}

      ${cat === 'material' &&
      html`<section class="spec-sec">
        <h3 class="sr-only">Material</h3>
        ${groups.map(
          (g) => html`<div class="mat-group">
            <span class="field-label">${g}</span>
            <div class="swatches" role="radiogroup" aria-label=${g}>
              ${MATERIALS.filter((x) => x.group === g).map(
                (x) => html`<button role="radio" aria-checked=${design.materialId === x.id} class=${'swatch' + (design.materialId === x.id ? ' on' : '')}
                  onClick=${() => (x.id !== design.materialId && clink(x.id), setDesign({ materialId: x.id }))} title=${x.name}>
                  <span class="swatch-dot" style=${`--c:${x.color}; --m:${x.metalness}`}></span>
                  <span class="swatch-name">${x.name}</span>
                </button>`
              )}
            </div>
          </div>`
        )}
        <p class="mat-process"><strong>${m.process}</strong> · min wall ${m.minWall} mm · min detail ${m.minDetail} mm
          ${m.leadDays ? ` · typically ~${m.leadDays} days at a service` : ' · print it yourself'}</p>
        ${m.platable &&
        html`<span class="field-label">Plating after printing</span>
          <${Segmented} label="Plating" size="full" value=${design.plating}
            options=${Object.keys(PLATINGS).map((k) => ({ value: k, label: k === 'none' ? 'None' : PLATINGS[k].name.replace(' plating', '') }))}
            onChange=${(v) => setDesign({ plating: v })} />`}
        <span class="field-label">Finish</span>
        <${Segmented} label="Finish" size="full" value=${design.finish}
          options=${[{ value: 'polished', label: 'Polished' }, { value: 'satin', label: 'Satin' }, ...(m.metalness || (m.platable && design.plating !== 'none') ? [{ value: 'antique', label: 'Antique' }] : [])]}
          onChange=${(v) => setDesign({ finish: v })} />
      </section>`}

      ${cat === 'engraving' && html`<${EngravingPanel} design=${design} />`}

      ${cat === 'checks' &&
      html`<section class="spec-sec" id="spec-checks" aria-labelledby="checks-h">
        <div class="spec-head">
          <h3 id="checks-h" class="sr-only">Printability</h3>
          <span class=${'pill ' + status.level}>${status.text}</span>
        </div>
        <${ChecksList} design=${design} />
      </section>`}
    </div>

    <div class="price-card">
      <div>
        <span class="price-meta">
          <span class="muted">Estimated</span>
          <button class=${'check-chip ' + status.level} onClick=${() => setRails({ specCat: 'checks', specOpen: true })}
            aria-label=${`Printability: ${status.text}. Show checks`} title="Show printability checks">
            <${Icon} name=${status.level === 'ok' ? 'check' : 'alert'} size=${12} /> ${status.level === 'ok' ? 'Printable' : status.text}
          </button>
        </span>
        <strong class="price">${money(price.total)}</strong>
        <span class="muted small">Estimate, not a quote</span>
      </div>
      <button class="btn primary" onClick=${() => go('tryon')}>Try it on <${Icon} name="right" size=${16} /></button>
    </div>
  </aside>`;
}
