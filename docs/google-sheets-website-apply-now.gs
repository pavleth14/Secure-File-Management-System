/**
 * Apply Now spreadsheet → TBF API (website form submissions).
 *
 * Flow: website POST → doPost → append row to sheet → POST /api/recruiting/sheets/ingest
 *
 * Spreadsheet: "Apply Now"
 * Tab: "Leads 2026"
 *
 * Setup:
 * 1. Extensions → Apps Script in the Apply Now spreadsheet
 * 2. Project Settings → Script properties:
 *    WEBSITE_API_URL = https://api.twobrothersfreight.com/api/recruiting/sheets/ingest
 *    WEBSITE_API_SECRET = same value as SHEETS_INGEST_SECRET on the server
 * 3. Paste this file, Save
 * 4. Run testPostWebsiteLeadToTbfApi once (authorize external requests)
 * 5. Deploy → Web app (Execute as: Me, Anyone) — redeploy after code changes
 *
 * Facebook leads use a separate spreadsheet (TBF_LEADS) — see google-sheets-sync.gs
 */

const SPREADSHEET_ID = '1RSUuAI-DPQYztUi9v3BWs2zwEL9O9PaeFX586MrbV4Y';
const SHEET_NAME = 'Leads 2026';

function getWebsiteApiConfig_() {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('WEBSITE_API_URL');
  const apiSecret = props.getProperty('WEBSITE_API_SECRET');

  if (!apiUrl || !apiSecret) {
    throw new Error('Set WEBSITE_API_URL and WEBSITE_API_SECRET in Script Properties');
  }

  return { apiUrl, apiSecret };
}

function mapPositionToDriverType_(position) {
  const value = String(position || '').trim().toLowerCase();

  if (value === 'company' || value.includes('solo')) return 'Solo';
  if (value.includes('owner')) return 'Owner Operator';
  if (value.includes('team')) return 'Team';
  if (value.includes('local')) return 'Local';

  return 'Solo';
}

function postWebsiteLeadToTbfApi_(data, rowNumber) {
  const { apiUrl, apiSecret } = getWebsiteApiConfig_();
  const submittedAt = new Date();

  const payload = {
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    rowNumber: rowNumber,
    metaLeadId: 'website-' + Utilities.getUuid(),
    driverType: mapPositionToDriverType_(data.position),
    source: 'Website',
    columns: {
      first_name: data.firstName || '',
      last_name: data.lastName || '',
      email: data.email || '',
      phone_number: data.phone || '',
      created_time: submittedAt.toISOString(),
    },
    extraFields: {
      position: data.position || '',
      cdl_experience: data.cdlExperience || '',
      cdl_license: data.cdlLicense || '',
      message: data.message || '',
      email_consent: data.emailConsent ? 'Yes' : 'No',
      sms_consent: data.smsConsent ? 'Yes' : 'No',
    },
  };

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

  if (code < 200 || code >= 300) {
    throw new Error('TBF API ' + code + ': ' + body);
  }

  return JSON.parse(body);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const sheet = SpreadsheetApp
      .openById(SPREADSHEET_ID)
      .getSheetByName(SHEET_NAME);

    const submittedAt = new Date();

    sheet.appendRow([
      submittedAt,
      data.firstName || '',
      data.lastName || '',
      data.email || '',
      data.phone || '',
      data.position || '',
      data.cdlExperience || '',
      data.cdlLicense || '',
      data.message || '',
      data.emailConsent ? 'Yes' : 'No',
      data.smsConsent ? 'Yes' : 'No',
    ]);

    const rowNumber = sheet.getLastRow();
    let tbfResult = null;
    let tbfError = null;

    try {
      if (data.firstName && data.lastName && data.email && data.phone) {
        tbfResult = postWebsiteLeadToTbfApi_(data, rowNumber);
      } else {
        tbfError = 'Missing firstName, lastName, email, or phone for TBF API';
        Logger.log(tbfError);
      }
    } catch (apiErr) {
      tbfError = apiErr.message || String(apiErr);
      Logger.log('TBF ingest failed row %s: %s', rowNumber, tbfError);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        sheetRow: rowNumber,
        tbfIngest: tbfResult
          ? { ok: true, result: tbfResult }
          : { ok: false, error: tbfError },
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Manual test — Run in Apps Script editor */
function testPostWebsiteLeadToTbfApi() {
  const sample = {
    firstName: 'Test',
    lastName: 'Website',
    email: 'test.website+' + Date.now() + '@example.com',
    phone: '555-0100',
    position: 'company',
    cdlExperience: '3-5',
    cdlLicense: 'yes',
    message: 'Test from Apps Script',
    emailConsent: true,
    smsConsent: false,
  };

  const result = postWebsiteLeadToTbfApi_(sample, 9999);
  Logger.log(JSON.stringify(result, null, 2));
}
