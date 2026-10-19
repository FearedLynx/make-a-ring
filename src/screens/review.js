import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { TopBar, StepNav, copyShareLink } from '../components/topbar.js';
import { Icon, Modal } from '../components/ui.js';
import { RingView } from '../components/ring-view.js';
import { BandMap } from '../components/pattern-art.js';
import { ChecksList } from '../components/specs.js';
import { LAYOUTS } from '../lib/templates.js';
import { getMaterial, PLATINGS } from '../lib/materials.js';
import { sizeSummary, usToDiameter, diameterToUs } from '../lib/sizes.js';
import { buildHeightmap } from '../lib/heightmap.js';
import { buildRingGeometry } from '../lib/ringGeometry.js';
import { engravingLayout } from '../lib/engraving.js';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { runChecks, estimate, money } from '../lib/checks.js';
import { store, go, patternById, announce, toast } from '../state.js';
import { chime } from '../lib/sound.js';
import { ringCard } from '../lib/ring-card.js';

const FORMATS = [
  { id: 'stl', name: 'STL', desc: 'Works with every slicer and casting house.' },
  { id: 'obj', name: 'OBJ', desc: 'For jewellers who want to keep editing in CAD.' },
];

const steps = (plated) => [
  'Building a watertight mesh',
  'Checking wall thickness and detail size',
  plated ? 'Compensating inner diameter for plating' : 'Setting the inner diameter',
  'Packaging files and maker brief',
];

const PLATING_MM = 0.05; // plating thickness the checker promises to compensate for
const slug = (s) => (s || 'ring').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ring';
const nextFrame = () => new Promise((r) => setTimeout(r, 30)); // lets the progress list repaint between heavy steps
const fmtBytes = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

const isPlated = (design) => getMaterial(design.materialId).platable && design.plating !== 'none';

/** Welded, watertight ring mesh in millimetres, the same surface the 3D preview shows. */
function printMesh(design) {
  // Plating grows every surface; open the inside by the same amount so the plated ring still fits.
  const d = isPlated(design)
    ? { ...design, sizeUS: diameterToUs(usToDiameter(design.sizeUS) + 2 * PLATING_MM), thickness: design.thickness - PLATING_MM }
    : design;
  const geom = buildRingGeometry(d, buildHeightmap(d, patternById), 1);
  geom.deleteAttribute('color');
  geom.deleteAttribute('normal');
  const welded = mergeVertices(geom);
  geom.dispose();
  return new THREE.Mesh(welded);
}

function makerBrief(name, rows, checks) {
  return [
    `Make-a-Ring maker brief: ${name || 'Untitled ring'}`,
    '',
    ...rows.map(([k, v]) => `${k.padEnd(18)}${v}`),
    '',
    'Printability',
    ...checks.map((c) => `[${c.level}] ${c.title}: ${c.detail}`),
    '',
    'Units are millimetres. The ring axis is Y. Inner diameter in the file already includes any plating compensation.',
    'Dimensions are nominal: the caster or print service applies its own shrink and finishing allowance.',
  ].join('\n');
}

function ExportModal({ open, onClose, design, name, rows }) {
  const [formats, setFormats] = useState(['stl']);
  const [brief, setBrief] = useState(true);
  const [phase, setPhase] = useState('choose'); // choose | working | done | failed
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [measure, setMeasure] = useState(null); // { tris, verts } of the print mesh, measured when the dialog opens
  const meshRef = useRef(null);

  // Build the print mesh once when the dialog opens, so each format can show its size before
  // anything is generated; "Generate" then reuses it.
  useEffect(() => {
    if (!open) return;
    setPhase('choose');
    setStep(0);
    setMeasure(null);
    let alive = true;
    const t = setTimeout(() => {
      if (!alive) return;
      try {
        meshRef.current?.geometry.dispose();
        const mesh = printMesh(design);
        meshRef.current = mesh;
        const g = mesh.geometry;
        setMeasure({ tris: (g.index ? g.index.count : g.attributes.position.count) / 3, verts: g.attributes.position.count });
      } catch (err) {
        console.error(err);
      }
    }, 60);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open]);
  useEffect(() => () => meshRef.current?.geometry.dispose(), []);
  // Binary STL is exact: 84 bytes of header plus 50 per triangle. OBJ text averages ~31 bytes per vertex line and ~24 per face line.
  const estBytes = (id) => (!measure ? null : id === 'stl' ? 84 + 50 * measure.tris : 31 * measure.verts + 24 * measure.tris);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const size = sizeSummary(design.sizeUS);
  const base = `${slug(name)}_US${size.us.replace('½', '.5').replace('¼', '.25').replace('¾', '.75')}_${design.materialId}`;
  const count = formats.length + (brief ? 1 : 0);
  const STEPS = steps(isPlated(design));

  const start = async () => {
    setPhase('working');
    setStep(0);
    try {
      await nextFrame();
      const mesh = meshRef.current || printMesh(design);
      meshRef.current = null;
      setStep(1);
      await nextFrame();
      const { checks } = runChecks(design, patternById);
      setStep(2);
      await nextFrame();
      setStep(3);
      await nextFrame();
      const out = [];
      if (formats.includes('stl')) out.push([`${base}.stl`, new Blob([new STLExporter().parse(mesh, { binary: true })], { type: 'model/stl' })]);
      if (formats.includes('obj')) out.push([`${base}.obj`, new Blob([new OBJExporter().parse(mesh)], { type: 'model/obj' })]);
      if (brief) out.push([`${base}_maker-brief.txt`, new Blob([makerBrief(name, rows, checks)], { type: 'text/plain' })]);
      mesh.geometry.dispose();
      setStep(STEPS.length);
      const made = out.map(([fname, blob]) => ({ name: fname, size: fmtBytes(blob.size), url: URL.createObjectURL(blob) }));
      setFiles(made);
      setPhase('done');
      chime();
      if (made.length === 1) save(made[0]);
    } catch (err) {
      console.error(err);
      setPhase('failed');
    }
  };

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
            <span class="format-size">${measure ? `≈ ${fmtBytes(estBytes(f.id))} · ${Math.round(measure.tris).toLocaleString('en-US')} triangles` : 'Measuring…'}</span>
          </label>`
        )}
      </fieldset>
      <label class="check-row"><input type="checkbox" checked=${brief} onChange=${() => setBrief(!brief)} />
        Include a maker brief: dimensions, material and the printability report</label>
      <button class="btn primary full" disabled=${!formats.length} onClick=${start}><${Icon} name="download" size=${16} /> Generate ${count} file${count > 1 ? 's' : ''}</button>
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
      ${phase === 'failed' &&
      html`<p class="error-note" role="alert"><${Icon} name="alert" size=${14} /> The files could not be built on this device. Try again, or use a computer.</p>
        <button class="btn primary full" onClick=${start}>Try again</button>`}
      ${phase === 'done' &&
      html`<ul class="file-list" aria-label="Your files">
          ${files.map((f) => html`<li><a href=${f.url} download=${f.name}>
            <${Icon} name="file" size=${16} /><span>${f.name}</span><span class="muted">${f.size}</span><${Icon} name="download" size=${16} />
          </a></li>`)}
        </ul>
        ${files.length > 1 && html`<button class="btn ghost full" onClick=${() => files.forEach((f, i) => setTimeout(() => save(f), i * 400))}><${Icon} name="download" size=${16} /> Download all</button>`}
        <button class="btn primary full" onClick=${onClose}>Done</button>`}
    </div>`}
  <//>`;
}

function save(f) {
  const a = document.createElement('a');
  a.href = f.url;
  a.download = f.name;
  a.click();
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
  const ready = errors === 0;
  // Arriving with every check passed is the end of the job: say so, once.
  useEffect(() => {
    if (ready) announce('Ready to print. Every printability check passes.');
  }, [ready]);
  const pn = (z) => patternById(design.patterns[z])?.name;
  const layout = LAYOUTS[design.layout];
  const hasZ = (z) => layout.zones.some((x) => x.id === z);

  // The card always shows the ring from the default three-quarter view, whatever angle the turntable is at.
  const frontSnapshot = (v) => {
    const pos = v.camera.position.clone();
    v.resetView();
    const png = v.snapshot();
    v.camera.position.copy(pos);
    v.controls?.update();
    return png;
  };
  // Ring card: the sheet as one PNG. Phones get the share sheet; elsewhere it downloads.
  const [cardBusy, setCardBusy] = useState(false);
  const saveCard = async () => {
    if (!viewer.current) return;
    setCardBusy(true);
    try {
      const blob = await ringCard({
        snapshot: frontSnapshot(viewer.current),
        name,
        rows: [['Layout', layout.name], ['Material', m.name], ['Size', `US ${size.us} · Ø ${size.diameter.toFixed(1)}`], ['Finish', design.finish], ['Weight', `≈ ${price.grams.toFixed(1)} g`], ['Est.', money(price.total)]],
        dims: { outer: size.diameter + 2 * design.thickness, width: design.width },
        stamp: ready ? { ok: true, title: 'READY', sub: 'TO PRINT' } : { ok: false, title: `${errors} TO FIX`, sub: 'BEFORE PRINTING' },
      });
      const file = new File([blob], `${(name || 'ring').trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'ring'}-card.png`, { type: 'image/png' });
      if (document.documentElement.dataset.input === 'touch' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name || 'My ring' }).catch(() => {});
      } else {
        const url = URL.createObjectURL(file);
        save({ url, name: file.name });
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast('Ring card saved as a PNG');
      }
    } catch {
      toast('The ring card could not be drawn on this device');
    } finally {
      setCardBusy(false);
    }
  };

  const engr = engravingLayout(design);
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
    engr && ['Inside engraving', `“${engr.text}” · ${engr.font.label} · ${engr.h} mm letters · ${engr.depth} mm deep`],
    ['Weight', `≈ ${price.grams.toFixed(1)} g`],
  ].filter(Boolean);

  return html`<div class="app-shell">
    <${TopBar} />
    <main class="review" id="main">
      <section class="review-hero">
        <div class="review-title">
          <span class="eyebrow">Step 04 · Files</span>
          <h1>${name || 'Untitled ring'}</h1>
        </div>
        <div class="review-ring">
          <span class="reg tl" aria-hidden="true"></span><span class="reg tr" aria-hidden="true"></span>
          <span class="reg bl" aria-hidden="true"></span><span class="reg br" aria-hidden="true"></span>
          <${RingView} design=${design} mode="hero" zoom autoRotate onViewer=${(v) => (viewer.current = v)}
            label="3D ring. Drag to rotate, scroll or use the buttons to zoom." />
          <svg class="lp-dims review-dims" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="22" x2="78" y1="92" y2="92" /><line x1="22" x2="22" y1="89" y2="95" /><line x1="78" x2="78" y1="89" y2="95" />
            <line x1="92" x2="92" y1="22" y2="72" /><line x1="89" x2="95" y1="22" y2="22" /><line x1="89" x2="95" y1="72" y2="72" />
          </svg>
          <span class="lp-dim-label review-dim h">Ø ${(size.diameter + 2 * design.thickness).toFixed(1)} mm</span>
          <span class="lp-dim-label review-dim v">${design.width.toFixed(1)} mm</span>
          <div class="review-zoom" role="group" aria-label="Zoom">
            <button class="icon-btn" onClick=${() => viewer.current?.zoomBy(0.8)} aria-label="Zoom in" title="Zoom in"><${Icon} name="plus" /></button>
            <button class="icon-btn" onClick=${() => viewer.current?.zoomBy(1.25)} aria-label="Zoom out" title="Zoom out"><${Icon} name="minus" /></button>
            <button class="icon-btn" onClick=${() => viewer.current?.resetView()} aria-label="Reset view" title="Reset view"><${Icon} name="reset" /></button>
          </div>
        </div>
        <div class="review-sheet">
          <dl class="title-block review-tb">
            <div><dt>Layout</dt><dd>${layout.name}</dd></div>
            <div><dt>Material</dt><dd>${m.name}</dd></div>
            <div><dt>Size</dt><dd>US ${size.us} · Ø ${size.diameter.toFixed(1)}</dd></div>
            <div><dt>Finish</dt><dd>${design.finish}</dd></div>
            <div><dt>Weight</dt><dd>≈ ${price.grams.toFixed(1)} g</dd></div>
            <div><dt>Est.</dt><dd>${money(price.total)}</dd></div>
          </dl>
          ${ready
            ? html`<p key="ready" class="ready-stamp" aria-hidden="true"><span>Ready</span><span>to print</span></p>`
            : html`<p key=${`todo-${errors}`} class="ready-stamp todo" aria-hidden="true"><span>${errors} to fix</span><span>before printing</span></p>`}
        </div>
        <${BandMap} design=${design} getPattern=${patternById} className="review-band" />
        <div class="review-actions">
          <button class="btn ghost" onClick=${() => go('studio')}><${Icon} name="pen" size=${15} /> Edit design</button>
          <button class="btn ghost" onClick=${copyShareLink}><${Icon} name="share" size=${15} /> Copy share link</button>
          <button class="btn ghost" onClick=${saveCard} disabled=${cardBusy}><${Icon} name="file" size=${15} /> ${cardBusy ? 'Drawing…' : 'Save ring card'}</button>
        </div>
      </section>

      <section class="review-side">
        <div class="card export-card">
          <h2>Print-ready files</h2>
          <p class="muted">STL or OBJ in millimetres, already checked against ${m.name} limits.</p>
          <button class="btn primary full" disabled=${errors > 0} onClick=${() => store.set({ exportOpen: true })}>
            <${Icon} name="download" size=${16} /> Download print files
          </button>
          ${errors > 0 && html`<p class="error-note" role="status"><${Icon} name="alert" size=${14} /> Fix ${errors} printability issue${errors > 1 ? 's' : ''} below first. One click each.</p>`}
          <ol class="next-steps">
            <li><strong>Download</strong> the files.</li>
            <li><strong>Print</strong> at home (PLA or resin), or send them to a casting house.</li>
            <li><strong>Finish</strong> by polishing or plating, then wear it.</li>
          </ol>
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
          <p class="muted small">${price.leadDays ? `A casting house or print service typically takes about ${price.leadDays} days.` : 'Print it yourself today. Plate it later if you like.'} An estimate, not a quote: shipping and tax are not included.</p>
        </div>

        <details class="card spec-card">
          <summary><h2>Full specification</h2><${Icon} name="down" size=${16} /></summary>
          <dl class="spec-sheet">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
        </details>
        <${StepNav} back=${{ to: 'tryon', label: 'Try on' }} />
      </section>
    </main>
    <div class="files-bar">
      <button class="btn primary full" disabled=${errors > 0} onClick=${() => store.set({ exportOpen: true })}>
        <${Icon} name="download" size=${16} /> ${errors > 0 ? `Fix ${errors} check${errors > 1 ? 's' : ''} to download` : 'Download print files'}
      </button>
    </div>
    <${ExportModal} open=${exportOpen} onClose=${() => store.set({ exportOpen: false })} design=${design} name=${name} rows=${rows} />
  </div>`;
}
