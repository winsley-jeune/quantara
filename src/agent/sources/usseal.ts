// Parses the U.S. Seal Mfg. Pump Manufacturers' Cross-Reference PDF.
//
// The PDF is structured as a multi-column table with:
//   - Manufacturer headers (uppercase lines like "A-C PUMP (Div. of XYLEM INC.)")
//   - Detail rows starting with U.S. Seal part numbers (PS-XXX or FA-XXX)
//   - Continuation lines with additional OEM cross-references for the same seal
//
// The pdf-parse text extraction loses column alignment, so we parse by:
//   1. Tracking the current manufacturer (last header seen)
//   2. Detecting rows that start with PS-/FA- patterns
//   3. Capturing OEM part numbers (alphanumeric with hyphens) trailing the row
//   4. Treating subsequent lines with ONLY an OEM part number as continuations
//
// Output: one row per (us_seal_part, oem_part_number) pair. A single seal
// often maps to 3-5 OEM part numbers, each gets its own normalized row.

import fs from 'node:fs/promises';
import pdfParse from 'pdf-parse-fork';

export interface USSealCrossRef {
  oem_brand: string;
  oem_part_number: string;
  us_seal_part_number: string;
  seal_size: string | null;
  head_code: string | null;
  mating_ring: string | null;
  bore: string | null;
  material_code: string | null;
  notes: string | null;
  pump_nameplate_data: string | null;
}

// Header lines are mostly uppercase, may contain parens, dashes, dots, slashes,
// but NEVER start with a U.S. Seal part number prefix. They're isolated on
// their own line and don't contain digit-heavy column data.
function isManufacturerHeader(line: string): boolean {
  if (!line) return false;
  if (/^(PS|FA|FN|MS|SS|UC|UE|MC|EP|EC|RA|RC|VGK|VPS|VFA)-\d/.test(line)) return false;
  if (line.startsWith('U.S. Seal')) return false;
  if (line.startsWith('PUMP MANUFACTURERS')) return false;
  if (line.startsWith('Part No.')) return false;
  if (line.startsWith('NOTE:')) return false;
  if (line.startsWith('Note:')) return false;
  // Note-legend lines: "S. SLOTTED MATING RING", "A. MOUNTS ON SHAFT", etc.
  if (/^[A-Z]\.\s+[A-Z]/.test(line)) return false;
  // Multi-letter note prefixes ("C/I/S", "C/H/S")
  if (/^[A-Z]{1,3}\/[A-Z]\/[A-Z]?$/.test(line.trim())) return false;
  // Model-list lines like "2J, 3J, 15J, 75J,1GJ" or "HHS, R, RH, RHS"
  if (/^[A-Z0-9-]{1,8}(?:,\s*[A-Z0-9-]{1,8}){2,}/.test(line.trim())) return false;
  // U.S. Seal-style internal rows: e.g. "VGK-1129 1-1/2 C 1 2.125 VCFKF"
  if (/^[A-Z]{2,5}-\d+\s+\d/.test(line.trim())) return false;
  // Require mostly uppercase letters
  const letters = line.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 3) return false;
  const upperLetters = letters.replace(/[a-z]/g, '');
  if (upperLetters.length / letters.length < 0.7) return false;
  if (/^\(continued\)$/i.test(line.trim())) return false;
  // Avoid pure-digit / mostly-digit lines
  const digits = line.replace(/[^0-9]/g, '');
  if (digits.length > line.length * 0.4) return false;
  return true;
}

// U.S. Seal part number pattern. Examples:
//   PS-851, FA-10, PS-1018-EPR-P66, PS-447V-P66
function usSealPartPattern(): RegExp {
  // U.S. Seal product line prefixes observed across the cross-ref:
  //   PS = single seal, FA = formed assembly, FN = inside seal,
  //   MS/SS = cartridge variants, UC/UE = unitized, MC = mechanical cart,
  //   EP/EC = elastomer-package, RA/RC = retrofit, VGK = component,
  //   VPS/VFA = Viton variants.
  return /\b(PS|FA|FN|MS|SS|UC|UE|MC|EP|EC|RA|RC|VGK|VPS|VFA)-[A-Z0-9-]+(?:-[A-Z0-9]+)*\b/;
}

// OEM part numbers — alphanumeric with hyphens, at least 4 chars total, must
// contain a digit. We match conservatively: pure-digit runs of 5+ chars, or
// digit-hyphen patterns common to industrial OEMs (52-104-969-803).
function oemPartPattern(): RegExp {
  return /\b(?=[A-Z0-9-]*\d)[A-Z0-9](?:[A-Z0-9-]{4,30})\b/g;
}

interface RowParse {
  us_seal_part: string;
  rest: string;
  oem_parts: string[];
}

function extractOEMParts(rest: string, usSealPart: string): string[] {
  // Exclude the US Seal part number itself, and look for OEM-shaped tokens.
  // Real OEM part numbers in this PDF skew heavily toward multi-segment
  // hyphenated forms like 52-104-969-803 or 11107939 or 16-630-048-09-1.
  const out: string[] = [];
  const tokens = rest.match(oemPartPattern()) ?? [];
  for (const t of tokens) {
    if (t === usSealPart) continue;
    if (/^(PS|FA|FN|MS|SS|UC|UE|MC|EP|EC|RA|RC)-/.test(t)) continue;
    // Filter pump model strings like "MAXEAL", "Series" — keep tokens that
    // have at least 5 digits total OR a multi-segment hyphen pattern with
    // numbers in each segment.
    const digits = t.replace(/[^0-9]/g, '').length;
    const hyphens = t.split('-').length - 1;
    if (digits >= 5 || (hyphens >= 2 && digits >= 4)) {
      out.push(t);
    }
  }
  return out;
}

function parseRowStartingWithUSSeal(line: string): RowParse | null {
  const match = line.match(usSealPartPattern());
  if (!match || match.index === undefined || match.index > 5) return null;
  const us_seal_part = match[0];
  const rest = line.slice(match.index + us_seal_part.length).trim();
  return {
    us_seal_part,
    rest,
    oem_parts: extractOEMParts(rest, us_seal_part),
  };
}

// Continuation line = a line that has NO U.S. Seal prefix at the start but
// contains an OEM-shaped token (the visual continuation of the previous row's
// "Mfg. Part No." column).
function continuationOEM(line: string): string[] {
  if (usSealPartPattern().test(line.slice(0, 6))) return [];
  if (/^[A-Z]{2,}/.test(line.trim())) return []; // header-like
  return extractOEMParts(line, '');
}

export async function parseUSSealPDF(path: string): Promise<USSealCrossRef[]> {
  const buf = await fs.readFile(path);
  const data = await pdfParse(buf);
  const lines = data.text.split('\n');

  const rows: USSealCrossRef[] = [];
  let currentManufacturer = '';
  let lastRowSlice: { us_seal: string; rest: string } | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    // Skip recognized boilerplate
    if (/^(PUMP MANUFACTURERS|U\.S\. Seal Mfg|Part No\.|NOTE:|Note:|Somerset NJ|Tel:|www\.|DEMAND)/i.test(line)) {
      continue;
    }

    // Manufacturer header
    if (isManufacturerHeader(line)) {
      currentManufacturer = line.replace(/\s*\(continued\)\s*/i, '').trim();
      lastRowSlice = null;
      continue;
    }

    // U.S. Seal row?
    const rowParse = parseRowStartingWithUSSeal(line);
    if (rowParse) {
      for (const oem of rowParse.oem_parts) {
        rows.push({
          oem_brand: currentManufacturer,
          oem_part_number: oem,
          us_seal_part_number: rowParse.us_seal_part,
          seal_size: null,
          head_code: null,
          mating_ring: null,
          bore: null,
          material_code: null,
          notes: null,
          pump_nameplate_data: rowParse.rest.slice(0, 200) || null,
        });
      }
      lastRowSlice = { us_seal: rowParse.us_seal_part, rest: rowParse.rest };
      continue;
    }

    // Continuation line (additional OEM parts for the previous U.S. Seal seal)
    if (lastRowSlice) {
      const moreOEM = continuationOEM(line);
      for (const oem of moreOEM) {
        rows.push({
          oem_brand: currentManufacturer,
          oem_part_number: oem,
          us_seal_part_number: lastRowSlice.us_seal,
          seal_size: null,
          head_code: null,
          mating_ring: null,
          bore: null,
          material_code: null,
          notes: null,
          pump_nameplate_data: null,
        });
      }
    }
  }

  // Dedupe on (oem_brand, oem_part_number, us_seal_part_number)
  const seen = new Set<string>();
  const unique: USSealCrossRef[] = [];
  for (const r of rows) {
    const key = `${r.oem_brand}${r.oem_part_number}${r.us_seal_part_number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique;
}
