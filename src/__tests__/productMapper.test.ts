import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { toProduct } from '../services/productMapper';

test('maps a fully-populated raw item', () => {
  const product = toProduct(
    {
      id: '12345',
      name: 'Some Cereal Box',
      brand: 'Post',
      priceAmount: 4.44,
      priceRaw: '$4.44',
      url: 'https://www.walmart.com/ip/Some-Cereal/12345',
      imageUrl: 'https://i5.walmartimages.com/x.jpg',
      availability: 'In stock',
    },
    { upc: '884912449641', gtin: null },
  );
  assert.equal(product.source, 'walmart');
  assert.equal(product.sourceId, '12345');
  assert.equal(product.title, 'Some Cereal Box');
  assert.equal(product.brand, 'Post');
  assert.equal(product.price.amount, 4.44);
  assert.equal(product.price.currency, 'USD');
  assert.equal(product.price.raw, '$4.44');
  assert.equal(product.upc, '884912449641');
  assert.equal(product.gtin, null);
  assert.equal(product.availability, 'In stock');
});

test('preserves nulls when fields are missing', () => {
  const product = toProduct(
    {
      id: '99',
      name: 'Anonymous',
      brand: null,
      priceAmount: null,
      priceRaw: null,
      url: 'https://www.walmart.com/ip/99',
      imageUrl: null,
      availability: null,
    },
    { upc: null, gtin: null },
  );
  assert.equal(product.brand, null);
  assert.equal(product.price.amount, null);
  assert.equal(product.upc, null);
});
