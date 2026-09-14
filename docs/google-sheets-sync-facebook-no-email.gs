/**
 * Facebook Lead Ads (NO EMAIL form) → TBF recruiting app
 *
 * Use this on a SEPARATE Google Spreadsheet from TBF_LEADS (the 4-tab email forms).
 * Meta form example: "08/09/26_OTR_no email"
 *
 * Expected columns (Meta export — email column NOT required):
 *   id, created_time, first_name, last_name, phone_number,
 *   what's_the_best_number_we_can_reach_you_at?, state, + ad/campaign fields
 *
 * Phone rule:
 *   1) phone_number (e.g. p:+13127248034)
 *   2) fallback → what's_the_best_number_we_can_reach_you_at?
 *
 * Setup:
 * 1. Extensions → Apps Script on THIS spreadsheet (Sheet2 / no-email form)
 * 2. Paste this entire file, Save
 * 3. Project Settings → Script properties:
 *      API_URL    = https://api.twobrothersfreight.com/api/recruiting/sheets/ingest
 *      API_SECRET = same as SHEETS_INGEST_SECRET on the server
 * 4. Edit SHEET_CONFIG below — set `name` to your tab name (run listSheetTabNames if unsure)
 * 5. Run authorizeOnce (grants UrlFetch)
 * 6. Run syncAllHistoricalRows once for existing rows
 * 7. Add time trigger: syncNewSheetRows every 5 minutes
 *
 * Original 4-tab email forms: docs/google-sheets-sync.gs on TBF_LEADS spreadsheet
 */

/** Change `name` to match the tab Meta writes to (bottom sheet tab label). */
const SHEET_CONFIG = [
  { name: 'Sheet1', driverType: 'Solo' },
  // Add more tabs if needed, e.g.:
  // { name: 'tbf_form_no_email', driverType: 'Solo' },
];

/**
 * Kolone koje idu u API payload.columns (glavna polja leada).
 * NISU sva obavezna — ovo nije lista required polja.
 * Email namerno nije ovde: ova forma nema email kolonu; server dodeljuje N/A.
 */
const CORE_FIELDS = new Set([
  'first_name',
  'last_name',
  'phone_number',
  'state',
  'created_time',
]);

const PHONE_FALLBACK_HEADER_KEYS = [
  "what's_the_best_number_we_can_reach_you_at",
  'whats_the_best_number_we_can_reach_you_at',
];

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
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
  return { apiUrl: apiUrl, apiSecret: apiSecret };
}

function lastRowKey_(sheetName) {
  return 'NO_EMAIL_LAST_ROW_' + sheetName;
}

function getLastProcessedRow_(sheetName) {
  const raw = PropertiesService.getScriptProperties().getProperty(lastRowKey_(sheetName));
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function setLastProcessedRow_(sheetName, rowNumber) {
  PropertiesService.getScriptProperties().setProperty(lastRowKey_(sheetName), String(rowNumber));
}

function cleanPhoneValue_(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';

  raw = raw.replace(/^p:/i, '').trim();
  raw = raw.replace(/^['"]+|['"]+$/g, '').trim();

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.round(value));
  }

  return raw;
}

function resolvePhoneNumber_(columns) {
  const primary = cleanPhoneValue_(columns.phone_number || columns.phone);
  if (primary) return primary;

  for (let i = 0; i < PHONE_FALLBACK_HEADER_KEYS.length; i += 1) {
    const fallback = cleanPhoneValue_(columns[PHONE_FALLBACK_HEADER_KEYS[i]]);
    if (fallback) return fallback;
  }

  const keys = Object.keys(columns);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (key.indexOf('best_number') !== -1) {
      const fallback = cleanPhoneValue_(columns[key]);
      if (fallback) return fallback;
    }
  }

  return '';
}

function normalizeCellValue_(key, value) {
  if (value === null || value === undefined || value === '') return null;

  if (key === 'phone_number' || key === 'phone') {
    return cleanPhoneValue_(value);
  }

  if (
    PHONE_FALLBACK_HEADER_KEYS.indexOf(key) !== -1 ||
    key.indexOf('best_number') !== -1
  ) {
    return cleanPhoneValue_(value);
  }

  return String(value).trim();
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

  return obj;
}

function validateRow_(columns, sheetName, rowNumber) {
  if (!columns.id) {
    Logger.log('[%s row %s] missing id, skipping', sheetName, rowNumber);
    return false;
  }

  if (!String(columns.first_name || '').trim() || !String(columns.last_name || '').trim()) {
    Logger.log('[%s row %s] missing first_name/last_name, skipping', sheetName, rowNumber);
    return false;
  }

  const phone = resolvePhoneNumber_(columns);
  if (!phone) {
    Logger.log('[%s row %s] missing phone_number and fallback phone, skipping', sheetName, rowNumber);
    return false;
  }

  columns.phone_number = phone;
  return true;
}

function buildCoreAndExtra_(columns) {
  const core = {};
  const extraFields = {};

  Object.keys(columns).forEach(function (key) {
    if (CORE_FIELDS.has(key)) {
      core[key] = columns[key];
    } else {
      extraFields[key] = columns[key];
    }
  });

  core.phone_number = columns.phone_number;

  return { core: core, extraFields: extraFields };
}

function classifyApiResult_(result) {
  if (!result.ok) {
    if (result.code === 401) {
      return 'unauthorized';
    }
    if (result.code === 409) {
      return 'skipped';
    }
    if (result.body && result.body.indexOf('skipped') !== -1) {
      return 'skipped';
    }
    if (result.body && result.body.indexOf('already') !== -1) {
      return 'skipped';
    }
    return 'error';
  }

  if (result.body && result.body.indexOf('"status":"created"') !== -1) {
    return 'created';
  }

  return 'skipped';
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

function ingestSheetRows_(sheet, config, options) {
  const props = getProps_();
  const apiUrl = props.apiUrl;
  const apiSecret = props.apiSecret;
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

  for (let rowNumber = startRow; rowNumber <= lastRow; rowNumber++) {
    const rowValues = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];

    const isEmpty = rowValues.every(function (v) {
      return v === '' || v === null || v === undefined;
    });
    if (isEmpty) {
      maxProcessedRow = rowNumber;
      continue;
    }

    const columns = rowToObject_(headers, rowValues);

    if (!validateRow_(columns, sheetName, rowNumber)) {
      skipped += 1;
      maxProcessedRow = rowNumber;
      continue;
    }

    const built = buildCoreAndExtra_(columns);

    const payload = {
      spreadsheetId: spreadsheetId,
      sheetName: sheetName,
      rowNumber: rowNumber,
      metaLeadId: columns.id,
      driverType: config.driverType,
      source: 'Facebook',
      columns: built.core,
      extraFields: built.extraFields,
    };

    const result = postRowToApi_(payload, apiUrl, apiSecret);
    const outcome = classifyApiResult_(result);

    if (outcome === 'created') {
      sent += 1;
      Logger.log('[%s row %s] created metaLeadId=%s', sheetName, rowNumber, columns.id);
    } else if (outcome === 'skipped') {
      skipped += 1;
      Logger.log('[%s row %s] skipped metaLeadId=%s (%s)', sheetName, rowNumber, columns.id, result.body);
    } else if (outcome === 'unauthorized') {
      errors += 1;
      Logger.log(
        '[%s row %s] unauthorized — check API_SECRET matches SHEETS_INGEST_SECRET',
        sheetName,
        rowNumber
      );
      break;
    } else {
      errors += 1;
      Logger.log('[%s row %s] ERROR %s: %s', sheetName, rowNumber, result.code, result.body);
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

function syncNewSheetRows() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let totalSent = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  SHEET_CONFIG.forEach(function (config) {
    const sheet = spreadsheet.getSheetByName(config.name);
    if (!sheet) {
      Logger.log('Sheet not found: %s — run listSheetTabNames and update SHEET_CONFIG', config.name);
      return;
    }

    const result = ingestSheetRows_(sheet, config, { forceAll: false });
    totalSent += result.sent;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  });

  Logger.log('Sync done. created=%s skipped=%s errors=%s', totalSent, totalSkipped, totalErrors);
  spreadsheet.toast(
    'Created: ' + totalSent + ', skipped: ' + totalSkipped + ', errors: ' + totalErrors,
    'TBF Facebook (no email)',
    8
  );
}

function syncAllHistoricalRows() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  SHEET_CONFIG.forEach(function (config) {
    const sheet = spreadsheet.getSheetByName(config.name);
    if (!sheet) {
      Logger.log('Sheet not found: %s', config.name);
      return;
    }
    const result = ingestSheetRows_(sheet, config, { forceAll: true });
    Logger.log(
      'Historical %s: created=%s skipped=%s errors=%s',
      config.name,
      result.sent,
      result.skipped,
      result.errors
    );
  });
}

function testSendLastRow() {
  const config = SHEET_CONFIG[0];
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(config.name);
  if (!sheet) {
    throw new Error('Sheet not found: ' + config.name + ' — update SHEET_CONFIG.name');
  }

  const lastRow = sheet.getLastRow();
  const saved = getLastProcessedRow_(config.name);
  setLastProcessedRow_(config.name, lastRow - 1);
  ingestSheetRows_(sheet, config, { forceAll: false });
  if (saved > 0) {
    setLastProcessedRow_(config.name, saved);
  }
}

function authorizeOnce() {
  syncNewSheetRows();
}

function resetSyncPointer() {
  SHEET_CONFIG.forEach(function (config) {
    setLastProcessedRow_(config.name, 1);
    Logger.log('Reset sync pointer for %s', config.name);
  });
}

/** Run once — logs tab names so you can set SHEET_CONFIG.name correctly */
function listSheetTabNames() {
  const names = SpreadsheetApp.getActiveSpreadsheet()
    .getSheets()
    .map(function (sheet) {
      return sheet.getName();
    });
  Logger.log('Tab names in this spreadsheet: %s', names.join(', '));
  SpreadsheetApp.getActiveSpreadsheet().toast('Tab names: ' + names.join(', '), 'TBF', 10);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TBF Facebook')
    .addItem('Sync new rows to app', 'syncNewSheetRows')
    .addSeparator()
    .addItem('Sync all rows (historical)', 'syncAllHistoricalRows')
    .addItem('Test last row only', 'testSendLastRow')
    .addItem('List tab names', 'listSheetTabNames')
    .addItem('Reset sync pointer', 'resetSyncPointer')
    .addToUi();
}
