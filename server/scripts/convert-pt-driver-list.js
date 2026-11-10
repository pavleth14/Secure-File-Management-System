/**
 * One-off: PT Active Driver List → app driver import format.
 * Usage: node scripts/convert-pt-driver-list.js [input.xlsx] [output.xlsx]
 */
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const defaultIn =
  'C:/Users/Administrator/Downloads/PT Active Driver List 11-10-2026.xlsx';
const defaultOut =
  'C:/Users/Administrator/Downloads/PT Active Driver List - Import Ready.xlsx';

const HEADERS = [
  'Name',
  'Type of Driver',
  'Owner Operator',
  'Date of Birth',
  'SSN#',
  'Phone#',
  'Email',
  'Hired Date',
  'Status',
  'CDL#',
  'CDL State',
  'CDL Expiration Date',
];

function formatUsDate(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const m = value.getMonth() + 1;
    const d = value.getDate();
    const y = value.getFullYear();
    return `${m}/${d}/${y}`;
  }
  const s = String(value).trim();
  if (!s) return '';
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    const y = parsed.getFullYear();
    return `${m}/${d}/${y}`;
  }
  return s;
}

function mapStatus(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Active';
  const lower = s.toLowerCase();
  if (lower === 'active') return 'Active';
  if (lower === 'terminated') return 'Terminated';
  if (lower === 'inactive' || lower === 'not active') return 'Not Active';
  return s;
}

function mapOwnerOperator(companyDriver) {
  if (companyDriver === true) return 'No';
  if (companyDriver === false) return 'Yes';
  return '';
}

function mapRow(row) {
  const phone =
    String(row['Cell-Phone'] || '').trim() ||
    String(row['Home Phone'] || '').trim();

  return {
    Name: String(row.Name || '').trim(),
    'Type of Driver': 'Solo',
    'Owner Operator': mapOwnerOperator(row['Company Driver']),
    'Date of Birth': formatUsDate(row['Date Of Birth']),
    'SSN#': '',
    'Phone#': phone,
    Email: String(row.Email || '').trim(),
    'Hired Date': formatUsDate(row['Hire Date'] ?? row['Hired Date']),
    Status: mapStatus(row.Status),
    'CDL#': String(row['CDL Number'] || '').trim(),
    'CDL State': String(row['CDL State'] || '').trim(),
    'CDL Expiration Date': '',
  };
}

function main() {
  const inputPath = path.resolve(process.argv[2] || defaultIn);
  const outputPath = path.resolve(process.argv[3] || defaultOut);

  if (!fs.existsSync(inputPath)) {
    console.error('Input not found:', inputPath);
    process.exit(1);
  }

  const wb = XLSX.readFile(inputPath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sourceRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

  const outRows = sourceRows
    .filter((r) => String(r.Name || '').trim())
    .map(mapRow);

  const outSheet = XLSX.utils.json_to_sheet(outRows, { header: HEADERS });
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, outSheet, 'Drivers');

  const instructions = [
    ['Driver import — šta još treba'],
    [''],
    ['Kolona SSN# je PRAZNA jer PT lista nema SSN. Popuni 9 cifara po vozaču pre importa.'],
    ['CDL Expiration Date je prazna — dodaj ako imaš podatke (opciono u aplikaciji).'],
    ['Type of Driver je postavljen na Solo za sve (PT nema Solo/Team).'],
    ['Owner Operator: No = Company Driver, Yes = nije Company Driver.'],
    ['Redovi bez Phone# ili CDL# neće proći validaciju pri importu.'],
  ];
  const instrSheet = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(outWb, instrSheet, 'Uputstvo');

  XLSX.writeFile(outWb, outputPath);

  let missingSsn = outRows.length;
  let missingPhone = outRows.filter((r) => String(r['Phone#']).replace(/\D/g, '').length < 7).length;
  let missingCdl = outRows.filter((r) => !r['CDL#']).length;

  console.log('Wrote:', outputPath);
  console.log('Rows:', outRows.length);
  console.log('Need SSN# filled:', missingSsn);
  console.log('Invalid phone:', missingPhone);
  console.log('Missing CDL#:', missingCdl);
}

main();
