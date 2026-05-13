// Inspect the U.S. Seal cross-reference PDF: dump first ~3000 chars and
// last ~500 chars so we can design the extractor against the real shape.
import fs from 'node:fs/promises';
import pdfParse from 'pdf-parse-fork';

async function main(): Promise<void> {
  const buf = await fs.readFile('data/source-pdfs/us-seal-cross-reference.pdf');
  const data = await pdfParse(buf);
  console.log('=== META ===');
  console.log('pages:', data.numpages);
  console.log('text length:', data.text.length);
  console.log('info:', data.info);
  console.log('');
  console.log('=== FIRST 3000 CHARS ===');
  console.log(data.text.slice(0, 3000));
  console.log('');
  console.log('=== CHARS 3000-6000 ===');
  console.log(data.text.slice(3000, 6000));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
