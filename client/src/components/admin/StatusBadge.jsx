const TONES = {
  CONFIRMED: 'bg-green-500/15 text-green-300 ring-1 ring-green-400/20',
  PENDING: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20',
  FAILED: 'bg-red-500/15 text-red-300 ring-1 ring-red-400/20',
  MANUAL: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20',
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      TONES[status] || 'bg-white/10 text-white/70'
    }`}
  >
    {status}
  </span>
);

export default StatusBadge;
