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

/**
 * Overwrite a single tab with a header row + data rows. Creates the tab if
 * it doesn't already exist on the spreadsheet.
 */
const writeTab = async (sheets, spreadsheetId, tabName, rows) => {
  // Make sure the tab exists (no-op if it's already there).
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tabName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
  }

  // Clear the tab, then write fresh — never appends, so re-syncing can't duplicate.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
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
