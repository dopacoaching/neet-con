const CARD_DEFS = [
  { key: 'total', label: 'Total Registrations', tone: 'bg-brand/20 text-white ring-1 ring-brand/30' },
  { key: 'confirmedTotal', label: 'Confirmed (Paid)', tone: 'bg-green-500/10 text-green-300 ring-1 ring-green-400/20' },
  { key: 'free', label: 'Free (DOPA)', tone: 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/20' },
  { key: 'checkedIn', label: 'Checked In', tone: 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/20' },
  { key: 'pending', label: 'Pending', tone: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/20' },
  { key: 'failed', label: 'Failed', tone: 'bg-red-500/10 text-red-300 ring-1 ring-red-400/20' },
];

const SummaryCards = ({ summary, loading }) => {
  const values = {
    total: summary?.total ?? 0,
    // CONFIRMED + MANUAL both count as paid/confirmed seats.
    confirmedTotal: (summary?.confirmed ?? 0) + (summary?.manual ?? 0),
    free: summary?.free ?? 0,
    checkedIn: summary?.checkedIn ?? 0,
    pending: summary?.pending ?? 0,
    failed: summary?.failed ?? 0,
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
