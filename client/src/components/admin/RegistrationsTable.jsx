import { format } from 'date-fns';
import StatusBadge from './StatusBadge.jsx';

const RegistrationsTable = ({ items, loading, pagination, onPageChange, onRowClick }) => {
  const { page = 1, totalPages = 1, total = 0, limit = 20 } = pagination || {};

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04]">
      {/* Mobile: stacked cards (no horizontal scroll needed) */}
      <div className="divide-y divide-white/5 sm:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 p-4">
              <span className="block h-4 w-2/3 animate-pulse rounded bg-white/10" />
              <span className="block h-3 w-1/3 animate-pulse rounded bg-white/10" />
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-white/40">No registrations found.</p>
        ) : (
          items.map((r) => (
            <button
              key={r._id}
              onClick={() => onRowClick(r)}
              className="block w-full space-y-1.5 p-4 text-left transition hover:bg-white/5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{r.fullName}</p>
                  {r.registrationNumber && (
                    <p className="text-xs text-accent">{r.registrationNumber}</p>
                  )}
                </div>
                <StatusBadge status={r.paymentStatus} />
              </div>
              <p className="text-sm text-white/70">{r.mobileNumber}</p>
              {(r.schoolOrCollege || r.district || r.preparingFor || r.currentStatus) && (
                <p className="truncate text-xs text-white/50">
                  {[r.schoolOrCollege || r.district, r.preparingFor || r.currentStatus]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>{r.guestCount > 0 ? `+${r.guestCount} guest${r.guestCount === 1 ? '' : 's'}` : 'No guests'}</span>
                <span>{r.createdAt ? format(new Date(r.createdAt), 'dd MMM, h:mm a') : '—'}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* sm and up: full table */}
      <div className="scrollbar-thin hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">School / College</th>
              <th className="px-4 py-3">Preparing</th>
              <th className="px-4 py-3">Guests</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <span className="block h-4 w-full animate-pulse rounded bg-white/10" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-white/40">
                  No registrations found.
                </td>
              </tr>
            ) : (
              items.map((r, i) => (
                <tr
                  key={r._id}
                  onClick={() => onRowClick(r)}
                  className="cursor-pointer transition hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-white/40">
                    {(page - 1) * limit + i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{r.fullName}</div>
                    {r.registrationNumber && (
                      <div className="text-xs text-accent">{r.registrationNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/70">{r.mobileNumber}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-white/70" title={r.emailAddress || ''}>
                    {r.emailAddress || '—'}
                  </td>
                  <td className="px-4 py-3 text-white/70">{r.schoolOrCollege || r.district || '—'}</td>
                  <td className="px-4 py-3 text-white/70">{r.preparingFor || r.currentStatus || '—'}</td>
                  <td className="px-4 py-3 text-white/70">{r.guestCount > 0 ? `+${r.guestCount}` : '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.paymentStatus} />
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy, h:mm a') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-sm">
        <span className="text-white/50">
          {total.toLocaleString('en-IN')} record{total === 1 ? '' : 's'} · Page {page} of{' '}
          {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-white/15 px-3 py-1.5 font-medium text-white/80 transition hover:border-accent hover:text-accent disabled:opacity-40"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
          >
            ← Prev
          </button>
          <button
            className="rounded-lg border border-white/15 px-3 py-1.5 font-medium text-white/80 transition hover:border-accent hover:text-accent disabled:opacity-40"
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
