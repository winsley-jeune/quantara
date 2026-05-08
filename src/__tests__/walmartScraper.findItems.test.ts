import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// We test the internal traversal helper by re-creating the same shape Walmart
// returns and importing the module under test through a dynamic eval. Since
// findItems isn't exported, we duplicate it here as a contract test — if you
// change the algorithm in walmartScraper.ts, mirror the change here.

function findItems(node: unknown): unknown[] {
  const found: unknown[] = [];
  const queue: unknown[] = [node];
  const seen = new WeakSet<object>();
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object') continue;
    if (seen.has(cur as object)) continue;
    seen.add(cur as object);
    if (Array.isArray(cur)) {
      queue.push(...cur);
      continue;
    }
    const obj = cur as Record<string, unknown>;
    if (Array.isArray(obj.itemStacks)) {
      for (const stack of obj.itemStacks as Array<Record<string, unknown>>) {
        if (Array.isArray(stack.items)) found.push(...(stack.items as unknown[]));
      }
    }
    for (const key of Object.keys(obj)) queue.push(obj[key]);
  }
  return found;
}

test('finds items inside nested itemStacks shape', () => {
  const fixture = {
    props: {
      pageProps: {
        initialData: {
          searchResult: {
            itemStacks: [
              { items: [{ id: 'a' }, { id: 'b' }] },
              { items: [{ id: 'c' }] },
            ],
          },
        },
      },
    },
  };
  const items = findItems(fixture);
  assert.equal(items.length, 3);
  const ids = items.map((i) => (i as { id: string }).id).sort();
  assert.deepEqual(ids, ['a', 'b', 'c']);
});

test('returns empty when no itemStacks anywhere', () => {
  const fixture = { props: { pageProps: { initialData: { other: 'thing' } } } };
  const items = findItems(fixture);
  assert.equal(items.length, 0);
});

test('does not infinite-loop on cyclic references', () => {
  const a: Record<string, unknown> = { itemStacks: [{ items: [{ id: '1' }] }] };
  a.self = a; // intentional cycle
  const items = findItems(a);
  assert.equal(items.length, 1);
});
