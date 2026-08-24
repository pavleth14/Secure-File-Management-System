/**
 * Daily bulk leads spreadsheet → TBF recruiting app
 *
 * Required columns (row 1 headers):
 *   first_name | last_name | phone_number | date
 *
 * Optional:
 *   email        — if empty, app assigns a unique placeholder (shown as N/A)
 *   state        — State / City in app (can be empty)
 *   id           — unique lead id (recommended); auto-generated if empty
 *   driver_type  — Solo | Owner Operator | Team | Local
 *   position     — maps to driver type if driver_type empty
 *
 * When you paste 10 new rows, run syncNewBulkRows (or daily trigger) → 10 leads in the app.
 *
 * Script properties (Project Settings):
 *   API_URL          = https://api.twobrothersfreight.com/api/recruiting/sheets/ingest
 *   API_SECRET       = same as SHEETS_INGEST_SECRET on server
 *   BULK_LEAD_SOURCE = Indeed  (must exist in app Lead Sources)
 *
 * Setup:
 * 1. Paste this file in Apps Script on your NEW spreadsheet
 * 2. Run setupBulkSheetHeaders once (creates header row)
 * 3. Run authorizeOnce
 * 4. Add rows, run syncNewBulkRows (or menu: TBF Leads → Sync new rows)
 * 5. Optional trigger: syncNewBulkRows daily
 *
 * Facebook (4 tabs): google-sheets-sync.gs
 */

const BULK_SHEET_CONFIG = {
  name: 'Leads',
  defaultDriverType: 'Solo',
};

/** Headers written by setupBulkSheetHeaders — keep in sync with REQUIRED_FIELDS */
const SHEET_HEADERS = [
  'id',
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'date',
  'state',
  'driver_type',
];

const REQUIRED_FIELDS = [
  'first_name',
  'last_name',
  'phone_number',
  'date',
];

const CORE_FIELDS = new Set([
  'first_name',
  'last_name',
  'phone_number',
  'phone',
  'email',
  'date',
  'state',
  'state_city',
  'created_time',
  'driver_type',
  'position',
]);

const ID_ALIASES = ['id', 'lead_id', 'meta_lead_id'];

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, ' ')
    .replace(/\s+/g, '_')
    .replace(/[?()]/g, '')
    .replace(/,/g, '')
    .replace(/__+/g, '_');
}

function getProps_() {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('API_URL');
  const apiSecret = props.getProperty('API_SECRET');
  if (!apiUrl || !apiSecret) {
    throw new Error('Set API_URL and API_SECRET in Script Properties');
  }
  const source = String(props.getProperty('BULK_LEAD_SOURCE') || 'Indeed').trim();
  if (!source) {
    throw new Error('Set BULK_LEAD_SOURCE in Script Properties (e.g. Indeed, Tenstreet)');
  }
  return { apiUrl, apiSecret, source };
}

function lastRowKey_(sheetName) {
  return 'BULK_LAST_ROW_' + sheetName;
}

function getLastProcessedRow_(sheetName) {
  const raw = PropertiesService.getScriptProperties().getProperty(lastRowKey_(sheetName));
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function setLastProcessedRow_(sheetName, rowNumber) {
  PropertiesService.getScriptProperties().setProperty(lastRowKey_(sheetName), String(rowNumber));
}

function mapPositionToDriverType_(position) {
  const value = String(position || '').trim().toLowerCase();
  if (!value) return null;
  if (value === 'company' || value.includes('company') || value.includes('solo')) return 'Solo';
  if (value.includes('owner')) return 'Owner Operator';
  if (value.includes('team')) return 'Team';
  if (value.includes('local')) return 'Local';
  return null;
}

function normalizeDriverTypeAlias_(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const mapped = mapPositionToDriverType_(normalized);
  if (mapped) return mapped;
  return normalized;
}

function resolveDriverType_(columns, defaultDriverType) {
  const explicit = normalizeDriverTypeAlias_(columns.driver_type);
  if (explicit) return explicit;
  const fromPosition = mapPositionToDriverType_(columns.position);
  if (fromPosition) return fromPosition;
  return defaultDriverType || 'Solo';
}

function normalizeCellValue_(key, value) {
  if (value === null || value === undefined || value === '') return null;

  if (key === 'phone_number' || key === 'phone') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.round(value));
    }
    return String(value).trim();
  }

  if (key === 'date' || key === 'created_time') {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  }

  return String(value).trim();
}

function resolveMetaLeadId_(columns, spreadsheetId, sheetName, rowNumber) {
  for (let i = 0; i < ID_ALIASES.length; i += 1) {
    const value = String(columns[ID_ALIASES[i]] || '').trim();
    if (value) return value;
  }
  return 'bulk-' + spreadsheetId + '-' + sheetName + '-row-' + rowNumber;
}

function rowToObject_(headers, rowValues) {
  const obj = {};
  for (let i = 0; i < headers.length; i += 1) {
    const key = headers[i];
    if (!key) continue;
    const normalized = normalizeCellValue_(key, rowValues[i]);
    if (!normalized) continue;
    obj[key] = normalized;
  }

  if (!obj.phone_number && obj.phone) {
    obj.phone_number = obj.phone;
  }

  if (!obj.state && obj.state_city) {
    obj.state = obj.state_city;
  }

  return obj;
}

function validateRequiredFields_(columns, sheetName, rowNumber) {
  const missing = [];
  for (let i = 0; i < REQUIRED_FIELDS.length; i += 1) {
    const field = REQUIRED_FIELDS[i];
    if (!String(columns[field] || '').trim()) {
      missing.push(field);
    }
  }
  if (missing.length) {
    Logger.log(
      '[%s row %s] missing required: %s',
      sheetName,
      rowNumber,
      missing.join(', ')
    );
    return false;
  }
  return true;
}

function buildPayload_(columns, spreadsheetId, sheetName, rowNumber, config, source) {
  const metaLeadId = resolveMetaLeadId_(columns, spreadsheetId, sheetName, rowNumber);
  const driverType = resolveDriverType_(columns, config.defaultDriverType);

  const core = {
    first_name: String(columns.first_name || '').trim(),
    last_name: String(columns.last_name || '').trim(),
    phone_number: String(columns.phone_number || columns.phone || '').trim(),
    date: String(columns.date || '').trim(),
  };

  if (columns.email) {
    core.email = String(columns.email).trim();
  }

  if (columns.state || columns.state_city) {
    core.state = String(columns.state || columns.state_city).trim();
  }

  if (columns.driver_type) {
    core.driver_type = normalizeDriverTypeAlias_(columns.driver_type);
  }

  const extraFields = {};
  Object.keys(columns).forEach(function (key) {
    if (ID_ALIASES.indexOf(key) !== -1) return;
    if (CORE_FIELDS.has(key)) return;
    extraFields[key] = columns[key];
  });

  // API uses created_time for timestamps; date column is the lead date in the app
  if (core.date) {
    core.created_time = core.date;
  }

  return {
    spreadsheetId: spreadsheetId,
    sheetName: sheetName,
    rowNumber: rowNumber,
    metaLeadId: metaLeadId,
    driverType: driverType,
    source: source,
    columns: core,
    extraFields: extraFields,
  };
}

function postRowToApi_(payload, apiUrl, apiSecret) {
  const response = UrlFetchApp.fetch(apiUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-API-Key': apiSecret,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code >= 200 && code < 300) {
    return { ok: true, code: code, body: body };
  }
  return { ok: false, code: code, body: body };
}

function ingestBulkSheetRows_(sheet, config, options) {
  const props = getProps_();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheetId = spreadsheet.getId();
  const sheetName = config.name;

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { sheetName: sheetName, sent: 0, skipped: 0, errors: 0 };
  }

  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headers = headerRow.map(normalizeHeader);

  const startRow = options.forceAll ? 2 : getLastProcessedRow_(sheetName) + 1;
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let maxProcessedRow = getLastProcessedRow_(sheetName);

  for (let rowNumber = startRow; rowNumber <= lastRow; rowNumber += 1) {
    const rowValues = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];

    const isEmpty = rowValues.every(function (v) {
      return v === '' || v === null || v === undefined;
    });
    if (isEmpty) {
      maxProcessedRow = rowNumber;
      continue;
    }

    const columns = rowToObject_(headers, rowValues);

    if (!validateRequiredFields_(columns, sheetName, rowNumber)) {
      skipped += 1;
      maxProcessedRow = rowNumber;
      continue;
    }

    const payload = buildPayload_(columns, spreadsheetId, sheetName, rowNumber, config, props.source);
    const result = postRowToApi_(payload, props.apiUrl, props.apiSecret);

    if (result.ok) {
      if (result.body.indexOf('"status":"created"') !== -1) {
        sent += 1;
      } else {
        skipped += 1;
      }
      Logger.log(
        '[%s row %s] ok metaLeadId=%s (%s)',
        sheetName,
        rowNumber,
        payload.metaLeadId,
        result.body
      );
    } else if (result.code === 401) {
      errors += 1;
      Logger.log(
        '[%s row %s] unauthorized — API_SECRET must match SHEETS_INGEST_SECRET',
        sheetName,
        rowNumber
      );
      break;
    } else {
      errors += 1;
      Logger.log(
        '[%s row %s] ERROR %s: %s | payload columns=%s',
        sheetName,
        rowNumber,
        result.code,
        result.body,
        JSON.stringify(payload.columns)
      );
    }

    maxProcessedRow = rowNumber;
    Utilities.sleep(200);
  }

  if (!options.forceAll) {
    setLastProcessedRow_(sheetName, maxProcessedRow);
  } else {
    setLastProcessedRow_(sheetName, lastRow);
  }

  return { sheetName: sheetName, sent: sent, skipped: skipped, errors: errors };
}

/** Creates tab + header row if missing */
function setupBulkSheetHeaders() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(BULK_SHEET_CONFIG.name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(BULK_SHEET_CONFIG.name);
  }

  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight('bold');
  Logger.log('Headers set on sheet "%s"', BULK_SHEET_CONFIG.name);
}

/** Sync only NEW rows since last run (use after pasting 10 leads) */
function syncNewBulkRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_SHEET_CONFIG.name);
  if (!sheet) {
    throw new Error('Sheet not found: ' + BULK_SHEET_CONFIG.name + ' — run setupBulkSheetHeaders first');
  }

  const result = ingestBulkSheetRows_(sheet, BULK_SHEET_CONFIG, { forceAll: false });
  Logger.log(
    'Sync done (%s): created=%s skipped=%s errors=%s',
    result.sheetName,
    result.sent,
    result.skipped,
    result.errors
  );
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Created: ' + result.sent + ', skipped: ' + result.skipped + ', errors: ' + result.errors,
    'TBF bulk sync',
    8
  );
  return result;
}

/** One-time import of all existing rows */
function syncAllHistoricalBulkRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_SHEET_CONFIG.name);
  if (!sheet) {
    throw new Error('Sheet not found: ' + BULK_SHEET_CONFIG.name);
  }
  return ingestBulkSheetRows_(sheet, BULK_SHEET_CONFIG, { forceAll: true });
}

function authorizeOnce() {
  syncNewBulkRows();
}

function resetBulkSyncPointer() {
  setLastProcessedRow_(BULK_SHEET_CONFIG.name, 1);
  Logger.log('Reset sync pointer for %s', BULK_SHEET_CONFIG.name);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TBF Leads')
    .addItem('Sync new rows to app', 'syncNewBulkRows')
    .addItem('Setup header row', 'setupBulkSheetHeaders')
    .addSeparator()
    .addItem('Sync all rows (historical)', 'syncAllHistoricalBulkRows')
    .addItem('Reset sync pointer', 'resetBulkSyncPointer')
    .addToUi();
}
