// Run with: node --test tests/mandrel.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MANDREL, diameterMm, ringY, coneHalfWidthAt, ringEllipse, ticks } from '../src/lib/mandrel.js';

test('US 10 is about 19.8 mm, matching the size table', () => {
  assert.ok(Math.abs(diameterMm(10) - 19.76) < 0.05);
});

test('bigger sizes sit lower on the cone', () => {
  let prev = -Infinity;
  for (let us = 3.5; us <= 13.5; us += 0.25) {
    const y = ringY(us);
    assert.ok(y > prev, `US ${us} should be below US ${us - 0.25}`);
    prev = y;
  }
});

test('US 10 lands between the 9½ and 10½ ticks', () => {
  const y = ringY(10);
  assert.ok(y > ringY(9.5) && y < ringY(10.5));
  const tick = ticks().find((t) => t.us === 10);
  assert.equal(tick.y, y);
});

test('the range endpoints stay inside the drawn cone', () => {
  const top = ringY(MANDREL.usMin), bottom = ringY(MANDREL.usMax);
  assert.equal(top, MANDREL.yTop);
  assert.equal(bottom, MANDREL.yTop + MANDREL.coneHeight);
  assert.ok(ringY(4) > top && ringY(13) < bottom, 'sizes 4 and 13 are not on the very edges');
});

test('the cone widens downwards with an exaggerated taper', () => {
  const ratio = coneHalfWidthAt(MANDREL.yTop + MANDREL.coneHeight) / coneHalfWidthAt(MANDREL.yTop);
  assert.ok(ratio >= 2.5 && ratio <= 3, `taper ratio ${ratio}`);
});

test('the ring ellipse hugs the cone and is seen from slightly above', () => {
  for (const us of [4, 7.5, 10, 13]) {
    const e = ringEllipse(us);
    const half = coneHalfWidthAt(e.cy);
    assert.ok(e.rx > half && e.rx < half + 4, `rx just outside the cone at US ${us}`);
    assert.ok(Math.abs(e.ry / e.rx - 0.22) < 1e-9);
    assert.equal(e.cx, MANDREL.cx);
  }
});

test('ticks: 10 whole sizes with labels, 9 half sizes', () => {
  const t = ticks();
  assert.equal(t.filter((x) => x.whole).length, 10);
  assert.equal(t.filter((x) => !x.whole).length, 9);
});
