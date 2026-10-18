// Fit-to-screen UI scale for the desktop app screens (pure function tested in tests/ui-scale.test.js).
// The studio chrome is drawn at --ui times its normal size, so a small or heavily scaled screen (a 1366×768 laptop,
// Windows at 125–150 %) keeps a big stage for the ring instead of a squeezed one. Phones and tablets keep 1.
export const UI_REF = { w: 1600, h: 860, min: 0.8, desktop: 1024 }; // below 0.8 small labels drop under 10 px

/** Scale for a window of w × h CSS pixels: 1 on big screens, down to UI_REF.min on small ones. */
export function uiScale(w, h) {
  if (w < UI_REF.desktop) return 1;
  const s = Math.min(1, w / UI_REF.w, h / UI_REF.h);
  return Math.round(Math.max(UI_REF.min, s) * 100) / 100;
}

/** Keep --ui on <html> in step with the window size (zooming the browser fires resize too). */
export function watchUiScale(root = document.documentElement) {
  const apply = () => root.style.setProperty('--ui', String(uiScale(innerWidth, innerHeight)));
  apply();
  addEventListener('resize', apply);
  return () => removeEventListener('resize', apply);
}
