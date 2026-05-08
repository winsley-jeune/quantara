import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { isBrandBlocked } from '../services/brandFilter';

test('blocks Walmart house brands case-insensitively', () => {
  assert.equal(isBrandBlocked('Mainstays'), true);
  assert.equal(isBrandBlocked('mainstays'), true);
  assert.equal(isBrandBlocked('MAINSTAYS'), true);
  assert.equal(isBrandBlocked('Hyper Tough'), true);
  assert.equal(isBrandBlocked('HyperTough'), true); // normalized: spaces stripped
});

test('blocks brand-registry-gated brands', () => {
  assert.equal(isBrandBlocked('Apple'), true);
  assert.equal(isBrandBlocked('YETI'), true);
  assert.equal(isBrandBlocked('Hydro Flask'), true);
  assert.equal(isBrandBlocked('hydroflask'), true);
});

test('handles punctuation variants', () => {
  // "Onn." vs "Onn" vs "ONN" all normalize to "onn"
  assert.equal(isBrandBlocked('Onn.'), true);
  assert.equal(isBrandBlocked('ONN'), true);
  assert.equal(isBrandBlocked('Pen+Gear'), true);
  assert.equal(isBrandBlocked('Pen Gear'), true);
  assert.equal(isBrandBlocked("Sam's Choice"), true);
});

test('does not block unrelated brands', () => {
  assert.equal(isBrandBlocked('Mind Reader'), false);
  assert.equal(isBrandBlocked('Pendaflex'), false);
  assert.equal(isBrandBlocked('Mammoth'), false);
  assert.equal(isBrandBlocked(''), false);
  assert.equal(isBrandBlocked(null), false);
  assert.equal(isBrandBlocked(undefined), false);
});
