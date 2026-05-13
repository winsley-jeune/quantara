// Stage 1 entrypoint: scrape sources → build Excel catalog.
// First version: U.S. Seal Mfg cross-reference PDF only.
// Will fan out to additional sources next.
import { parseUSSealPDF } from '../src/agent/sources/usseal';
import {
  ussealToCatalog,
  writeCatalogExcel,
} from '../src/agent/exports/excelExport';

async function main(): Promise<void> {
  console.log('parsing U.S. Seal cross-reference PDF...');
  const ussealRows = await parseUSSealPDF('data/source-pdfs/us-seal-cross-reference.pdf');
  console.log(`  → ${ussealRows.length} cross-reference rows`);

  const catalog = ussealToCatalog(ussealRows);
  const path = 'data/catalog-stage1.xlsx';
  await writeCatalogExcel(path, catalog);
  console.log(`wrote ${catalog.length} rows to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
