import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { TopBar, StepNav } from '../components/topbar.js';
import { Icon, Segmented, Slider } from '../components/ui.js';
import { RingView } from '../components/ring-view.js';
import { Hand, SKIN_TONES, ringAnchor, FULL, closeUp } from '../components/hand.js';
import { MATERIALS, getMaterial } from '../lib/materials.js';
import { bandMetrics } from '../lib/band.js';
import { sizeSummary } from '../lib/sizes.js';
import { store, setDesign } from '../state.js';
import { clink } from '../lib/sound.js';

const FINGERS = [
  { value: 'index', label: 'Index' },
  { value: 'middle', label: 'Middle' },
  { value: 'ring', label: 'Ring' },
  { value: 'pinky', label: 'Little' },
];

function useBox(ref) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return box;
}

export function TryOn() {
  const design = store.use((s) => s.design);
  const t = store.use((s) => s.tryOn);
  const set = (patch) => store.set((s) => ({ tryOn: { ...s.tryOn, ...patch } }));
  const scene = useRef();
  const box = useBox(scene);
  const viewer = useRef();
  const { innerD } = bandMetrics(design);
  const crop = t.close ? closeUp(t.build, t.finger) : FULL;

  // Work out where the ring goes and how big a millimetre is on screen.
  let ring = null;
  if (box.w) {
    if (t.mode === 'illustration') {
      const s = Math.min(box.w / crop.w, box.h / crop.h);
      const ox = (box.w - crop.w * s) / 2, oy = (box.h - crop.h * s) / 2;
      const a = ringAnchor(t.build, t.finger);
      ring = { x: ox + (a.x - crop.x) * s, y: oy + (a.y - crop.y) * s, pxPerMM: (a.width * s * 1.02) / innerD, angle: a.angle };
    } else if (t.photo) {
      ring = { x: t.pos.x * box.w, y: t.pos.y * box.h, pxPerMM: ((box.w * 0.1) / innerD) * t.pos.scale, angle: t.pos.rot };
    }
  }
  useEffect(() => {
    if (ring && viewer.current) viewer.current.setTryOn({ pxPerMM: ring.pxPerMM, angle: (-ring.angle * Math.PI) / 180 });
  });

  const overlaySize = ring ? Math.max(120, innerD * ring.pxPerMM * 3.2) : 0;
  const drag = useRef(null);
  const onDown = (e) => {
    if (t.mode !== 'photo') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, pos: t.pos };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const { x, y, pos } = drag.current;
    set({ pos: { ...pos, x: Math.min(1, Math.max(0, pos.x + (e.clientX - x) / box.w)), y: Math.min(1, Math.max(0, pos.y + (e.clientY - y) / box.h)) } });
  };
  const onUpload = (e) => {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => set({ photo: r.result, mode: 'photo', pos: { x: 0.5, y: 0.45, scale: 1, rot: 0 } });
    r.readAsDataURL(f);
  };
  const size = sizeSummary(design.sizeUS);
  const tone = SKIN_TONES[t.tone];

  return html`<div class="app-shell">
    <${TopBar} />
    <main class="tryon" id="main">
      <section class=${'tryon-scene ' + t.mode} ref=${scene} aria-label=${`Ring shown on a ${t.mode === 'photo' ? 'photo of your hand' : `${tone.name.toLowerCase()} skin tone hand, ${t.finger} finger`}`}>
        ${t.mode === 'illustration' && html`<${Hand} tone=${t.tone} build=${t.build} crop=${crop} />`}
        ${t.mode === 'illustration' &&
        html`<div class="tryon-zoom">
          <${Segmented} label="Zoom" size="sm" value=${t.close ? 'close' : 'hand'} onChange=${(v) => set({ close: v === 'close' })}
            options=${[{ value: 'hand', label: 'Whole hand' }, { value: 'close', label: 'Close-up' }]} />
        </div>`}
        ${t.mode === 'photo' && t.photo && html`<img class="tryon-photo" src=${t.photo} alt="Your uploaded hand photo" />`}
        ${t.mode === 'photo' && !t.photo &&
        html`<label class="upload-drop">
          <${Icon} name="upload" size=${28} />
          <strong>Upload a photo of your hand</strong>
          <span>Back of the hand, fingers up, good light. It stays on your device.</span>
          <input type="file" accept="image/*" onChange=${onUpload} class="sr-only" />
        </label>`}
        ${ring &&
        html`<div class="ring-overlay" style=${`left:${ring.x - overlaySize / 2}px; top:${ring.y - overlaySize / 2}px; width:${overlaySize}px; height:${overlaySize}px`}
          onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${() => (drag.current = null)}>
          <${RingView} design=${design} mode="tryon" onViewer=${(v) => (viewer.current = v)} label="The ring on the hand" />
        </div>`}
        <div class="tryon-badge">
          <strong>US ${size.us}</strong> · Ø ${size.diameter.toFixed(1)} mm · ${design.width} mm wide
        </div>
      </section>

      <aside class="rail tryon-controls" aria-label="Try-on settings">
        <div class="rail-body">
          <h1 class="screen-title">See it on a hand</h1>
          <p class="muted">Check how wide the band looks before you print. Change the material to compare.</p>

          <${Segmented} label="View" size="full" value=${t.mode} onChange=${(v) => set({ mode: v })}
            options=${[{ value: 'illustration', label: 'Illustrated hand' }, { value: 'photo', label: 'My photo' }]} />

          ${t.mode === 'illustration'
            ? html`<span class="field-label">Skin tone</span>
                <div class="tones" role="radiogroup" aria-label="Skin tone">
                  ${SKIN_TONES.map(
                    (s) => html`<button role="radio" aria-checked=${t.tone === s.id} aria-label=${s.name} title=${s.name}
                      class=${'tone' + (t.tone === s.id ? ' on' : '')} style=${`--c:${s.skin}`} onClick=${() => set({ tone: s.id })}></button>`
                  )}
                </div>
                <span class="field-label">Hand</span>
                <${Segmented} label="Hand shape" size="full" value=${t.build} onChange=${(v) => set({ build: v })}
                  options=${[{ value: 'slender', label: 'Slender' }, { value: 'broad', label: 'Broad' }]} />
                <span class="field-label">Finger</span>
                <${Segmented} label="Finger" size="full" value=${t.finger} onChange=${(v) => set({ finger: v })} options=${FINGERS} />`
            : html`<label class="btn ghost full">
                  <${Icon} name="upload" size=${16} /> ${t.photo ? 'Choose another photo' : 'Upload a photo'}
                  <input type="file" accept="image/*" onChange=${onUpload} class="sr-only" />
                </label>
                ${t.photo &&
                html`<p class="hint">Drag the ring onto your finger, then match its size and angle.</p>
                  <${Slider} label="Ring scale" value=${t.pos.scale} min=${0.4} max=${3} step=${0.02} unit="" format=${(v) => `${Math.round(v * 100)}%`}
                    onInput=${(v) => set({ pos: { ...t.pos, scale: v } })} />
                  <${Slider} label="Finger angle" value=${t.pos.rot} min=${-60} max=${60} step=${1} unit="°"
                    onInput=${(v) => set({ pos: { ...t.pos, rot: v } })} />`}`}

          <span class="field-label">Material</span>
          <div class="swatches compact" role="radiogroup" aria-label="Material">
            ${MATERIALS.map(
              (x) => html`<button role="radio" aria-checked=${design.materialId === x.id} class=${'swatch' + (design.materialId === x.id ? ' on' : '')}
                onClick=${() => (x.id !== design.materialId && clink(x.id), setDesign({ materialId: x.id }))} title=${x.name} aria-label=${x.name}>
                <span class="swatch-dot" style=${`--c:${x.color}; --m:${x.metalness}`}></span>
              </button>`
            )}
          </div>
          <p class="muted small">${getMaterial(design.materialId).name}</p>

          <${Slider} label="Band width" value=${design.width} min=${2} max=${12} step=${0.5} onInput=${(v) => setDesign({ width: v })} />
        </div>
        <${StepNav} back=${{ to: 'studio', label: 'Design' }} next=${{ to: 'review', label: 'Review & files' }} />
      </aside>
    </main>
  </div>`;
}
