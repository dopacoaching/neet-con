import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import StatusBadge from './StatusBadge.jsx';
import { adminUpdateStatus } from '../../services/api.js';
import { Spinner } from '../ui/PageLoader.jsx';

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
    <p className="mt-0.5 font-medium text-white">{value || '—'}</p>
  </div>
);

/**
 * Detail + edit modal. Admin-role users can change status and edit notes.
 */
const RegistrationDetailModal = ({ registration, isAdminRole, onClose, onUpdated }) => {
  const [notes, setNotes] = useState(registration?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(registration?.notes || '');
  }, [registration]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!registration) return null;

  const r = registration;

  const save = async (statusOverride) => {
    if (statusOverride === 'MANUAL') {
      const ok = window.confirm(
        `Manually CONFIRM this registration for ${r.fullName}?\n\nThis books a seat and generates a registration number. This action is logged against your username.`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const payload = { notes };
      if (statusOverride) payload.status = statusOverride;
      const updated = await adminUpdateStatus(r._id, payload);
      toast.success(statusOverride ? 'Status updated' : 'Notes saved');
      onUpdated(updated);
    } catch (err) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const isConfirmed = r.paymentStatus === 'CONFIRMED' || r.paymentStatus === 'MANUAL';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1430] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-white">{r.fullName}</h2>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={r.paymentStatus} />
              {r.registrationNumber && (
                <span className="text-sm text-accent">{r.registrationNumber}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mobile" value={r.mobileNumber} />
            <Field label="Email" value={r.emailAddress} />
            <Field label="School / College" value={r.schoolOrCollege} />
            <Field label="Year of 12th" value={r.passedYear} />
            <Field label="Preparing For" value={r.preparingFor} />
            <Field label="Guests Accompanying" value={r.guestCount > 0 ? r.guestCount : 'None'} />
            <Field label="Amount" value={`₹${r.amount}`} />
          </div>

          {/* Free (Google Form / DOPA student) details */}
          {r.source === 'google_form' && (
            <div className="rounded-xl bg-violet-500/10 p-4 ring-1 ring-violet-400/20">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-300">
                DOPA student (Google Form)
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="District / Place" value={r.district} />
                <Field label="Current Status" value={r.currentStatus} />
                <Field label="Expected NEET Score" value={r.expectedScore} />
                {r.remarks && <Field label="Remarks" value={r.remarks} />}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-white/5 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
              Payment details
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Order ID" value={r.orderId} />
              <Field label="HDFC Txn ID" value={r.hdfc_txn_id} />
              <Field label="Attempts" value={String(r.paymentAttempts ?? 0)} />
              <Field
                label="Confirmed At"
                value={r.confirmedAt ? format(new Date(r.confirmedAt), 'dd MMM yyyy, h:mm a') : '—'}
              />
              {r.manuallyConfirmedBy && (
                <Field label="Manually confirmed by" value={r.manuallyConfirmedBy} />
              )}
              <Field
                label="Registered At"
                value={r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy, h:mm a') : '—'}
              />
              <Field
                label="Checked In"
                value={
                  r.checkedInAt
                    ? `${format(new Date(r.checkedInAt), 'dd MMM yyyy, h:mm a')}${
                        r.checkedInBy ? ` · ${r.checkedInBy}` : ''
                      }`
                    : 'Not yet'
                }
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-white/80" htmlFor="notes">
              Internal notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className="input-dark resize-none"
              placeholder="Add a private note (visible to admins only)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isAdminRole}
            />
            {!isAdminRole && (
              <p className="mt-1 text-xs text-white/40">Viewer role — read only.</p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        {isAdminRole && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 p-5">
            <button onClick={() => save()} className="btn-ghost-dark !py-2.5" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Save notes'}
            </button>
            {!isConfirmed && (
              <button
                onClick={() => save('MANUAL')}
                className="btn-primary !py-2.5"
                disabled={saving}
              >
                Manually Confirm
              </button>
            )}
            {r.paymentStatus !== 'FAILED' && !isConfirmed && (
              <button
                onClick={() => save('FAILED')}
                className="rounded-xl border border-red-400/40 px-5 py-2.5 font-semibold text-red-300 transition hover:bg-red-500/10"
                disabled={saving}
              >
                Mark Failed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationDetailModal;
