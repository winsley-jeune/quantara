import { BLOCKED_BRANDS } from '../config/walmart';

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const blockedSet = new Set(BLOCKED_BRANDS.map(normalize));

export function isBrandBlocked(brand: string | null | undefined): boolean {
  if (!brand) return false;
  return blockedSet.has(normalize(brand));
}
