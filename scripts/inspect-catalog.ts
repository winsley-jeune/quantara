// Quick stats on the built catalog Excel for spot-check.
import ExcelJS from 'exceljs';

async function main(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('data/catalog-stage1.xlsx');
  const ws = wb.getWorksheet('Catalog');
  if (!ws) throw new Error('no Catalog sheet');
  console.log('rows in Catalog (incl header):', ws.rowCount);

  const brands = wb.getWorksheet('Brands');
  if (brands) {
    console.log('\ntop 20 brands:');
    for (let i = 2; i <= Math.min(22, brands.rowCount); i++) {
      const row = brands.getRow(i);
      console.log(`  ${String(row.getCell(2).value).padStart(5)}  ${row.getCell(1).value}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
