// Small interface sounds, synthesised with Web Audio (no audio files). Every sound pairs with a visible change,
// so nothing is lost with sound off. Quiet by design; muted with the speaker toggle (remembered in localStorage).
// The audio context is only created on the first sound, which always follows a click or key press.

const KEY = 'mar.sound';
let on = true;
try {
  on = localStorage.getItem(KEY) !== 'off';
} catch {}

let ctx = null, master = null, noiseBuf = null;
function audio() {
  if (!on || document.hidden) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export const soundOn = () => on;
export function setSound(v) {
  on = !!v;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {}
}

/** One decaying sine partial. */
function partial(c, t, freq, gain, decay, out = master) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + decay + 0.02);
}

/** A short burst of filtered noise: the body of clicks, ticks and snaps. */
function noise(c, t, { freq = 3000, q = 1.2, gain = 0.3, decay = 0.03, type = 'bandpass' } = {}) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf;
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.4);
  src.stop(t + decay + 0.02);
}

// How each material rings when tapped: base pitch, ring-out time, brightness. Partials follow a struck metal bar
// (inharmonic 1 : 2.76 : 5.40), which is what makes it read as metal rather than a beep.
const VOICES = {
  silver: { f: 2650, decay: 0.75, bright: 1 },
  'gold-white': { f: 2450, decay: 0.7, bright: 0.9 },
  'gold-yellow': { f: 2050, decay: 0.85, bright: 0.65 },
  'gold-rose': { f: 1950, decay: 0.8, bright: 0.6 },
  titanium: { f: 2900, decay: 0.45, bright: 0.8 },
  steel: { f: 2750, decay: 0.55, bright: 0.85 },
  brass: { f: 1750, decay: 0.6, bright: 0.7 },
  resin: { plastic: true, f: 1150, decay: 0.07 },
  pla: { plastic: true, f: 950, decay: 0.06 },
  tpu: { plastic: true, f: 520, decay: 0.05 },
};

/** Material changed: a clink for metals (gold warmer and lower, silver brighter), a dull tock for prints. */
export function clink(materialId) {
  const c = audio();
  if (!c) return;
  const v = VOICES[materialId] || VOICES.silver;
  const t = c.currentTime + 0.005;
  if (v.plastic) {
    partial(c, t, v.f, 0.32, v.decay);
    noise(c, t, { freq: v.f * 1.6, q: 2, gain: 0.18, decay: 0.025 });
    return;
  }
  noise(c, t, { freq: 6000, q: 0.8, gain: 0.12, decay: 0.012 }); // the tap itself
  partial(c, t, v.f, 0.22, v.decay);
  partial(c, t, v.f * 2.76, 0.1 * v.bright, v.decay * 0.55);
  partial(c, t, v.f * 5.4, 0.05 * v.bright, v.decay * 0.3);
  // a second, quieter touch a moment later: two rings meeting, not a bell
  partial(c, t + 0.075, v.f * 1.004, 0.08, v.decay * 0.6);
}

let lastTick = 0;
/** Measuring tape running out to a new size: a ratchet of ticks (more for a bigger jump), then it locks. */
export function tape(fromUS, toUS) {
  const c = audio();
  if (!c) return;
  const steps = Math.round(Math.min(12, Math.max(3, Math.abs(toUS - fromUS) * 4)));
  const up = toUS >= fromUS;
  let t = c.currentTime + 0.005;
  for (let i = 0; i < steps; i++) {
    const k = i / Math.max(1, steps - 1);
    noise(c, t, { freq: (up ? 2600 : 3400) + (up ? 900 : -900) * k, q: 6, gain: 0.16, decay: 0.014 });
    t += 0.026 + 0.022 * k * k; // fast at first, slowing into the mark
  }
  snapAt(c, t + 0.02);
}

/** One ratchet tick while dragging the size slider (throttled). */
export function tick() {
  const c = audio();
  if (!c) return;
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;
  noise(c, c.currentTime + 0.002, { freq: 3200, q: 6, gain: 0.12, decay: 0.012 });
}

function snapAt(c, t) {
  noise(c, t, { freq: 1800, q: 1.4, gain: 0.32, decay: 0.035 });
  partial(c, t, 220, 0.16, 0.06);
}
/** A size picked for good: a soft snap. */
export function snap() {
  const c = audio();
  if (c) snapAt(c, c.currentTime + 0.005);
}

/** Files are ready: a small rising chime (E6, B6, E7). */
export function chime() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.01;
  [1318.5, 1975.5, 2637].forEach((f, i) => {
    partial(c, t + i * 0.09, f, 0.13, 1.1 - i * 0.2);
    partial(c, t + i * 0.09, f * 2, 0.025, 0.4);
  });
}

/** A side panel opens or closes: one soft click, a little higher for opening. */
export function panel(open) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.004;
  noise(c, t, { freq: open ? 2400 : 1700, q: 2.5, gain: 0.14, decay: 0.02 });
  partial(c, t, open ? 520 : 400, 0.06, 0.04);
}

/** Saved to My designs: a low stamp thunk. */
export function stamp() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.005;
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.18);
  noise(c, t, { freq: 900, q: 0.9, gain: 0.22, decay: 0.05, type: 'lowpass' });
}

let lastEngrave = 0;
/** Typing engraving letters: a couple of fine engraver taps on metal per keystroke. */
export function engrave() {
  const c = audio();
  if (!c) return;
  const now = performance.now();
  if (now - lastEngrave < 60) return;
  lastEngrave = now;
  const t = c.currentTime + 0.003;
  for (let i = 0; i < 2; i++) {
    const f = 4200 + Math.random() * 900;
    noise(c, t + i * 0.035, { freq: f, q: 9, gain: 0.1, decay: 0.012 });
    partial(c, t + i * 0.035, f * 0.7, 0.025, 0.09);
  }
}
