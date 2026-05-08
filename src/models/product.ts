export interface Product {
  source: 'walmart';
  sourceId: string;
  title: string;
  brand: string | null;
  price: {
    amount: number | null;
    currency: string;
    raw: string | null;
  };
  url: string;
  imageUrl: string | null;
  upc: string | null;
  gtin: string | null;
  availability: string | null;
}

export interface RawWalmartItem {
  id: string;
  name: string;
  brand: string | null;
  priceAmount: number | null;
  priceRaw: string | null;
  url: string;
  imageUrl: string | null;
  availability: string | null;
}
