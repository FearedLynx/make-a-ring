import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { html } from './lib/html.js';
import { store, startTour } from './state.js';
import { Modal, Toast, LiveRegion } from './components/ui.js';
import { SizeFinder } from './components/size-finder.js';
import { PatternEditor } from './components/editor.js';
import { Tour, Tip } from './components/tour.js';
import { Landing } from './screens/landing.js';
import { Start } from './screens/start.js';
import { Studio } from './screens/studio.js';
import { TryOn } from './screens/tryon.js';
import { Review } from './screens/review.js';

const SCREENS = { landing: Landing, start: Start, studio: Studio, tryon: TryOn, review: Review };
const TITLES = { landing: 'Make-a-Ring', start: 'Start · Make-a-Ring', studio: 'Studio · Make-a-Ring', tryon: 'Try on · Make-a-Ring', review: 'Review · Make-a-Ring' };

const SHORTCUTS = [
  ['Studio', [['↑ / ↓', 'Previous / next middle pattern'], ['← / →', 'Previous / next side pattern'], ['L', 'Link or unlink the sides'],
    ['S', 'Switch between left and right side (when unlinked)'], ['D', 'Draw your own pattern'], ['+ / −', 'Zoom the ring'], ['R', 'Reset the 3D view'],
    ['/', 'Search patterns'], ['[ / ]', 'Hide or show the side panels']]],
  ['Pattern editor', [['P L S C D', 'Pen, line, square, circle, dot'], ['V / E', 'Move, eraser'], ['B', 'Steady on / off'],
    ['M / Shift+M', 'Mirror left–right / top–bottom'], ['G / N', 'Show grid / snap to grid'], ['+ / − / 0', 'Zoom in, out, fit'],
    ['Delete', 'Remove the selected strokes'], ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'], ['Arrows + Enter', 'Draw with the keyboard on the canvas'], ['Esc', 'Finish a line']]],
];

function Shortcuts() {
  const open = store.use((s) => s.shortcutsOpen);
  return html`<${Modal} open=${open} onClose=${() => store.set({ shortcutsOpen: false })} title="Keyboard shortcuts">
    ${SHORTCUTS.map(([group, list]) => html`<h3 class="kb-h">${group}</h3>
      <dl class="kb-list">${list.map(([k, v]) => html`<dt><kbd>${k}</kbd></dt><dd>${v}</dd>`)}</dl>`)}
    <button class="btn ghost sm" onClick=${() => {
      store.set({ shortcutsOpen: false });
      if (store.get().screen === 'studio') setTimeout(() => startTour('studio'), 200);
      else location.hash = '#/studio';
    }}>Replay the studio tour</button>
  <//>`;
}

function App() {
  const screen = store.use((s) => s.screen);
  useEffect(() => {
    document.title = TITLES[screen];
  }, [screen]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '?' && !e.target.closest?.('input, textarea')) store.set({ shortcutsOpen: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const Screen = SCREENS[screen] || Landing;
  return html`
    <a class="skip-link" href="#main" onClick=${(e) => {
      e.preventDefault();
      const m = document.getElementById('main');
      m?.setAttribute('tabindex', '-1');
      m?.focus();
    }}>Skip to content</a>
    <${Screen} key=${screen} />
    <${SizeFinder} />
    <${PatternEditor} />
    <${Shortcuts} />
    <${Toast} />
    <${Tip} />
    <${Tour} />
    <${LiveRegion} />
  `;
}

render(html`<${App} />`, document.getElementById('app'));
