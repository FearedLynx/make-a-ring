import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon, Logo } from './ui.js';
import { store, go, toast, shareUrl, THEMES, setTheme, startTour, setGrid, saveDesign, currentSavedEntry, hasUnsavedChanges } from '../state.js';

/**
 * Save to My designs. Editing one of your saved designs: "Save" updates it and "Save as new" forks a copy.
 * Anything else (a template, a shared ring, a blank band) is saved as a new design, so built-ins never change.
 */
function SaveControl() {
  const s = store.use((st) => st);
  const entry = currentSavedEntry(s);
  const dirty = hasUnsavedChanges(s);
  return html`<div class="save-ctl" role="group" aria-label="Save design">
    <button class=${'btn sm save-btn' + (dirty ? ' dirty' : '')} onClick=${() => saveDesign()} disabled=${!!entry && !dirty}
      title=${entry ? (dirty ? `Update “${entry.name}” in My designs` : 'All changes saved') : 'Save to My designs'}>
      <${Icon} name=${!dirty ? 'check' : 'save'} size=${14} /><span>${entry ? (dirty ? 'Save' : 'Saved') : 'Save'}</span>
    </button>
    ${entry && html`<button class="btn sm ghost save-new" onClick=${() => saveDesign({ asNew: true })} title="Save as a new design" aria-label="Save as new design">
      <${Icon} name="plus" size=${14} /><span>As new</span>
    </button>`}
  </div>`;
}

const STEPS = [
  { id: 'studio', label: 'Design' },
  { id: 'tryon', label: 'Try on' },
  { id: 'review', label: 'Review & files' },
];

export async function copyShareLink() {
  const url = shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast('Share link copied. Anyone with it can open this design');
  } catch {
    window.prompt('Copy this link to share your design', url);
  }
}

export function ThemeDots({ className = '' }) {
  const theme = store.use((s) => s.theme);
  return html`<div class=${'theme-dots ' + className} role="radiogroup" aria-label="Colour theme">
    ${THEMES.map(
      (t) => html`<button role="radio" aria-checked=${theme === t.id} aria-label=${`${t.name} theme`} title=${`${t.name} theme`}
        class=${'theme-dot' + (theme === t.id ? ' on' : '')} style=${`--sw:${t.swatch}; --swbg:${t.bg}`}
        onClick=${() => setTheme(t.id)}></button>`
    )}
  </div>`;
}

/** Shows or hides the drafting grid behind the stage, landing and editor. */
export function GridToggle() {
  const grid = store.use((s) => s.grid);
  return html`<button class=${'grid-toggle' + (grid ? '' : ' off')} aria-pressed=${grid} onClick=${() => setGrid(!grid)}
    aria-label=${grid ? 'Hide background grid' : 'Show background grid'} title=${grid ? 'Hide grid' : 'Show grid'}>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <defs><clipPath id="gt-clip"><circle cx="12" cy="12" r="9.2" /></clipPath></defs>
      <circle cx="12" cy="12" r="10" fill="var(--surface)" stroke="currentColor" stroke-width="1.4" />
      <g clip-path="url(#gt-clip)" stroke="currentColor" stroke-width="1" opacity=".75">
        <path d="M2 7.5h20M2 12h20M2 16.5h20M7.5 2v20M12 2v20M16.5 2v20" />
      </g>
      <line class="gt-strike" x1="4.6" y1="19.4" x2="19.4" y2="4.6" />
    </svg>
  </button>`;
}

function HelpMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const screen = store.use((s) => s.screen);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const item = (label, icon, run) => html`<button role="menuitem" onClick=${() => (setOpen(false), run())}><${Icon} name=${icon} size=${15} />${label}</button>`;
  return html`<div class="help-menu" ref=${ref}>
    <button class="icon-btn" aria-haspopup="menu" aria-expanded=${open} aria-label="Help" title="Help" onClick=${() => setOpen(!open)}><${Icon} name="help" /></button>
    ${open &&
    html`<div class="menu" role="menu" onKeyDown=${(e) => e.key === 'Escape' && setOpen(false)}>
      ${screen === 'studio' && item('Replay studio tour', 'sparkle', () => startTour('studio'))}
      ${item('Keyboard shortcuts', 'keyboard', () => store.set({ shortcutsOpen: true }))}
      ${item('Pattern editor tour', 'pen', () => {
        if (store.get().screen !== 'studio') go('studio');
        store.set({ editor: { zone: 'middle' } });
        setTimeout(() => startTour('editor'), 500);
      })}
    </div>`}
  </div>`;
}

export function TopBar() {
  const screen = store.use((s) => s.screen);
  const name = store.use((s) => s.ringName);
  const idx = STEPS.findIndex((s) => s.id === screen);
  return html`<header class="topbar">
    <${Logo} />
    <nav class="steps" aria-label="Design steps">
      <ol>
        ${STEPS.map(
          (s, i) => html`<li>
            <a href=${`#/${s.id}`} class=${(s.id === screen ? 'on' : '') + (i < idx ? ' done' : '')} aria-current=${s.id === screen ? 'step' : undefined}>
              <span class="step-n">${i < idx ? html`<${Icon} name="check" size=${12} />` : String(i + 1).padStart(2, '0')}</span><span class="step-label">${s.label}</span>
            </a>
          </li>`
        )}
      </ol>
    </nav>
    <div class="topbar-right">
      <label class="ring-name">
        <span class="sr-only">Ring name</span>
        <input value=${name} onInput=${(e) => store.set({ ringName: e.currentTarget.value })} maxlength="40" />
        <${Icon} name="pen" size=${13} />
      </label>
      <${SaveControl} />
      <div class="view-prefs"><${ThemeDots} /><${GridToggle} /></div>
      <${HelpMenu} />
      <button class="btn ghost sm share-btn" onClick=${copyShareLink} aria-label="Copy share link"><${Icon} name="share" size=${15} /><span>Share</span></button>
    </div>
  </header>`;
}

export function StepNav({ back, next }) {
  return html`<div class="step-nav">
    ${back && html`<button class="btn ghost" onClick=${() => go(back.to)}><${Icon} name="left" size=${16} /> ${back.label}</button>`}
    <div class="spacer"></div>
    ${next && html`<button class="btn primary" onClick=${() => go(next.to)}>${next.label} <${Icon} name="right" size=${16} /></button>`}
  </div>`;
}
