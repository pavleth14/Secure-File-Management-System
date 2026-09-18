/**
 * Transform Nolan.csv into app-ready board/Old Leads import CSVs (3000 rows per file).
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import validator from 'validator';
import { formatLeadDateIso } from '../src/utils/leadDateFormat.js';

const SOURCE_PATH =
  process.argv[2] ||
  'C:\\Users\\Administrator\\Downloads\\Two Brothers Freight - Hiring Checklist and Leads   - Nolan.csv';
const OUT_DIR =
  process.argv[3] || 'C:\\Users\\Administrator\\Downloads\\nolan-import-ready';
const ROWS_PER_FILE = Number(process.argv[4] || 3000);
const FILE_PREFIX =
  process.argv[5] ||
  path
    .basename(SOURCE_PATH, path.extname(SOURCE_PATH))
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40) ||
  'import';

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
  'Comments',
];

const NA = 'N/A';
const FALLBACK_DATE_DISPLAY = '01/01/2000';
const FALLBACK_DATE_ISO = '2000-01-01';
const COMPANY_DRIVER_TYPE = 'Solo';

function cell(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .trim();
}

function digitsOnly(value) {
  return cell(value).replace(/\D/g, '');
}

function toIsoDateParts(y, m, d) {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return '';
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** US M/D/Y plus D/M/Y when day part > 12 (e.g. 14/4/2026). */
function normalizeDateToIso(value) {
  const v = cell(value);
  if (!v) return '';

  const isoFromLib = formatLeadDateIso(v);
  if (isoFromLib) return isoFromLib;

  const parts = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!parts) return '';

  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const year = Number(parts[3]);

  if (first > 12 && second <= 12) {
    return toIsoDateParts(year, second, first);
  }
  if (second > 12 && first <= 12) {
    return toIsoDateParts(year, first, second);
  }
  return toIsoDateParts(year, first, second);
}

function isIncompleteDateString(value) {
  const v = cell(value);
  if (!v) return false;
  if (/^\d{1,2}[/.]\d{1,2}$/.test(v)) return true;
  if (/^\d{1,2}[/.]\d{1,2}[/.]\d{1}$/.test(v)) return true;
  return false;
}

function isCompleteDateString(value) {
  const v = cell(value);
  if (!v || v.toUpperCase() === NA) return false;
  if (isIncompleteDateString(v)) return false;
  if (/[a-zA-Z]{4,}/.test(v) && !/^\d/.test(v)) return false;

  return Boolean(normalizeDateToIso(v));
}

function isPhoneString(value) {
  const v = cell(value);
  if (!v || v.toUpperCase() === NA) return false;
  if (isCompleteDateString(v)) return false;

  const digits = digitsOnly(v);
  if (digits.length < 7 || digits.length > 15) return false;

  const letterCount = (v.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 2) return false;

  return /^[\d\s().+\-/]+$/.test(v) || digits.length >= 10;
}

function isNameString(value) {
  const v = cell(value);
  if (!v || v.toUpperCase() === NA) return false;
  if (isCompleteDateString(v)) return false;
  if (isPhoneString(v)) return false;
  if (isIncompleteDateString(v)) return false;

  return /[a-zA-Z]/.test(v);
}

function classifyField(value) {
  const v = cell(value);
  if (!v || v.toUpperCase() === NA) return 'empty';
  if (isIncompleteDateString(v)) return 'bad-date';
  if (isCompleteDateString(v)) return 'date';
  if (isPhoneString(v)) return 'phone';
  if (isNameString(v)) return 'name';
  return 'unknown';
}

function resolveDateNamePhone(rawDate, rawName, rawNumber) {
  const items = [
    { raw: rawDate, from: 'date' },
    { raw: rawName, from: 'name' },
    { raw: rawNumber, from: 'number' },
  ].map((item) => ({ ...item, kind: classifyField(item.raw) }));

  let dateRaw = '';
  let nameRaw = '';
  let phoneRaw = '';
  let sawBadDate = false;

  for (const item of items) {
    if (item.kind === 'bad-date') sawBadDate = true;
  }

  for (const kind of ['date', 'name', 'phone']) {
    const match = items.find((item) => item.kind === kind && item.raw);
    if (!match) continue;
    if (kind === 'date' && !dateRaw) dateRaw = match.raw;
    if (kind === 'name' && !nameRaw) nameRaw = match.raw;
    if (kind === 'phone' && !phoneRaw) phoneRaw = match.raw;
  }

  for (const item of items) {
    if (item.kind === 'unknown' && item.raw) {
      if (!nameRaw && /[a-zA-Z]/.test(item.raw)) nameRaw = item.raw;
      else if (!phoneRaw && digitsOnly(item.raw).length >= 7) phoneRaw = item.raw;
    }
  }

  let dateOut;
  if (dateRaw && isCompleteDateString(dateRaw)) {
    dateOut = normalizeDateToIso(dateRaw) || FALLBACK_DATE_ISO;
  } else {
    dateOut = FALLBACK_DATE_ISO;
    if (sawBadDate || (dateRaw && !isCompleteDateString(dateRaw))) {
      dateOut = FALLBACK_DATE_ISO;
    }
  }

  return {
    date: dateOut,
    nameRaw,
    phoneRaw: phoneRaw ? cell(phoneRaw) : '',
  };
}

function splitName(fullName) {
  const trimmed = cell(fullName).replace(/\s+/g, ' ');
  if (!trimmed) {
    return { firstName: NA, lastName: NA };
  }
  const parts = trimmed.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: NA };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function normalizePhone(value) {
  const v = cell(value);
  return v || NA;
}

function extractEmail(value) {
  const trimmed = cell(value);
  if (!trimmed || !trimmed.includes('@')) return '';
  if (!validator.isEmail(trimmed, { allow_utf8_local_part: false })) return '';
  return trimmed.toLowerCase();
}

function buildStateCity(city, state) {
  const c = cell(city);
  const s = cell(state);
  if (c && s) return `${c}, ${s}`;
  return c || s || NA;
}

function phoneColumnKey(row) {
  return Object.keys(row).find((key) => key.includes('OVDE LEPIS'));
}

function stepColumnKey(row) {
  return Object.keys(row).find((key) => key.includes('Slede'));
}

function detectSpreadsheetFormat(rawRows) {
  const keys = Object.keys(rawRows[0] || {});
  if (keys.includes('Phone number') && keys.includes('Location') && !keys.includes('Number')) {
    return 'edward';
  }
  if (
    keys.includes('EMAIL') &&
    keys.includes('Status') &&
    keys.includes('Team/Solo') &&
    keys.includes('Number')
  ) {
    return 'christina';
  }
  if (
    keys.includes('Team/Solo') &&
    keys.includes('Number') &&
    keys.includes('Day 1 ') &&
    !keys.includes('Day 1 - Attempt 1')
  ) {
    return 'jeffrey';
  }
  if (keys.includes('Team/Solo') && keys.includes('Number')) {
    return 'nolan';
  }
  if (keys.some((k) => k.includes('OVDE LEPIS')) || keys.includes('RBR')) {
    return 'carterr';
  }
  return 'nolan';
}

function isGarbageCarterrRow(rawRow) {
  const status = cell(rawRow.Status);
  if (status.length > 80) return true;
  if (/All statuses/i.test(status)) return true;
  return false;
}

function transformCarterrRow(rawRow) {
  if (isGarbageCarterrRow(rawRow)) return null;

  const rbr = cell(rawRow.RBR);
  const nameCol = cell(rawRow.Name);
  const phoneKey = phoneColumnKey(rawRow);
  const phoneCol = phoneKey ? rawRow[phoneKey] : '';
  const refCol = cell(rawRow['#REF!']);
  const emailField = rawRow.Email;
  const locationField = cell(rawRow['Poten lokacija']);
  const source = cell(rawRow['Poreklo lida']) || NA;
  const status = cell(rawRow.Status) || NA;
  const stepKey = stepColumnKey(rawRow);
  const commentParts = [stepKey ? cell(rawRow[stepKey]) : '', cell(rawRow.Exp)]
    .filter(Boolean)
    .join(' | ');

  let driverType = NA;
  let nameRaw = '';
  let phoneRaw = '';
  let stateCity = locationField || NA;
  let dateRaw = '';

  if (/^(solo|team)$/i.test(rbr)) {
    driverType = /^solo$/i.test(rbr) ? 'Solo' : 'Team';
    const rotated = resolveDateNamePhone(refCol, nameCol, phoneCol);
    nameRaw = rotated.nameRaw || nameCol || refCol;
    phoneRaw = rotated.phoneRaw || phoneCol;
    dateRaw = rotated.date !== FALLBACK_DATE_ISO ? rotated.date : '';
  } else if (/^\d+$/.test(rbr)) {
    const rotated = resolveDateNamePhone('', nameCol, phoneCol);
    nameRaw = rotated.nameRaw || nameCol;
    phoneRaw = rotated.phoneRaw || phoneCol;
    dateRaw = rotated.date !== FALLBACK_DATE_ISO ? rotated.date : '';
  } else if (rbr && nameCol && cell(phoneCol)) {
    driverType = COMPANY_DRIVER_TYPE;
    nameRaw = `${rbr} ${nameCol}`;
    phoneRaw = phoneCol;
    if (!locationField) {
      stateCity = buildStateCity(refCol, emailField);
    }
  } else if (!rbr && nameCol && cell(phoneCol)) {
    const rotated = resolveDateNamePhone(refCol, nameCol, phoneCol);
    nameRaw = rotated.nameRaw || nameCol;
    phoneRaw = rotated.phoneRaw || phoneCol;
  } else {
    return null;
  }

  const rotatedFinal = resolveDateNamePhone(dateRaw, nameRaw, phoneRaw);
  const { firstName, lastName } = splitName(rotatedFinal.nameRaw || nameRaw);

  return {
    Status: status,
    'Type of Driver': driverType,
    Source: source,
    Date: rotatedFinal.date,
    'First Name': firstName,
    'Last Name': lastName,
    Phone: normalizePhone(rotatedFinal.phoneRaw),
    'State / City': stateCity || NA,
    Email: extractEmail(emailField),
    Comments: commentParts || NA,
  };
}

function normalizeDriverType(value) {
  const v = cell(value);
  if (!v) return NA;
  if (/^solo$/i.test(v)) return 'Solo';
  if (/^team$/i.test(v)) return 'Team';
  return v;
}

function pickComment(row) {
  const notes = cell(row.Notes);
  const attempts = [
    row['Day 1 - Attempt 1'],
    row['Day 1 - Attempt 2'],
    row['Day 1 - Attempt 3'],
    row['Day 2 - Attempt 1'],
    row['Day 2 - Attempt 2'],
    row['Day 2 - Attempt 3'],
    row['Day 3 - Attempt 1'],
    row['Day 3 - Attempt 2'],
    row['Day 3 - Attempt 3'],
  ]
    .map(cell)
    .filter(Boolean);

  const parts = [];
  if (notes) parts.push(notes);
  if (attempts.length) parts.push(attempts.join(' | '));
  return parts.join(' — ') || NA;
}

function escapeCsvField(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsvLine(row) {
  return OUTPUT_HEADERS.map((header) => escapeCsvField(row[header])).join(',');
}

function nolanStatusColumn(rawRow) {
  return cell(rawRow.Status) || cell(rawRow[' ']) || NA;
}

function christinaStateCity(rawRow) {
  const emptyKeys = Object.keys(rawRow)
    .filter((key) => key === '__EMPTY' || key.startsWith('__EMPTY_'))
    .sort();
  const abbrev = emptyKeys[0] ? cell(rawRow[emptyKeys[0]]) : '';
  const place = emptyKeys[1] ? cell(rawRow[emptyKeys[1]]) : '';
  return buildStateCity(place, abbrev) || NA;
}

function christinaEmail(rawRow) {
  const raw = cell(rawRow.EMAIL);
  if (!raw || /^company$/i.test(raw)) return '';
  return extractEmail(raw);
}

function pickChristinaComment(rawRow) {
  const parts = [rawRow['Day 1 - Attempt 1'], rawRow['Day 2 - Attempt 1']]
    .map(cell)
    .filter(Boolean);
  return parts.join(' | ') || NA;
}

function transformChristinaRow(rawRow) {
  const status = cell(rawRow.Status) || NA;
  const driverType = normalizeDriverType(rawRow['Team/Solo']);
  const source = cell(rawRow.Source) || NA;
  const dateField = cell(rawRow.Date);
  const nameField = cell(rawRow.Name);

  let date;
  let firstName;
  let lastName;
  let phoneRaw;

  if (isCompleteDateString(dateField)) {
    const resolved = resolveDateNamePhone(rawRow.Date, rawRow.Name, rawRow.Number);
    date = resolved.date;
    ({ firstName, lastName } = splitName(resolved.nameRaw));
    phoneRaw = resolved.phoneRaw;
  } else {
    date = FALLBACK_DATE_ISO;
    firstName = dateField || NA;
    lastName = nameField || NA;
    if (firstName !== NA && lastName === NA && nameField && isNameString(nameField)) {
      ({ firstName, lastName } = splitName(`${dateField} ${nameField}`.trim()));
    }
    phoneRaw = cell(rawRow.Number);
    if (!phoneRaw || !isPhoneString(phoneRaw)) {
      const rotated = resolveDateNamePhone('', rawRow.Name, rawRow.Number);
      phoneRaw = rotated.phoneRaw || phoneRaw;
    }
  }

  return {
    Status: status,
    'Type of Driver': driverType,
    Source: source,
    Date: date,
    'First Name': firstName,
    'Last Name': lastName,
    Phone: normalizePhone(phoneRaw),
    'State / City': christinaStateCity(rawRow),
    Email: christinaEmail(rawRow),
    Comments: pickChristinaComment(rawRow),
  };
}

function transformEdwardRow(rawRow) {
  const status = cell(rawRow.Status) || NA;
  const driverType = normalizeDriverType(rawRow['Team/Solo']);
  const source = cell(rawRow.Source) || NA;

  const { date, nameRaw, phoneRaw } = resolveDateNamePhone(
    rawRow.Date,
    rawRow.Name,
    rawRow['Phone number']
  );

  const { firstName, lastName } = splitName(nameRaw);
  const location = cell(rawRow.Location) || NA;
  const note = cell(rawRow.Note) || NA;

  return {
    Status: status,
    'Type of Driver': driverType,
    Source: source,
    Date: date,
    'First Name': firstName,
    'Last Name': lastName,
    Phone: normalizePhone(phoneRaw),
    'State / City': location,
    Email: extractEmail(rawRow.Email),
    Comments: note || NA,
  };
}

function pickJeffreyComment(rawRow) {
  const parts = [rawRow['Day 1 '], rawRow['Day 2'], rawRow['Day 3']]
    .map(cell)
    .filter(Boolean);
  return parts.join(' | ') || NA;
}

function transformJeffreyRow(rawRow) {
  const status = nolanStatusColumn(rawRow);
  const driverType = normalizeDriverType(rawRow['Team/Solo']);
  const source = cell(rawRow.Source) || NA;

  const { date, nameRaw, phoneRaw } = resolveDateNamePhone(
    rawRow.Date,
    rawRow.Name,
    rawRow.Number
  );

  const { firstName, lastName } = splitName(nameRaw);

  return {
    Status: status,
    'Type of Driver': driverType,
    Source: source,
    Date: date,
    'First Name': firstName,
    'Last Name': lastName,
    Phone: normalizePhone(phoneRaw),
    'State / City': NA,
    Email: '',
    Comments: pickJeffreyComment(rawRow),
  };
}

function transformRow(rawRow) {
  const status = nolanStatusColumn(rawRow);
  const driverType = normalizeDriverType(rawRow['Team/Solo']);
  const source = cell(rawRow.Source) || NA;

  const { date, nameRaw, phoneRaw } = resolveDateNamePhone(
    rawRow.Date,
    rawRow.Name,
    rawRow.Number
  );

  const { firstName, lastName } = splitName(nameRaw);

  return {
    Status: status,
    'Type of Driver': driverType,
    Source: source,
    Date: date,
    'First Name': firstName,
    'Last Name': lastName,
    Phone: normalizePhone(phoneRaw),
    'State / City': NA,
    Email: '',
    Comments: pickComment(rawRow),
  };
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

  const format = detectSpreadsheetFormat(rawRows);
  const records = [];
  let skipped = 0;

  for (const rawRow of rawRows) {
    let mapped = null;

    if (format === 'carterr') {
      const phoneKey = phoneColumnKey(rawRow);
      const hasData =
        cell(rawRow.RBR) || cell(rawRow.Name) || (phoneKey && cell(rawRow[phoneKey]));
      if (!hasData) {
        skipped += 1;
        continue;
      }
      mapped = transformCarterrRow(rawRow);
    } else if (format === 'edward') {
      const hasData = ['Name', 'Phone number', 'Email', 'Date', 'Status', 'Source'].some(
        (key) => cell(rawRow[key])
      );
      if (!hasData) {
        skipped += 1;
        continue;
      }
      mapped = transformEdwardRow(rawRow);
    } else if (format === 'christina') {
      const hasData = ['Status', 'Team/Solo', 'Source', 'Date', 'Name', 'Number'].some(
        (key) => cell(rawRow[key])
      );
      if (!hasData) {
        skipped += 1;
        continue;
      }
      mapped = transformChristinaRow(rawRow);
    } else if (format === 'jeffrey') {
      const hasData = ['Status', 'Team/Solo', 'Source', 'Date', 'Name', 'Number'].some(
        (key) => cell(rawRow[key])
      );
      if (!hasData) {
        skipped += 1;
        continue;
      }
      mapped = transformJeffreyRow(rawRow);
    } else {
      const hasData = ['Status', 'Team/Solo', 'Source', 'Date', 'Name', 'Number'].some(
        (key) => cell(rawRow[key])
      );
      if (!hasData) {
        skipped += 1;
        continue;
      }
      mapped = transformRow(rawRow);
    }

    if (!mapped) {
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
    const fileName = `${FILE_PREFIX}-import-part-${String(part + 1).padStart(2, '0')}-of-${String(partCount).padStart(2, '0')}.csv`;
    const filePath = path.join(OUT_DIR, fileName);
    const body = [OUTPUT_HEADERS.join(','), ...chunk.map(rowToCsvLine)].join('\n');
    fs.writeFileSync(filePath, `\uFEFF${body}`, 'utf8');
    writtenFiles.push({ fileName, rows: chunk.length, filePath });
  }

  const fallbackDates = records.filter((r) => r.Date === FALLBACK_DATE_ISO).length;
  const readme = `# ${FILE_PREFIX} import files

Source: ${path.basename(SOURCE_PATH)}

Upload in app: **Recruiting → Import Leads** (or Old Leads — same column layout).

- Rows per file: ${ROWS_PER_FILE}
- Total rows: ${records.length}
- Skipped empty rows: ${skipped}
- Rows with fallback date ${FALLBACK_DATE_DISPLAY} (${FALLBACK_DATE_ISO}): ${fallbackDates}
- Status & Source copied exactly from spreadsheet (add them in app before import)
- Spreadsheet format detected: ${format}
- Date/Name/Number columns auto-rotated when misplaced (Nolan/Kathy layout)
- Empty name → First/Last ${NA}; single word → Last ${NA}
- Empty phone → ${NA}; State/City → ${NA}; Email left blank (app placeholder)
- Invalid/incomplete dates → ${FALLBACK_DATE_DISPLAY}

Files:
${writtenFiles.map((f) => `- ${f.fileName} (${f.rows} rows)`).join('\n')}
`;

  fs.writeFileSync(path.join(OUT_DIR, 'README.txt'), readme, 'utf8');

  console.log(
    JSON.stringify(
      {
        outDir: OUT_DIR,
        totalRecords: records.length,
        skipped,
        fallbackDates,
        partCount,
        files: writtenFiles,
      },
      null,
      2
    )
  );
}

main();
