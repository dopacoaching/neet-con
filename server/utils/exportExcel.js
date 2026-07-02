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
    'School / College': r.schoolOrCollege || '',
    'Passed Year (12th)': r.passedYear || '',
    'Preparing For': r.preparingFor || '',
    'Source': r.source === 'google_form' ? 'Google Form (DOPA)' : 'Online',
    'District / Place': r.district || '',
    'Current Status': r.currentStatus || '',
    'Expected Score': r.expectedScore || '',
    'Remarks': r.remarks || '',
    'Payment Status': r.paymentStatus || '',
    'Amount (INR)': r.amount ?? '',
    'Order ID': r.orderId || '',
    'HDFC Txn ID': r.hdfc_txn_id || '',
    'Payment Attempts': r.paymentAttempts ?? 0,
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
    { wch: 28 }, { wch: 16 }, { wch: 14 }, // School, Passed Year, Preparing For
    { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, // Source, District, Current Status, Expected Score, Remarks
    { wch: 15 }, { wch: 12 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, // Payment Status .. Attempts
    { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 30 }, // Registered .. Notes
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};
