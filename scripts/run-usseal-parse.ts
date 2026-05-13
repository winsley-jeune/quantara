// Run the U.S. Seal PDF parser and dump stats + first/last rows so we can
// eyeball the extraction quality before scaling out.
import { parseUSSealPDF } from '../src/agent/sources/usseal';

async function main(): Promise<void> {
  const rows = await parseUSSealPDF('data/source-pdfs/us-seal-cross-reference.pdf');
  console.log('total rows:', rows.length);

  const brands = new Map<string, number>();
  for (const r of rows) brands.set(r.oem_brand, (brands.get(r.oem_brand) ?? 0) + 1);
  const topBrands = [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log('top 25 brands by row count:');
  for (const [b, c] of topBrands) console.log(`  ${c.toString().padStart(5)}  ${b}`);

  console.log('\nfirst 8 rows:');
  for (const r of rows.slice(0, 8)) {
    console.log(`  ${r.oem_brand} | OEM=${r.oem_part_number} | US Seal=${r.us_seal_part_number}`);
  }

  console.log('\nlast 5 rows:');
  for (const r of rows.slice(-5)) {
    console.log(`  ${r.oem_brand} | OEM=${r.oem_part_number} | US Seal=${r.us_seal_part_number}`);
  }

  const uniqueUSSeal = new Set(rows.map((r) => r.us_seal_part_number));
  const uniqueOEM = new Set(rows.map((r) => r.oem_part_number));
  console.log('\nunique U.S. Seal parts:', uniqueUSSeal.size);
  console.log('unique OEM parts:', uniqueOEM.size);
  console.log('unique brands:', brands.size);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
