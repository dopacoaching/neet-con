const CARD_DEFS = [
  { key: 'total', label: 'Total Registrations', tone: 'bg-brand/20 text-white ring-1 ring-brand/30' },
  { key: 'free', label: 'Registered Online', tone: 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/20' },
  { key: 'manual', label: 'Walk-in / Admin-added', tone: 'bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/20' },
  { key: 'dopa', label: 'DOPA', tone: 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/20' },
  { key: 'nonDopa', label: 'Non-DOPA', tone: 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-400/20' },
  { key: 'totalGuests', label: 'Guests Accompanying (Expected)', tone: 'bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-400/20' },
  { key: 'expectedHeadcount', label: 'Expected Headcount', tone: 'bg-teal-500/10 text-teal-300 ring-1 ring-teal-400/20' },
];

const SummaryCards = ({ summary, loading }) => {
  const values = {
    total: summary?.total ?? 0,
    free: summary?.free ?? 0,
    manual: summary?.manual ?? 0,
    dopa: summary?.dopa ?? 0,
    nonDopa: summary?.nonDopa ?? 0,
    totalGuests: summary?.totalGuests ?? 0,
    expectedHeadcount: summary?.expectedHeadcount ?? 0,
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-7">
      {CARD_DEFS.map((c) => (
        <div key={c.key} className={`rounded-2xl p-3 sm:p-5 ${c.tone}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80 sm:text-xs">
            {c.label}
          </p>
          <p className="mt-1.5 font-heading text-2xl font-extrabold sm:mt-2 sm:text-3xl">
            {loading ? (
              <span className="inline-block h-6 w-10 animate-pulse rounded bg-current opacity-20 sm:h-7 sm:w-12" />
            ) : (
              values[c.key].toLocaleString('en-IN')
            )}
          </p>
        </div>
      ))}
    </div>
  );
};

export default SummaryCards;
