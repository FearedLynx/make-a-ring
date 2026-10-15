import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { TopBar, StepNav, copyShareLink } from '../components/topbar.js';
import { Icon, Modal } from '../components/ui.js';
import { RingView } from '../components/ring-view.js';
import { BandMap } from '../components/pattern-art.js';
import { ChecksList } from '../components/specs.js';
import { LAYOUTS } from '../lib/templates.js';
import { getMaterial, PLATINGS } from '../lib/materials.js';
import { sizeSummary } from '../lib/sizes.js';
import { runChecks, estimate, money } from '../lib/checks.js';
import { store, go, patternById } from '../state.js';

const FORMATS = [
  { id: 'stl', name: 'STL', desc: 'Works with every slicer and casting house.', mb: 12.6 },
  { id: '3mf', name: '3MF', desc: 'Keeps units and material. Best for modern slicers.', mb: 3.4 },
  { id: 'obj', name: 'OBJ', desc: 'For jewellers who want to keep editing in CAD.', mb: 17.9 },
];

const STEPS = [
  'Building a watertight mesh',
  'Checking wall thickness and detail size',
  'Compensating inner diameter',
  'Packaging files and maker brief',
];

const slug = (s) => (s || 'ring').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ring';

function ExportModal({ open, onClose, design, name }) {
  const [formats, setFormats] = useState(['stl', '3mf']);
  const [brief, setBrief] = useState(true);
  const [phase, setPhase] = useState('choose'); // choose | working | done
  const [step, setStep] = useState(0);
  const timers = useRef([]);

  useEffect(() => {
    if (open) {
      setPhase('choose');
      setStep(0);
    }
    return () => timers.current.forEach(clearTimeout);
  }, [open]);

  const start = () => {
    setPhase('working');
    STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setStep(i + 1), 650 * (i + 1))));
    timers.current.push(setTimeout(() => setPhase('done'), 650 * STEPS.length + 350));
  };
  const size = sizeSummary(design.sizeUS);
  const base = `${slug(name)}_US${size.us.replace('½', '.5').replace('¼', '.25').replace('¾', '.75')}_${design.materialId}`;
  const files = [
    ...FORMATS.filter((f) => formats.includes(f.id)).map((f) => ({ name: `${base}.${f.id}`, size: `${(f.mb * (design.width / 7)).toFixed(1)} MB` })),
    ...(brief ? [{ name: `${base}_maker-brief.pdf`, size: '240 KB' }] : []),
  ];

  return html`<${Modal} open=${open} onClose=${onClose} title="Download print files">
    ${phase === 'choose' &&
    html`<div class="export">
      <fieldset class="format-list">
        <legend class="field-label">Formats</legend>
        ${FORMATS.map(
          (f) => html`<label class=${'format' + (formats.includes(f.id) ? ' on' : '')}>
            <input type="checkbox" checked=${formats.includes(f.id)}
              onChange=${() => setFormats(formats.includes(f.id) ? formats.filter((x) => x !== f.id) : [...formats, f.id])} />
            <span class="format-name">.${f.name.toLowerCase()}</span>
            <span class="format-desc">${f.desc}</span>
          </label>`
        )}
      </fieldset>
      <label class="check-row"><input type="checkbox" checked=${brief} onChange=${() => setBrief(!brief)} />
        Include a maker brief (PDF): dimensions, material and the printability report</label>
      <button class="btn primary full" disabled=${!formats.length} onClick=${start}><${Icon} name="download" size=${16} /> Generate ${files.length} file${files.length > 1 ? 's' : ''}</button>
    </div>`}
    ${phase !== 'choose' &&
    html`<div class="export">
      <ol class="progress-steps" aria-live="polite">
        ${STEPS.map(
          (s, i) => html`<li class=${step > i ? 'done' : step === i && phase === 'working' ? 'now' : ''}>
            <span class="ps-dot">${step > i ? html`<${Icon} name="check" size=${12} />` : ''}</span>${s}
          </li>`
        )}
      </ol>
      ${phase === 'done' &&
      html`<ul class="file-list">
          ${files.map((f) => html`<li><${Icon} name="file" size=${16} /><span>${f.name}</span><span class="muted">${f.size}</span></li>`)}
        </ul>
        <p class="proto-note"><${Icon} name="info" size=${14} /> Prototype: file generation is simulated. The real product would download these files here.</p>
        <button class="btn primary full" onClick=${onClose}>Done</button>`}
    </div>`}
  <//>`;
}

export function Review() {
  const viewer = useRef();
  const design = store.use((s) => s.design);
  const name = store.use((s) => s.ringName);
  const exportOpen = store.use((s) => s.exportOpen);
  store.use((s) => s.customPatterns);
  const m = getMaterial(design.materialId);
  const size = sizeSummary(design.sizeUS);
  const price = estimate(design);
  const { errors } = runChecks(design, patternById);
  const pn = (z) => patternById(design.patterns[z])?.name;
  const layout = LAYOUTS[design.layout];
  const hasZ = (z) => layout.zones.some((x) => x.id === z);

  const rows = [
    ['Size', `US ${size.us} · EU ${size.eu} · UK ${size.uk}`],
    ['Inner diameter', `${size.diameter.toFixed(2)} mm`],
    ['Band', `${design.width} mm wide · ${design.thickness} mm thick · ${design.profile} profile`],
    ['Layout', layout.name],
    hasZ('middle') && ['Middle', pn('middle') || 'Plain'],
    hasZ('sideL') && ['Sides', design.linked ? pn('sideL') || 'Plain' : `${pn('sideL') || 'Plain'} / ${pn('sideR') || 'Plain'}`],
    ['Relief', `${design.style} · ${design.relief} mm`],
    ['Material', `${m.name}${m.platable && design.plating !== 'none' ? ` + ${PLATINGS[design.plating].name.toLowerCase()}` : ''}`],
    ['Process', m.process],
    ['Finish', design.finish],
    ['Weight', `≈ ${price.grams.toFixed(1)} g`],
  ].filter(Boolean);

  return html`<div class="app-shell">
    <${TopBar} />
    <main class="review" id="main">
      <section class="review-hero">
        <div class="review-ring">
          <${RingView} design=${design} mode="hero" zoom autoRotate onViewer=${(v) => (viewer.current = v)}
            label="3D ring. Drag to rotate, scroll or use the buttons to zoom." />
          <div class="review-zoom" role="group" aria-label="Zoom">
            <button class="icon-btn" onClick=${() => viewer.current?.zoomBy(0.8)} aria-label="Zoom in" title="Zoom in"><${Icon} name="plus" /></button>
            <button class="icon-btn" onClick=${() => viewer.current?.zoomBy(1.25)} aria-label="Zoom out" title="Zoom out"><${Icon} name="minus" /></button>
            <button class="icon-btn" onClick=${() => viewer.current?.resetView()} aria-label="Reset view" title="Reset view"><${Icon} name="reset" /></button>
          </div>
        </div>
        <div class="review-title">
          <span class="eyebrow">Your design</span>
          <h1>${name || 'Untitled ring'}</h1>
          <p class="muted">${m.name} · US ${size.us} · ${design.width} mm</p>
        </div>
        <${BandMap} design=${design} getPattern=${patternById} className="review-band" />
        <div class="review-actions">
          <button class="btn ghost" onClick=${() => go('studio')}><${Icon} name="pen" size=${15} /> Edit design</button>
          <button class="btn ghost" onClick=${copyShareLink}><${Icon} name="share" size=${15} /> Copy share link</button>
        </div>
      </section>

      <section class="review-side">
        <div class="card">
          <h2>Specification</h2>
          <dl class="spec-sheet">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
        </div>

        <div class="card">
          <h2>Printability</h2>
          <${ChecksList} design=${design} />
        </div>

        <div class="card">
          <h2>Estimated cost</h2>
          <ul class="price-lines">
            ${price.lines.filter((l) => l.value > 0).map((l) => html`<li><span>${l.label}</span><span>${money(l.value)}</span></li>`)}
            <li class="total"><span>Total</span><span>${money(price.total)}</span></li>
          </ul>
          <p class="muted small">${price.leadDays ? `Made by a partner workshop in about ${price.leadDays} days.` : 'Print it yourself today. Plate it later if you like.'} A bespoke jeweller usually charges $2,000–5,000.</p>
        </div>

        <div class="card export-card">
          <h2>Print-ready files</h2>
          <p class="muted">STL, 3MF or OBJ, already checked against ${m.name} limits.</p>
          <button class="btn primary full" disabled=${errors > 0} onClick=${() => store.set({ exportOpen: true })}>
            <${Icon} name="download" size=${16} /> Download print files
          </button>
          ${errors > 0 && html`<p class="error-note" role="status"><${Icon} name="alert" size=${14} /> Fix ${errors} printability issue${errors > 1 ? 's' : ''} above first. One click each.</p>`}
          <ol class="next-steps">
            <li><strong>Download</strong> the files.</li>
            <li><strong>Print</strong> at home (PLA or resin), or send them to a casting house.</li>
            <li><strong>Finish</strong> by polishing or plating, then wear it.</li>
          </ol>
        </div>
        <${StepNav} back=${{ to: 'tryon', label: 'Try on' }} />
      </section>
    </main>
    <${ExportModal} open=${exportOpen} onClose=${() => store.set({ exportOpen: false })} design=${design} name=${name} />
  </div>`;
}
