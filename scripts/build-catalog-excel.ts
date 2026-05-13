// Stage 1 entrypoint: scrape sources → build Excel catalog.
import { parseUSSealPDF } from '../src/agent/sources/usseal';
import { scrapeInlineSales } from '../src/agent/sources/inlinesales';
import { scrapeBoilerSupplies } from '../src/agent/sources/boilersupplies';
import { scrapeVulcanSeals } from '../src/agent/sources/vulcanseals';
import { scrapeJacksonSystems } from '../src/agent/sources/jacksonsystems';
import { scrapePEXUniverse } from '../src/agent/sources/pexuniverse';
import {
  ussealToCatalog,
  inlinesalesToCatalog,
  boilersuppliesToCatalog,
  vulcanToCatalog,
  jacksonsystemsToCatalog,
  pexToCatalog,
  dedupeCatalog,
  writeCatalogExcel,
  type CatalogRow,
} from '../src/agent/exports/excelExport';

async function main(): Promise<void> {
  const all: CatalogRow[] = [];

  console.log('parsing U.S. Seal cross-reference PDF...');
  const usseal = await parseUSSealPDF('data/source-pdfs/us-seal-cross-reference.pdf');
  console.log(`  → ${usseal.length} rows`);
  all.push(...ussealToCatalog(usseal));

  try {
    console.log('scraping InlineSales sitemap...');
    const inline = await scrapeInlineSales();
    console.log(`  → ${inline.length} rows`);
    all.push(...inlinesalesToCatalog(inline));
  } catch (err) {
    console.warn('  inlinesales failed:', (err as Error).message);
  }

  try {
    console.log('scraping BoilerSupplies sitemap...');
    const boiler = await scrapeBoilerSupplies();
    console.log(`  → ${boiler.length} rows`);
    all.push(...boilersuppliesToCatalog(boiler));
  } catch (err) {
    console.warn('  boilersupplies failed:', (err as Error).message);
  }

  try {
    console.log('scraping Vulcan Seals sitemap...');
    const vulcan = await scrapeVulcanSeals();
    console.log(`  → ${vulcan.length} rows`);
    all.push(...vulcanToCatalog(vulcan));
  } catch (err) {
    console.warn('  vulcanseals failed:', (err as Error).message);
  }

  try {
    console.log('scraping Jackson Systems sitemaps (HVAC controls)...');
    const jackson = await scrapeJacksonSystems();
    console.log(`  → ${jackson.length} rows`);
    all.push(...jacksonsystemsToCatalog(jackson));
  } catch (err) {
    console.warn('  jacksonsystems failed:', (err as Error).message);
  }

  try {
    console.log('scraping PEXUniverse sitemap (pump + HVAC)...');
    const pex = await scrapePEXUniverse();
    console.log(`  → ${pex.length} rows`);
    all.push(...pexToCatalog(pex));
  } catch (err) {
    console.warn('  pexuniverse failed:', (err as Error).message);
  }

  console.log(`\nraw rows: ${all.length}`);
  const deduped = dedupeCatalog(all);
  console.log(`unique SKUs after dedupe: ${deduped.length}`);

  const path = 'data/catalog-stage1.xlsx';
  await writeCatalogExcel(path, deduped);
  console.log(`wrote → ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
