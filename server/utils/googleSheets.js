import { google } from 'googleapis';

/**
 * Two ways CareerX registrations reach the connected Google Sheet:
 *   1. appendRegistrationRow() — fires automatically the instant a new
 *      registration is created, adding just that one row.
 *   2. syncToGoogleSheet() — the admin dashboard's manual "Sync to Google
 *      Sheet" button, which fully overwrites both tabs (Registrations +
 *      Check-ins) from the database. Use it to pull in check-ins (which
 *      don't auto-sync) or to repair the sheet if it ever drifts.
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
 * and auto-sized columns to a tab — done via the spreadsheet API's cell
 * formatting, not by writing "styled" values, so it survives every
 * clear+rewrite or append.
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
 * Overwrite a single tab with a header row + data rows. Creates the tab if
 * it doesn't already exist on the spreadsheet.
 */
const writeTab = async (sheets, spreadsheetId, tabName, rows) => {
  const sheetMeta = await ensureTab(sheets, spreadsheetId, tabName);

  // Clear the tab, then write fresh — never appends, so re-syncing can't duplicate.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });

  await applyFormatting(sheets, spreadsheetId, sheetMeta, rows[0]?.length || 1, rows.length);
};

/**
 * Sync CareerX registrations + check-ins into two tabs of one spreadsheet.
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

  await writeTab(sheets, spreadsheetId, 'Registrations', [
    REGISTRATIONS_HEADER,
    ...registrations.map(registrationRow),
  ]);
  await writeTab(sheets, spreadsheetId, 'Check-ins', [
    CHECKINS_HEADER,
    ...checkIns.map(checkinRow),
  ]);

  return { sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
};

/**
 * Append a single newly-created registration to the "Registrations" tab as
 * it happens — called fire-and-forget right after a registration is saved,
 * the same way the WhatsApp/email confirmations are, so a slow or failing
 * Sheets API call never delays or breaks the registration response.
 *
 * Silently no-ops if Sheets isn't configured yet (rather than throwing),
 * since this runs unattended on the critical registration path.
 * @param {object} registration  a registration doc (Mongoose doc or lean object)
 */
export const appendRegistrationRow = async (registration) => {
  if (!isConfigured()) return;

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = 'Registrations';

  const sheetMeta = await ensureTab(sheets, spreadsheetId, tabName);

  // How many rows are already there (header included), so the new row gets
  // the right running "#" and the banding range can be extended to cover it.
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A:A` });
  const existingRowCount = existing.data.values?.length || 0;
  const isFirstWrite = existingRowCount === 0;
  const idx = isFirstWrite ? 0 : existingRowCount - 1; // header doesn't count as a data row

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: isFirstWrite
        ? [REGISTRATIONS_HEADER, registrationRow(registration, idx)]
        : [registrationRow(registration, idx)],
    },
  });

  const newRowCount = isFirstWrite ? 2 : existingRowCount + 1;
  await applyFormatting(sheets, spreadsheetId, sheetMeta, REGISTRATIONS_HEADER.length, newRowCount);
};

export default syncToGoogleSheet;
