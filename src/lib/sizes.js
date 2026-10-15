// Ring size conversions (approximate, based on the common US/ISO/UK charts).

export const US_MIN = 3;
export const US_MAX = 14;

export const usToDiameter = (us) => 11.63 + 0.8128 * us;
export const diameterToUs = (d) => (d - 11.63) / 0.8128;
export const usToCircumference = (us) => Math.PI * usToDiameter(us);

const UK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function ukSize(us) {
  const idx = (usToCircumference(us) - 37.8) / 1.25;
  const i = Math.max(0, Math.min(UK.length - 1, Math.floor(idx)));
  return UK[i] + (idx - Math.floor(idx) >= 0.5 && i < UK.length - 1 ? '½' : '');
}

export const euSize = (us) => Math.round(usToCircumference(us));

export const roundUs = (us, step = 0.25) => Math.round(us / step) * step;

export function fmtUs(us) {
  const whole = Math.floor(us);
  const frac = us - whole;
  const map = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };
  return `${whole}${map[Math.round(frac * 4) / 4] ?? ''}`;
}

export function sizeSummary(us) {
  return {
    us: fmtUs(us),
    eu: euSize(us),
    uk: ukSize(us),
    diameter: usToDiameter(us),
    circumference: usToCircumference(us),
  };
}
