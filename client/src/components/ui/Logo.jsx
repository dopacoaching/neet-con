/**
 * DOPA logo lockup. Falls back to a styled text mark if the image asset
 * (/dopa-logo.png) is missing — replace public/dopa-logo.png with the real one.
 */
const Logo = ({ className = '', dark = false }) => {
  const textColor = dark ? 'text-white' : 'text-navy';
  const accentColor = dark ? 'text-accent' : 'text-brand';
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/dopa-logo.png"
        alt="DOPA"
        className="h-9 w-9 rounded-lg object-contain"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextSibling.style.display = 'flex';
        }}
      />
      <span
        style={{ display: 'none' }}
        className="h-9 w-9 items-center justify-center rounded-lg bg-brand font-heading text-sm font-extrabold text-white"
      >
        D
      </span>
      <div className="leading-tight">
        <span className={`block font-heading text-base font-extrabold ${textColor}`}>
          NEET CON <span className={accentColor}>2026</span>
        </span>
        <span className={`block text-[11px] ${dark ? 'text-white/60' : 'text-navy/50'}`}>
          DOPA Coaching
        </span>
      </div>
    </div>
  );
};

export default Logo;
