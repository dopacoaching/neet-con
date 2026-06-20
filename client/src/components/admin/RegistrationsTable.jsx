import { format } from 'date-fns';
import StatusBadge from './StatusBadge.jsx';

const RegistrationsTable = ({ items, loading, pagination, onPageChange, onRowClick }) => {
  const { page = 1, totalPages = 1, total = 0 } = pagination || {};

  return (
    <div className="rounded-2xl border border-navy/10 bg-white">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-navy/10 bg-navy/5 text-xs uppercase tracking-wide text-navy/60">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">School / College</th>
              <th className="px-4 py-3">Preparing</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <span className="block h-4 w-full animate-pulse rounded bg-navy/10" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-navy/50">
                  No registrations found.
                </td>
              </tr>
            ) : (
              items.map((r, i) => (
                <tr
                  key={r._id}
                  onClick={() => onRowClick(r)}
                  className="cursor-pointer transition hover:bg-brand-50/50"
                >
                  <td className="px-4 py-3 text-navy/50">
                    {(page - 1) * (pagination?.limit || 20) + i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy">{r.fullName}</div>
                    {r.registrationNumber && (
                      <div className="text-xs text-navy/50">{r.registrationNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy/80">{r.mobileNumber}</td>
                  <td className="px-4 py-3 text-navy/80">{r.schoolOrCollege}</td>
                  <td className="px-4 py-3 text-navy/80">{r.preparingFor}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.paymentStatus} />
                  </td>
                  <td className="px-4 py-3 text-navy/60">
                    {r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy, h:mm a') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-navy/10 px-4 py-3 text-sm">
        <span className="text-navy/60">
          {total.toLocaleString('en-IN')} record{total === 1 ? '' : 's'} · Page {page} of{' '}
          {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-navy/15 px-3 py-1.5 font-medium text-navy disabled:opacity-40"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
          >
            ← Prev
          </button>
          <button
            className="rounded-lg border border-navy/15 px-3 py-1.5 font-medium text-navy disabled:opacity-40"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationsTable;
