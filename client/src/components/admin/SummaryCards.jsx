const CARD_DEFS = [
  { key: 'total', label: 'Total Registrations', tone: 'bg-navy text-white' },
  { key: 'confirmedTotal', label: 'Confirmed (Paid)', tone: 'bg-green-50 text-green-700 border border-green-200' },
  { key: 'pending', label: 'Pending', tone: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { key: 'failed', label: 'Failed', tone: 'bg-red-50 text-red-700 border border-red-200' },
  { key: 'remaining', label: 'Seats Remaining', tone: 'bg-brand-50 text-brand-700 border border-brand-200' },
];

const SummaryCards = ({ summary, loading }) => {
  const values = {
    total: summary?.total ?? 0,
    // CONFIRMED + MANUAL both count as paid/confirmed seats.
    confirmedTotal: (summary?.confirmed ?? 0) + (summary?.manual ?? 0),
    pending: summary?.pending ?? 0,
    failed: summary?.failed ?? 0,
    remaining: summary?.seats?.remaining ?? 0,
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {CARD_DEFS.map((c) => (
        <div key={c.key} className={`rounded-2xl p-5 ${c.tone}`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{c.label}</p>
          <p className="mt-2 font-heading text-3xl font-extrabold">
            {loading ? (
              <span className="inline-block h-7 w-12 animate-pulse rounded bg-current opacity-20" />
            ) : (
              values[c.key].toLocaleString('en-IN')
            )}
          </p>
          {c.key === 'confirmedTotal' && summary?.manual > 0 && (
            <p className="mt-1 text-[11px] opacity-70">incl. {summary.manual} manual</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default SummaryCards;
