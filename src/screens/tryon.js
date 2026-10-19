import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { TopBar, StepNav } from '../components/topbar.js';
import { Icon, Segmented, Slider } from '../components/ui.js';
import { RingView } from '../components/ring-view.js';
import { MaterialPicker } from '../components/specs.js';
import { Hand, SKIN_TONES, ringAnchor, FULL, closeUp } from '../components/hand.js';
import { bandMetrics } from '../lib/band.js';
import { sizeSummary } from '../lib/sizes.js';
import { store, setDesign, toast } from '../state.js';

const FINGERS = [
  { value: 'index', label: 'Index' },
  { value: 'middle', label: 'Middle' },
  { value: 'ring', label: 'Ring' },
  { value: 'pinky', label: 'Little' },
];

const touch = () => document.documentElement.dataset.input === 'touch';

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
  const usePhoto = (photo) => set({ photo, mode: 'photo', pos: { x: 0.5, y: 0.45, scale: 1, rot: 0 } });
  const onUpload = (e) => {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => usePhoto(r.result);
    r.readAsDataURL(f);
  };

  // Taking a photo: phones and tablets open their own camera app through a file input (full resolution, either
  // camera); desktops show the webcam live in the scene. Either way the photo never leaves the device.
  const [cam, setCam] = useState(null); // the webcam stream while the live view is open
  const video = useRef();
  const shutter = useRef();
  const camInput = useRef();
  const takePhoto = async () => {
    if (touch()) return camInput.current.click();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 } }, audio: false });
      set({ mode: 'photo' });
      setCam(stream);
    } catch (err) {
      toast(err.name === 'NotAllowedError' ? 'Camera access is blocked. Allow it from the address bar, or upload a photo.' : 'No camera available. Upload a photo instead.');
    }
  };
  useEffect(() => {
    if (!cam) return;
    video.current.srcObject = cam;
    shutter.current?.focus();
    return () => cam.getTracks().forEach((tr) => tr.stop()); // closing, switching view or leaving turns the camera off
  }, [cam]);
  const snap = () => {
    const v = video.current;
    if (!v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext('2d');
    g.translate(c.width, 0);
    g.scale(-1, 1); // keep the mirrored view the person saw
    g.drawImage(v, 0, 0);
    usePhoto(c.toDataURL('image/jpeg', 0.9));
    setCam(null);
  };
  const onCamKey = (e) => {
    if (e.key === 'Escape') (e.stopPropagation(), setCam(null));
    if (e.key === ' ' && e.target === e.currentTarget) (e.preventDefault(), snap());
  };
  const photoButtons = (cls) => html`<button class=${cls} onClick=${takePhoto}><${Icon} name="camera" size=${16} /> Take a photo</button>
    <label class=${cls.replace('primary', 'ghost')}><${Icon} name="upload" size=${16} /> Upload a photo
      <input type="file" accept="image/*" onChange=${onUpload} class="sr-only" /></label>`;
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
        ${t.mode === 'photo' && t.photo && !cam && html`<img class="tryon-photo" src=${t.photo} alt="Your hand photo" />`}
        ${t.mode === 'photo' && !t.photo && !cam &&
        html`<div class="upload-drop">
          <${Icon} name="camera" size=${28} />
          <strong>Add a photo of your hand</strong>
          <span>Back of the hand, fingers up, good light. It stays on your device.</span>
          <div class="upload-actions">${photoButtons('btn primary')}</div>
        </div>`}
        ${cam &&
        html`<div class="tryon-cam" tabindex="-1" onKeyDown=${onCamKey}>
          <video ref=${video} autoplay playsinline muted aria-label="Camera preview"></video>
          <p class="cam-tip">Back of the hand, fingers up</p>
          <div class="cam-bar">
            <button class="btn ghost" onClick=${() => setCam(null)}>Cancel</button>
            <button class="cam-shutter" ref=${shutter} onClick=${snap} aria-label="Take the photo" title="Take the photo (Space)"></button>
          </div>
        </div>`}
        ${ring && !cam &&
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

          <${Segmented} label="View" size="full" value=${t.mode} onChange=${(v) => (setCam(null), set({ mode: v }))}
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
            : html`<div class="photo-actions">${photoButtons('btn ghost')}</div>
                ${t.photo && !cam &&
                html`<p class="hint">Drag the ring onto your finger, then match its size and angle.</p>
                  <${Slider} label="Ring scale" value=${t.pos.scale} min=${0.4} max=${3} step=${0.02} unit="" format=${(v) => `${Math.round(v * 100)}%`}
                    onInput=${(v) => set({ pos: { ...t.pos, scale: v } })} />
                  <${Slider} label="Finger angle" value=${t.pos.rot} min=${-60} max=${60} step=${1} unit="°"
                    onInput=${(v) => set({ pos: { ...t.pos, rot: v } })} />`}`}

          <div class="tryon-materials"><${MaterialPicker} design=${design} /></div>

          <${Slider} label="Band width" value=${design.width} min=${2} max=${12} step=${0.5} onInput=${(v) => setDesign({ width: v })} />
        </div>
        <${StepNav} back=${{ to: 'studio', label: 'Design' }} next=${{ to: 'review', label: 'Files' }} />
      </aside>
    </main>
    <input ref=${camInput} type="file" accept="image/*" capture="environment" onChange=${onUpload} class="sr-only" tabindex="-1" aria-hidden="true" />
  </div>`;
}
