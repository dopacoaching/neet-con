import { useSeats } from '../../hooks/useSeats.js';

/**
 * Live "seats remaining" badge. Colour shifts with urgency:
 *  - > 200 left : brand orange
 *  - <= 200     : amber
 *  - <= 50      : red
 *  - 0          : "Sold out"
 */
const SeatsRemainingBadge = ({ className = '' }) => {
  const { seats, loading } = useSeats();

  if (loading && !seats) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white ${className}`}>
        <span className="h-2 w-2 animate-pulse-soft rounded-full bg-white/70" />
        Loading seats…
      </span>
    );
  }

  const remaining = seats?.remaining ?? 0;
  const isFull = seats?.isFull;

  // Default reads on dark navy hero/registration backgrounds, so use the
  // bright accent. Urgency tones (amber/red) override as seats run low.
  let tone = 'bg-accent text-navy';
  if (isFull) tone = 'bg-red-600 text-white';
  else if (remaining <= 50) tone = 'bg-red-500 text-white';
  else if (remaining <= 200) tone = 'bg-amber-400 text-navy';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg ${tone} ${className}`}
    >
      <span className="h-2 w-2 animate-pulse-soft rounded-full bg-current opacity-80" />
      {isFull ? 'Registrations Closed — Seats Full' : `${remaining.toLocaleString('en-IN')} of ${seats?.total?.toLocaleString('en-IN')} seats left`}
    </span>
  );
};

export default SeatsRemainingBadge;
