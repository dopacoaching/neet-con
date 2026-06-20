const SeatCounter = ({ seats }) => {
  const confirmed = seats?.confirmed ?? 0;
  const total = seats?.total ?? 600;
  const pct = Math.min(100, Math.round((confirmed / total) * 100));

  let barColor = 'bg-brand';
  if (pct >= 95) barColor = 'bg-red-500';
  else if (pct >= 80) barColor = 'bg-amber-400';

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-heading font-bold text-navy">Seat Capacity</h3>
        <p className="text-sm text-navy/60">
          <strong className="text-navy">{confirmed.toLocaleString('en-IN')}</strong> /{' '}
          {total.toLocaleString('en-IN')} filled
        </p>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-navy/10">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-navy/50">
        {pct}% booked · {(seats?.remaining ?? total - confirmed).toLocaleString('en-IN')} seats
        remaining
      </p>
    </div>
  );
};

export default SeatCounter;
