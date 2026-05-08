import type { Product, RawWalmartItem } from '../models/product';

export function toProduct(
  raw: RawWalmartItem,
  identifiers: { upc: string | null; gtin: string | null },
): Product {
  return {
    source: 'walmart',
    sourceId: raw.id,
    title: raw.name,
    brand: raw.brand,
    price: {
      amount: raw.priceAmount,
      currency: 'USD',
      raw: raw.priceRaw,
    },
    url: raw.url,
    imageUrl: raw.imageUrl,
    upc: identifiers.upc,
    gtin: identifiers.gtin,
    availability: raw.availability,
  };
}
