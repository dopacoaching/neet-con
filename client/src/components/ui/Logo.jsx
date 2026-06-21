/**
 * Brand lockup: DOPA logo + "Coaching" wordmark, then the NEET CON 2026 logo.
 * The DOPA mark falls back to a styled "D" tile if /dopa-logo.png is missing.
 */
const Logo = ({ className = '', dark = false }) => {
  const textColor = dark ? 'text-white' : 'text-navy';
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
      <span className={`font-heading text-base font-extrabold ${textColor}`}>Coaching</span>

      {/* NEET CON 2026 event logo (was a text wordmark). On a small white chip
          so it stays visible on the dark navy surfaces this lockup sits on. */}
      <span className="ml-1 inline-flex rounded-lg bg-white px-2 py-1">
        <img src="/neetcon-logo.png" alt="NEET CON 2026" className="h-7 w-auto object-contain" />
      </span>
    </div>
  );
};

export default Logo;
