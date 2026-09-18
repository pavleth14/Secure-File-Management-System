/**
 * Transform "NEW Lead List.csv" into app-ready Old Leads import CSVs (split parts).
 * Does not touch the database.
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import validator from 'validator';
import { formatLeadDateIso } from '../src/utils/leadDateFormat.js';
import { DRIVER_TYPES } from '../src/config/recruitingConstants.js';

const SOURCE_PATH =
  process.argv[2] ||
  'C:\\Users\\Administrator\\Downloads\\Two Brothers Freight - Hiring Checklist and Leads   - NEW Lead List.csv';
const OUT_DIR =
  process.argv[3] ||
  'C:\\Users\\Administrator\\Downloads\\old-leads-import-ready';
const ROWS_PER_FILE = Number(process.argv[4] || 6000);

const OUTPUT_HEADERS = [
  'Status',
  'Type of Driver',
  'Source',
  'Date',
  'First Name',
  'Last Name',
  'Phone',
  'State / City',
  'Email',
];

const SOURCE_VALUE = 'Old Leads';
const COMPANY_DRIVER_TYPE = 'Solo';
const MISSING_LAST_NAME = 'Unknown';

function cell(value) {
  return String(value ?? '').trim();
}

function splitName(fullName) {
  const trimmed = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }
  const parts = trimmed.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: MISSING_LAST_NAME };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function normalizePhone(value) {
  const trimmed = String(value || '').trim();
  return trimmed || 'N/A';
}

function extractEmail(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !trimmed.includes('@')) return '';
  if (!validator.isEmail(trimmed, { allow_utf8_local_part: false })) return '';
  return trimmed.toLowerCase();
}

function normalizeDriverType(value) {
  const v = String(value || '').trim();
  return DRIVER_TYPES.includes(v) ? v : '';
}

function buildStateCity(city, state) {
  const c = String(city || '').trim();
  const s = String(state || '').trim();
  if (c && s) return `${c}, ${s}`;
  return c || s || '';
}

function isFormat1Row(row) {
  return Boolean(normalizeDriverType(row.q));
}

function isFormat2Row(row) {
  if (isFormat1Row(row)) return false;
  return cell(row.exp).toUpperCase() === 'COMPANY';
}

function rowFromFormat1(row) {
  const driverType = normalizeDriverType(row.q);
  const dateRaw = row.Date;
  const { firstName, lastName } = splitName(row.Name);
  const phone = normalizePhone(row.Number);
  const location = cell(row.Location);
  const email = extractEmail(row['E-mail']);

  return {
    status: '',
    driverType,
    source: SOURCE_VALUE,
    date: formatLeadDateIso(dateRaw) || '',
    firstName,
    lastName,
    phone,
    stateCity: location,
    email,
  };
}

/** COMPANY block: columns shifted under the sheet header (q=first name, …). */
function rowFromFormat2(row) {
  const firstName = cell(row.q);
  const lastNameRaw = cell(row.Source);
  const lastName = lastNameRaw || MISSING_LAST_NAME;
  const stateCity = buildStateCity(row.Date, row.Name);
  const phone = normalizePhone(row.Number);

  return {
    status: '',
    driverType: COMPANY_DRIVER_TYPE,
    source: SOURCE_VALUE,
    date: '',
    firstName,
    lastName,
    phone,
    stateCity,
    email: '',
  };
}

function escapeCsvField(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsvLine(row) {
  return OUTPUT_HEADERS.map((header) => {
    switch (header) {
      case 'Status':
        return escapeCsvField(row.status);
      case 'Type of Driver':
        return escapeCsvField(row.driverType);
      case 'Source':
        return escapeCsvField(row.source);
      case 'Date':
        return escapeCsvField(row.date);
      case 'First Name':
        return escapeCsvField(row.firstName);
      case 'Last Name':
        return escapeCsvField(row.lastName);
      case 'Phone':
        return escapeCsvField(row.phone);
      case 'State / City':
        return escapeCsvField(row.stateCity);
      case 'Email':
        return escapeCsvField(row.email);
      default:
        return '';
    }
  }).join(',');
}

function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error('Source file not found:', SOURCE_PATH);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const buffer = fs.readFileSync(SOURCE_PATH);
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
    raw: true,
  });

  const records = [];
  let skipped = 0;
  let format1 = 0;
  let format2 = 0;

  for (const rawRow of rawRows) {
    const row = rawRow;
    const hasData = Object.values(row).some((v) => cell(v));
    if (!hasData) {
      skipped += 1;
      continue;
    }

    let mapped;
    if (isFormat1Row(row)) {
      mapped = rowFromFormat1(row);
      format1 += 1;
    } else if (isFormat2Row(row)) {
      mapped = rowFromFormat2(row);
      format2 += 1;
    } else {
      skipped += 1;
      continue;
    }

    if (!mapped.firstName || !mapped.lastName || !mapped.driverType) {
      skipped += 1;
      continue;
    }

    records.push(mapped);
  }

  const partCount = Math.ceil(records.length / ROWS_PER_FILE) || 1;
  const writtenFiles = [];

  for (let part = 0; part < partCount; part += 1) {
    const start = part * ROWS_PER_FILE;
    const chunk = records.slice(start, start + ROWS_PER_FILE);
    const fileName = `old-leads-import-part-${String(part + 1).padStart(2, '0')}-of-${String(partCount).padStart(2, '0')}.csv`;
    const filePath = path.join(OUT_DIR, fileName);
    const body = [OUTPUT_HEADERS.join(','), ...chunk.map(rowToCsvLine)].join('\n');
    fs.writeFileSync(filePath, `\uFEFF${body}`, 'utf8');
    writtenFiles.push({ fileName, rows: chunk.length, filePath });
  }

  const readme = `# Old Leads import files

Generated from: ${path.basename(SOURCE_PATH)}

Upload each part in the app: **Recruiting → Old Leads → Import CSV** (preview, then confirm).

- Total rows: ${records.length}
- Format 1 (Solo/Team sheet): ${format1}
- Format 2 (COMPANY rows → Type of Driver "${COMPANY_DRIVER_TYPE}"): ${format2}
- Skipped unparseable rows: ${skipped}
- Source on every row: "${SOURCE_VALUE}"
- Empty phone → "N/A"
- Email only when valid (@) in source column

Files:
${writtenFiles.map((f) => `- ${f.fileName} (${f.rows} rows)`).join('\n')}
`;

  fs.writeFileSync(path.join(OUT_DIR, 'README.txt'), readme, 'utf8');

  console.log(JSON.stringify({
    outDir: OUT_DIR,
    totalRecords: records.length,
    format1,
    format2,
    skipped,
    partCount,
    files: writtenFiles,
  }, null, 2));
}

main();
