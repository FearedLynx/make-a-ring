// Run with: node --test tests/ui-scale.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uiScale, UI_REF } from '../src/lib/ui-scale.js';

test('big screens and phones are not scaled', () => {
  assert.equal(uiScale(1920, 960), 1);
  assert.equal(uiScale(2560, 1300), 1);
  assert.equal(uiScale(800, 500), 1, 'below the desktop layout');
  assert.equal(uiScale(390, 800), 1);
});

test('small or zoomed desktops scale down, never below the floor', () => {
  const laptop = uiScale(1366, 650);
  assert.ok(laptop < 1 && laptop >= UI_REF.min);
  assert.equal(uiScale(1100, 560), UI_REF.min);
  assert.ok(uiScale(1536, 730) > uiScale(1280, 620), 'more room, larger UI');
});
