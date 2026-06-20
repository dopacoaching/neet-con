import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import StatusBadge from './StatusBadge.jsx';
import { adminUpdateStatus } from '../../services/api.js';
import { Spinner } from '../ui/PageLoader.jsx';

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-navy/50">{label}</p>
    <p className="mt-0.5 font-medium text-navy">{value || '—'}</p>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-navy/10 p-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-navy">{r.fullName}</h2>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={r.paymentStatus} />
              {r.registrationNumber && (
                <span className="text-sm text-navy/60">{r.registrationNumber}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-navy/50 hover:bg-navy/5 hover:text-navy"
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
            <Field label="Amount" value={`₹${r.amount}`} />
          </div>

          <div className="rounded-xl bg-navy/5 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/60">
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
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label" htmlFor="notes">
              Internal notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className="input-field resize-none"
              placeholder="Add a private note (visible to admins only)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isAdminRole}
            />
            {!isAdminRole && (
              <p className="mt-1 text-xs text-navy/50">Viewer role — read only.</p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        {isAdminRole && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-navy/10 p-5">
            <button onClick={() => save()} className="btn-ghost !py-2.5" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4 border-navy/40 border-t-navy" /> : 'Save notes'}
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
                className="rounded-xl border border-red-300 px-5 py-2.5 font-semibold text-red-600 hover:bg-red-50"
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
