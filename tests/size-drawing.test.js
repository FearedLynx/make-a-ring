// Run with: node --test tests/size-drawing.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRAW, innerRadius, outerRadius, annulus, circle, diaLabel } from '../src/lib/size-drawing.js';
import { usToDiameter } from '../src/lib/sizes.js';

test('the inner contour is the real diameter, enlarged by the drawing scale', () => {
  for (const us of [4, 7.5, 13]) assert.ok(Math.abs(innerRadius(us) * 2 - usToDiameter(us) * DRAW.scale) < 1e-9);
  assert.equal(outerRadius(8) - innerRadius(8), DRAW.wallMm * DRAW.scale);
});

test('bigger sizes draw bigger, and the range is clamped', () => {
  let prev = 0;
  for (let us = DRAW.min; us <= DRAW.max; us += 0.5) {
    assert.ok(innerRadius(us) > prev);
    prev = innerRadius(us);
  }
  assert.equal(innerRadius(2), innerRadius(DRAW.min));
  assert.equal(innerRadius(20), innerRadius(DRAW.max));
});

test('the biggest ring stays on the sheet, below the header rule', () => {
  const r = outerRadius(DRAW.max);
  assert.ok(DRAW.cx - r > 0 && DRAW.cx + r < DRAW.w);
  assert.ok(DRAW.cy - r > 28, 'clears the header rule');
  assert.ok(DRAW.cy + r < DRAW.h);
});

test('paths and labels', () => {
  assert.equal((annulus(10, 20).match(/M/g) || []).length, 2, 'outer circle plus the hole');
  assert.ok(circle(10).startsWith(`M${DRAW.cx - 10} ${DRAW.cy}`));
  assert.equal(diaLabel(8), 'Ø 18.1');
});
