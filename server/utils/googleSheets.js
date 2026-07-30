import { google } from 'googleapis';

/**
 * Push the current CareerX roster into a Google Sheet on demand — the same
 * trigger as the old "Export to Excel" button, but writing into a live,
 * shareable sheet instead of downloading a file.
 *
 * Auth: a Google Cloud service account (not a user OAuth flow — this runs
 * unattended from a server button click). Share the target spreadsheet with
 * the service account's email as Editor, then set:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   the service account's client_email
 *   GOOGLE_SERVICE_ACCOUNT_KEY     its private_key (from the downloaded JSON;
 *                                  keep the \n escapes — they're unescaped below)
 *   GOOGLE_SHEET_ID                the spreadsheet ID from its URL
 *     .../spreadsheets/d/<THIS PART>/edit
 *
 * Each sync fully overwrites the target tab (clear + rewrite) rather than
 * appending, so re-running it never duplicates rows — the sheet always
 * mirrors the database exactly at sync time.
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

/**
 * Overwrite a single tab with a header row + data rows. Creates the tab if
 * it doesn't already exist on the spreadsheet, and (re)applies a bold navy
 * header, a frozen header row, zebra-striped data rows, and auto-sized
 * columns — done via the spreadsheet API's cell formatting, not by writing
 * "styled" values, so it survives the clear+rewrite on every sync.
 */
const writeTab = async (sheets, spreadsheetId, tabName, rows) => {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let sheetMeta = meta.data.sheets?.find((s) => s.properties?.title === tabName);

  if (!sheetMeta) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    sheetMeta = { properties: created.data.replies[0].addSheet.properties };
  }
  const sheetId = sheetMeta.properties.sheetId;

  // Clear the tab, then write fresh — never appends, so re-syncing can't duplicate.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });

  const columnCount = rows[0]?.length || 1;
  const rowCount = rows.length;
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

export default syncToGoogleSheet;
