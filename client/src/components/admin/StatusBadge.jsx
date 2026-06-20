const TONES = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
  MANUAL: 'bg-blue-100 text-blue-700',
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      TONES[status] || 'bg-navy/10 text-navy'
    }`}
  >
    {status}
  </span>
);

export default StatusBadge;
