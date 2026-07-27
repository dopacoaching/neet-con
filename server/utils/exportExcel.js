import xlsx from 'xlsx';

/**
 * Build an .xlsx workbook buffer from registration documents.
 * @param {Array<object>} registrations  Mongoose docs or plain objects
 * @returns {Buffer}
 */
export const buildRegistrationsWorkbook = (registrations) => {
  const rows = registrations.map((r, idx) => ({
    '#': idx + 1,
    'Registration Number': r.registrationNumber || '',
    'Full Name': r.fullName || '',
    'Mobile Number': r.mobileNumber || '',
    'Email': r.emailAddress || '',
    'DOPA / Non-DOPA': r.dopaStatus || '',
    'Campus / Institution': r.schoolOrCollege || '',
    'Batch': r.batch || '',
    'NEET 2026 Score': r.neetScore || '',
    'Passed Year (12th)': r.passedYear || '',
    'Guests Accompanying': r.guestCount ?? 0,
    'Source': r.source === 'admin_walk_in' ? 'Walk-in (Admin)' : 'Online',
    'Remarks': r.remarks || '',
    'Registration Status': r.paymentStatus || '',
    'Reference ID': r.orderId || '',
    'Registered At': r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '',
    'Confirmed At': r.confirmedAt ? new Date(r.confirmedAt).toLocaleString('en-IN') : '',
    'Manually Confirmed By': r.manuallyConfirmedBy || '',
    'Checked In At': r.checkedInAt ? new Date(r.checkedInAt).toLocaleString('en-IN') : '',
    'Checked In By': r.checkedInBy || '',
    'Notes': r.notes || '',
  }));

  const worksheet = xlsx.utils.json_to_sheet(rows);

  // Reasonable column widths.
  worksheet['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 26 }, // # .. Email
    { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, // DOPA .. Guests
    { wch: 16 }, { wch: 30 }, // Source, Remarks
    { wch: 18 }, { wch: 26 }, // Registration Status, Reference ID
    { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 30 }, // Registered .. Notes
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Build an .xlsx workbook of everyone checked in so far (gate roster).
 * @param {Array<object>} registrations  Mongoose docs or plain objects, all with checkedInAt set
 * @returns {Buffer}
 */
export const buildCheckInsWorkbook = (registrations) => {
  const rows = registrations.map((r, idx) => ({
    '#': idx + 1,
    'Registration Number': r.registrationNumber || '',
    'Full Name': r.fullName || '',
    'Mobile Number': r.mobileNumber || '',
    'DOPA / Non-DOPA': r.dopaStatus || '',
    'Campus / Institution': r.schoolOrCollege || '',
    'Batch': r.batch || '',
    'NEET 2026 Score': r.neetScore || '',
    'Guests Accompanying': r.guestCount ?? 0,
    'Checked In At': r.checkedInAt ? new Date(r.checkedInAt).toLocaleString('en-IN') : '',
    'Checked In By': r.checkedInBy || '',
  }));

  const worksheet = xlsx.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 24 }, { wch: 14 },
    { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 18 },
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Check-ins');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};
