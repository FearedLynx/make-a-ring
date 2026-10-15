import { useEffect, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Modal, Segmented, Slider, Icon } from './ui.js';
import { sizeSummary, diameterToUs, usToDiameter, roundUs, fmtUs, US_MIN, US_MAX } from '../lib/sizes.js';
import { store, setDesign, toast } from '../state.js';
import { snap } from '../lib/sound.js';

const UK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const clampUs = (u) => Math.min(US_MAX, Math.max(US_MIN, u));
const DEFAULT_PX = 96 / 25.4; // CSS reference pixel; real screens vary, hence calibration

// Calibration references with a known real-world width.
const REFS = {
  card: { label: 'Bank or ID card', mm: 85.6, help: 'Any credit, debit or ID card. They are all the same size: 85.6 × 54 mm.' },
  ruler: { label: 'Ruler', mm: 50, help: 'A ruler or tape measure. Match the 0 and 5 cm marks.' },
};

const loadCal = () => {
  try {
    const v = JSON.parse(localStorage.getItem('mar.cal') || 'null');
    return v && v.px ? v : { px: DEFAULT_PX, done: false };
  } catch {
    return { px: DEFAULT_PX, done: false };
  }
};

function useWidth(el) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}

export function SizeFinder() {
  const open = store.use((s) => s.sizeFinderOpen);
  const current = store.use((s) => s.design.sizeUS);
  const [tab, setTab] = useState('know');
  const [us, setUs] = useState(current);
  const [system, setSystem] = useState('US');
  const [diam, setDiam] = useState(usToDiameter(current));
  const [circ, setCirc] = useState('');
  const [cal, setCal] = useState(loadCal);
  const [ref, setRef] = useState('card');
  const [wrap, setWrap] = useState(null);
  const wrapW = useWidth(wrap);

  useEffect(() => {
    if (open) {
      setUs(current);
      setDiam(+usToDiameter(current).toFixed(1));
    }
  }, [open]);

  const close = () => store.set({ sizeFinderOpen: false });
  const s = sizeSummary(us);
  const apply = () => {
    setDesign({ sizeUS: roundUs(us) });
    snap();
    close();
    toast(`Size set to US ${fmtUs(roundUs(us))}`);
  };
  const saveCal = (next) => {
    setCal(next);
    try {
      localStorage.setItem('mar.cal', JSON.stringify(next));
    } catch {}
  };

  // The reference outline must always fit inside the dialog.
  const R = REFS[ref];
  const maxPx = wrapW ? Math.max(2.6, (wrapW - 24) / R.mm) : 6;
  const px = Math.min(cal.px, maxPx);
  const tooSmallScreen = wrapW && maxPx < DEFAULT_PX * 0.9;

  return html`<${Modal} open=${open} onClose=${close} title="Find your ring size" className="size-modal">
    <${Segmented} label="Method" size="full" value=${tab} onChange=${setTab}
      options=${[
        { value: 'know', label: 'I know my size' },
        { value: 'finger', label: 'Measure my finger' },
        { value: 'ring', label: 'Measure a ring' },
      ]} />

    ${tab === 'know' &&
    html`<div class="sf-pane">
      <p class="sf-intro">Use this if a jeweller has measured you, or a ring that fits has its size stamped inside. Pick the system it uses:</p>
      <ul class="sf-system-help">
        <li><strong>US / Canada</strong>: numbers like 6, 6½, 7</li>
        <li><strong>EU / ISO</strong>: the inside circumference in millimetres, like 52 or 54</li>
        <li><strong>UK / Australia</strong>: letters like L, M½, N</li>
      </ul>
      <${Segmented} label="Size system" size="sm" value=${system} onChange=${setSystem}
        options=${['US', 'EU', 'UK'].map((x) => ({ value: x, label: x }))} />
      ${system === 'US' &&
      html`<div class="size-chips" role="radiogroup" aria-label="US size">
        ${Array.from({ length: 19 }, (_, i) => 4 + i * 0.5).map(
          (v) => html`<button role="radio" aria-checked=${us === v} class=${'chip' + (us === v ? ' on' : '')} onClick=${() => setUs(v)}>${fmtUs(v)}</button>`
        )}
      </div>`}
      ${system === 'EU' &&
      html`<label class="field">EU / ISO size (inside circumference, mm)
        <input type="number" min="44" max="72" value=${s.eu} onInput=${(e) => {
          const v = parseFloat(e.currentTarget.value);
          if (v >= 40 && v <= 76) setUs(clampUs(diameterToUs(v / Math.PI)));
        }} />
      </label>`}
      ${system === 'UK' &&
      html`<label class="field">UK size
        <select value=${s.uk} onChange=${(e) => {
          const v = e.currentTarget.value;
          const i = UK.indexOf(v[0]) + (v.endsWith('½') ? 0.5 : 0);
          setUs(clampUs(diameterToUs((37.8 + i * 1.25) / Math.PI)));
        }}>
          ${UK.flatMap((l, i) => (i < UK.length - 1 ? [l, l + '½'] : [l])).map((l) => html`<option value=${l}>${l}</option>`)}
        </select>
      </label>`}
    </div>`}

    ${tab === 'finger' &&
    html`<div class="sf-pane">
      <p class="sf-intro">No ring to measure? Measure the finger itself with a strip of paper or string and a ruler.</p>
      <ol class="sf-steps">
        <li><strong>Wrap</strong> the strip around the base of the finger, snug but not tight.</li>
        <li><strong>Mark</strong> where it overlaps, then lay it flat against a ruler.</li>
        <li><strong>Enter</strong> the length below. Measure at the end of the day, when fingers are largest.</li>
      </ol>
      <label class="field">Finger circumference (mm)
        <input type="number" min="40" max="80" step="0.5" placeholder="e.g. 54" value=${circ}
          onInput=${(e) => {
            setCirc(e.currentTarget.value);
            const v = parseFloat(e.currentTarget.value);
            if (v >= 40 && v <= 80) setUs(clampUs(diameterToUs(v / Math.PI)));
          }} />
      </label>
    </div>`}

    ${tab === 'ring' &&
    html`<div class="sf-pane">
      <p class="sf-intro">Have a ring that fits? Lay it on the screen and match its inside edge. Screens differ in size, so calibrate first.</p>

      <section class=${'sf-step' + (cal.done ? ' done' : '')} aria-labelledby="sf-s1">
        <div class="sf-step-h"><span class="sf-step-n">${cal.done ? '✓' : '1'}</span><span id="sf-s1">Calibrate your screen</span></div>
        <${Segmented} label="Calibration reference" size="sm" value=${ref} onChange=${setRef}
          options=${Object.entries(REFS).map(([k, r]) => ({ value: k, label: r.label }))} />
        <p class="hint">${R.help} Hold it against the screen and drag the slider until the outline matches it exactly.</p>
        <div class="sf-ref-wrap" ref=${setWrap}>
          ${ref === 'card'
            ? html`<div class="sf-card" style=${`width:${R.mm * px}px;height:${53.98 * px}px`}>85.6 mm</div>`
            : html`<div class="sf-ruler" style=${`width:${R.mm * px}px`}>
                ${Array.from({ length: 51 }, (_, i) => html`<i style=${`left:${i * px}px;height:${i % 10 === 0 ? 22 : i % 5 === 0 ? 14 : 8}px`}></i>`)}
                <span style="left:0">0</span><span style=${`left:${50 * px}px`}>5 cm</span>
              </div>`}
        </div>
        <${Slider} label="Screen scale" value=${+px.toFixed(2)} min=${2.5} max=${+maxPx.toFixed(2)} step=${0.01} unit="" format=${(v) => `${v.toFixed(2)} px/mm`}
          onInput=${(v) => saveCal({ px: v, done: cal.done })} />
        ${tooSmallScreen && html`<p class="hint">This window is too narrow for a full-size ${R.label.toLowerCase()}. Try the ruler, or widen the window.</p>`}
        <button class=${'btn sm ' + (cal.done ? 'ghost' : 'primary')} onClick=${() => saveCal({ px, done: true })}>
          <${Icon} name="check" size=${14} /> ${cal.done ? 'Calibrated. Save again' : 'It matches'}
        </button>
      </section>

      <section class=${'sf-step' + (cal.done ? '' : ' dim')} aria-labelledby="sf-s2">
        <div class="sf-step-h"><span class="sf-step-n">2</span><span id="sf-s2">Match your ring</span></div>
        ${!cal.done && html`<p class="hint">Finish step 1 first, or the size will be off.</p>`}
        <div class="sf-circle-wrap">
          <div class="sf-circle" style=${`width:${diam * px}px;height:${diam * px}px`}>
            <span>${diam.toFixed(1)} mm</span>
          </div>
        </div>
        <${Slider} label="Inner diameter" value=${diam} min=${13} max=${24} step=${0.1}
          onInput=${(v) => {
            setDiam(v);
            setUs(clampUs(diameterToUs(v)));
          }} />
      </section>
    </div>`}

    <div class="sf-result">
      <div>
        <span class="muted">Your size</span>
        <strong class="size-big">US ${fmtUs(roundUs(us))}</strong>
        <span class="size-alt">EU ${s.eu} · UK ${s.uk} · Ø ${s.diameter.toFixed(1)} mm</span>
      </div>
      <button class="btn primary" onClick=${apply}>Use this size</button>
    </div>
    <p class="hint">Between two sizes? Pick the larger one. Bands wider than 8 mm usually need half a size more.</p>
  <//>`;
}
