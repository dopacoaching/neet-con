import { Link } from 'react-router-dom';
import { useSeats } from '../../hooks/useSeats.js';

/**
 * Always-visible Register CTA. Renders as a fixed bottom bar on mobile.
 * Hidden when seats are full (button becomes disabled "Closed").
 */
const StickyRegisterButton = () => {
  const { seats } = useSeats();
  const isFull = seats?.isFull;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="leading-tight">
          <p className="text-xs text-navy/60">NEET CON 2026 · ₹200</p>
          <p className="text-sm font-semibold text-navy">
            {isFull
              ? 'All seats filled'
              : seats
                ? `${seats.remaining.toLocaleString('en-IN')} seats left`
                : 'Limited seats'}
          </p>
        </div>
        {isFull ? (
          <span className="rounded-xl bg-navy/20 px-6 py-3 font-semibold text-navy/60">Closed</span>
        ) : (
          <Link to="/register" className="btn-primary flex-shrink-0">
            Register Now
          </Link>
        )}
      </div>
    </div>
  );
};

export default StickyRegisterButton;
