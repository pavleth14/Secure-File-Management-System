/**
 * Google Sheets → TBF API sync (append-only).
 *
 * Setup:
 * 1. Extensions → Apps Script in the spreadsheet
 * 2. Project Settings → Script properties:
 *    API_URL = https://api.twobrothersfreight.com/api/recruiting/sheets/ingest
 *    API_SECRET = same value as SHEETS_INGEST_SECRET on the server
 * 3. Run authorizeOnce, then syncAllHistoricalRows once
 * 4. Add time trigger for syncNewSheetRows every 5 minutes
 */

const SHEET_CONFIG = [
  { name: 'tbf_form_company', driverType: 'Solo' },
  { name: 'tbf_form_owner', driverType: 'Owner Operator' },
  { name: 'tbf_form_team', driverType: 'Team' },
  { name: 'tbf_form_local', driverType: 'Local' },
];

const CORE_FIELDS = new Set([
  'first_name',
  'last_name',
  'phone_number',
  'email',
  'state',
  'created_time',
]);

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
  return { apiUrl, apiSecret };
}

function lastRowKey_(sheetName) {
  return 'LAST_ROW_' + sheetName;
}

function getLastProcessedRow_(sheetName) {
  const raw = PropertiesService.getScriptProperties().getProperty(lastRowKey_(sheetName));
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function setLastProcessedRow_(sheetName, rowNumber) {
  PropertiesService.getScriptProperties().setProperty(lastRowKey_(sheetName), String(rowNumber));
}

function rowToObject_(headers, rowValues) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    if (!key) continue;
    const value = rowValues[i];
    if (value === '' || value === null || value === undefined) continue;
    obj[key] = String(value).trim();
  }
  return obj;
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
    return { ok: true, code, body };
  }

  return { ok: false, code, body };
}

function ingestSheetRows_(sheet, config, options) {
  const { apiUrl, apiSecret } = getProps_();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheetId = spreadsheet.getId();
  const sheetName = config.name;

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { sheetName, sent: 0, skipped: 0, errors: 0 };
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

    if (!columns.id) {
      Logger.log('[%s row %s] missing id, skipping', sheetName, rowNumber);
      skipped += 1;
      maxProcessedRow = rowNumber;
      continue;
    }

    if (!columns.email || !columns.phone_number) {
      Logger.log('[%s row %s] missing email/phone, skipping', sheetName, rowNumber);
      skipped += 1;
      maxProcessedRow = rowNumber;
      continue;
    }

    const core = {};
    const extraFields = {};

    Object.keys(columns).forEach(function (key) {
      if (CORE_FIELDS.has(key)) {
        core[key] = columns[key];
      } else {
        extraFields[key] = columns[key];
      }
    });

    const payload = {
      spreadsheetId: spreadsheetId,
      sheetName: sheetName,
      rowNumber: rowNumber,
      metaLeadId: columns.id,
      driverType: config.driverType,
      source: 'Facebook',
      columns: core,
      extraFields: extraFields,
    };

    const result = postRowToApi_(payload, apiUrl, apiSecret);

    if (result.ok) {
      if (result.body.indexOf('"status":"created"') !== -1) {
        sent += 1;
      } else {
        skipped += 1;
      }
      Logger.log('[%s row %s] ok metaLeadId=%s (%s)', sheetName, rowNumber, columns.id, result.body);
    } else if (result.code === 401) {
      errors += 1;
      Logger.log('[%s row %s] unauthorized — check API_SECRET matches SHEETS_INGEST_SECRET', sheetName, rowNumber);
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
      Logger.log('Sheet not found: %s', config.name);
      return;
    }

    const result = ingestSheetRows_(sheet, config, { forceAll: false });
    totalSent += result.sent;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  });

  Logger.log('Sync done. sent=%s skipped=%s errors=%s', totalSent, totalSkipped, totalErrors);
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
      'Historical %s: sent=%s skipped=%s errors=%s',
      config.name,
      result.sent,
      result.skipped,
      result.errors
    );
  });
}

function testSendLastCompanyRow() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('tbf_form_company');
  if (!sheet) throw new Error('Sheet tbf_form_company not found');

  const lastRow = sheet.getLastRow();
  const config = SHEET_CONFIG[0];
  const saved = getLastProcessedRow_(config.name);
  setLastProcessedRow_(config.name, lastRow - 1);
  ingestSheetRows_(sheet, config, { forceAll: false });
  if (saved > 0) setLastProcessedRow_(config.name, saved);
}

function authorizeOnce() {
  syncNewSheetRows();
}
