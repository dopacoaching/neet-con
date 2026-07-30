import { google } from 'googleapis';

/**
 * Two ways CareerX registrations reach the connected Google Sheet:
 *   1. appendRegistrationRow() — fires automatically the instant a new
 *      registration is created, adding just that one row.
 *   2. syncToGoogleSheet() — the admin dashboard's manual "Sync to Google
 *      Sheet" button, which brings both tabs (Registrations + Check-ins)
 *      up to date with the database. Use it to pull in check-ins (which
 *      don't auto-sync) or to backfill anything the real-time append missed.
 *
 * Both are upserts, not overwrites: each database row is matched to an
 * existing sheet row by its Registration Number (column B) and updated in
 * place, or appended if it isn't there yet. Rows/columns you add by hand in
 * the sheet are never touched — nothing is ever cleared, so manual notes,
 * extra columns, or extra rows survive every sync.
 *
 * Auth: a Google Cloud service account (not a user OAuth flow — this runs
 * unattended from the server). Share the target spreadsheet with the
 * service account's email as Editor, then set:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   the service account's client_email
 *   GOOGLE_SERVICE_ACCOUNT_KEY     its private_key (from the downloaded JSON;
 *                                  keep the \n escapes — they're unescaped below)
 *   GOOGLE_SHEET_ID                the spreadsheet ID from its URL
 *     .../spreadsheets/d/<THIS PART>/edit
 */

const isConfigured = () =>
  !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
    process.env.GOOGLE_SHEET_ID
  );

let sheetsClient = null;
const getSheetsClient = () => {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
};

/** Format a Date (or null) as a readable IST string, or '' if unset. */
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN') : '');

// Column B ("Registration Number") is the stable key both tabs are matched on.
const KEY_COLUMN_INDEX = 1;

const REGISTRATIONS_HEADER = [
  '#',
  'Registration Number',
  'Full Name',
  'Mobile Number',
  'Email',
  'DOPA / Non-DOPA',
  'Campus / Institution',
  'Batch',
  'NEET 2026 Score',
  'Passed Year (12th)',
  'Guests Accompanying',
  'Source',
  'Registration Status',
  'Reference ID',
  'Registered At',
  'Confirmed At',
  'Checked In At',
  'Checked In By',
  'Notes',
];

const registrationRow = (r, idx) => [
  idx + 1,
  r.registrationNumber || '',
  r.fullName || '',
  r.mobileNumber || '',
  r.emailAddress || '',
  r.dopaStatus || '',
  r.schoolOrCollege || '',
  r.batch || '',
  r.neetScore || '',
  r.passedYear || '',
  r.guestCount === undefined || r.guestCount === null ? '' : r.guestCount,
  r.source === 'admin_walk_in' ? 'Walk-in (Admin)' : 'Online',
  r.paymentStatus || '',
  r.orderId || '',
  fmt(r.createdAt),
  fmt(r.confirmedAt),
  fmt(r.checkedInAt),
  r.checkedInBy || '',
  r.notes || '',
];

const CHECKINS_HEADER = [
  '#',
  'Registration Number',
  'Full Name',
  'Mobile Number',
  'DOPA / Non-DOPA',
  'Campus / Institution',
  'Batch',
  'NEET 2026 Score',
  'Guests Accompanying',
  'Checked In At',
  'Checked In By',
];

const checkinRow = (r, idx) => [
  idx + 1,
  r.registrationNumber || '',
  r.fullName || '',
  r.mobileNumber || '',
  r.dopaStatus || '',
  r.schoolOrCollege || '',
  r.batch || '',
  r.neetScore || '',
  r.guestCount === undefined || r.guestCount === null ? '' : r.guestCount,
  fmt(r.checkedInAt),
  r.checkedInBy || '',
];

/** CareerX navy, matching the site's brand color. */
const HEADER_COLOR = { red: 0.02, green: 0.043, blue: 0.584 };

/** Make sure a tab exists on the spreadsheet, creating it (blank) if not. */
const ensureTab = async (sheets, spreadsheetId, tabName) => {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let sheetMeta = meta.data.sheets?.find((s) => s.properties?.title === tabName);
  if (!sheetMeta) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    sheetMeta = { properties: created.data.replies[0].addSheet.properties };
  }
  return sheetMeta;
};

/**
 * (Re)apply a bold navy header, a frozen header row, zebra-striped data rows,
 * and auto-sized columns to a tab — pure formatting, never touches cell
 * values, so it's safe to re-run on every sync.
 */
const applyFormatting = async (sheets, spreadsheetId, sheetMeta, columnCount, rowCount) => {
  const sheetId = sheetMeta.properties.sheetId;
  const existingBandId = sheetMeta.bandedRanges?.[0]?.bandedRangeId;

  const requests = [
    // Freeze the header row so it stays visible while scrolling.
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Bold, white-on-navy header text, vertically centered.
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_COLOR,
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
      },
    },
    // Auto-size every column to fit its content.
    {
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: columnCount },
      },
    },
  ];

  // Zebra-stripe the data rows. If a band already exists on this tab from a
  // prior sync, resize it to match the current row count instead of adding a
  // second one on top of it.
  if (rowCount > 1) {
    const bandedRange = {
      ...(existingBandId ? { bandedRangeId: existingBandId } : {}),
      range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount },
      rowProperties: {
        headerColor: HEADER_COLOR,
        firstBandColor: { red: 1, green: 1, blue: 1 },
        secondBandColor: { red: 0.945, green: 0.949, blue: 0.973 },
      },
    };
    requests.push(
      existingBandId
        ? { updateBanding: { bandedRange, fields: 'range,rowProperties' } }
        : { addBanding: { bandedRange } }
    );
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
};

/**
 * Bring a tab's data up to date without ever clearing it: each incoming row
 * is matched to an existing sheet row by its key column (Registration
 * Number) and updated in place; rows with no match are appended after the
 * last existing row. Any manually-added rows, extra columns, or formatting
 * are left completely alone.
 */
const upsertTab = async (sheets, spreadsheetId, tabName, header, dataRows) => {
  const sheetMeta = await ensureTab(sheets, spreadsheetId, tabName);

  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A:Z` });
  const existingValues = existing.data.values || [];

  // Brand new tab — nothing to preserve, write header + all rows in one shot.
  if (existingValues.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [header, ...dataRows] },
    });
    await applyFormatting(sheets, spreadsheetId, sheetMeta, header.length, dataRows.length + 1);
    return;
  }

  // Keep the header row current (cheap, harmless if unchanged).
  const valueData = [{ range: `${tabName}!A1`, values: [header] }];

  // Map each existing row's key (Registration Number) to its sheet row number.
  const keyToRowNumber = new Map();
  existingValues.forEach((row, i) => {
    if (i === 0) return; // header
    const key = row[KEY_COLUMN_INDEX];
    if (key) keyToRowNumber.set(String(key), i + 1); // 1-based sheet row number
  });

  let nextNewRowNumber = existingValues.length + 1;
  dataRows.forEach((row) => {
    const key = String(row[KEY_COLUMN_INDEX]);
    const rowNumber = keyToRowNumber.get(key) || nextNewRowNumber++;
    valueData.push({ range: `${tabName}!A${rowNumber}`, values: [row] });
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data: valueData },
  });

  const totalRows = Math.max(existingValues.length, nextNewRowNumber - 1);
  await applyFormatting(sheets, spreadsheetId, sheetMeta, header.length, totalRows);
};

/**
 * Sync CareerX registrations + check-ins into two tabs of one spreadsheet.
 * Upserts by Registration Number — never clears the sheet, so any manual
 * edits, notes, or extra rows/columns you've added stay put.
 * @param {Array<object>} registrations  all registrations (lean docs)
 * @param {Array<object>} checkIns       checked-in registrations (lean docs)
 * @returns {Promise<{ sheetUrl: string }>}
 */
export const syncToGoogleSheet = async (registrations, checkIns) => {
  if (!isConfigured()) {
    throw new Error(
      'Google Sheets sync is not configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, and GOOGLE_SHEET_ID.'
    );
  }
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  await upsertTab(sheets, spreadsheetId, 'Registrations', REGISTRATIONS_HEADER, registrations.map(registrationRow));
  await upsertTab(sheets, spreadsheetId, 'Check-ins', CHECKINS_HEADER, checkIns.map(checkinRow));

  return { sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
};

/**
 * Add (or, if it somehow already exists, update) a single registration in
 * the "Registrations" tab — called fire-and-forget right after a
 * registration is saved, the same way the WhatsApp/email confirmations are,
 * so a slow or failing Sheets API call never delays or breaks the
 * registration response.
 *
 * Silently no-ops if Sheets isn't configured yet (rather than throwing),
 * since this runs unattended on the critical registration path.
 * @param {object} registration  a registration doc (Mongoose doc or lean object)
 */
export const appendRegistrationRow = async (registration) => {
  if (!isConfigured()) return;

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // "#" just needs to keep counting up from whatever's already in the sheet
  // (including any manually-added rows) — it's a display sequence, not a key.
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Registrations!A:A',
  });
  const idx = Math.max((existing.data.values?.length || 1) - 1, 0);

  await upsertTab(sheets, spreadsheetId, 'Registrations', REGISTRATIONS_HEADER, [
    registrationRow(registration, idx),
  ]);
};

export default syncToGoogleSheet;
