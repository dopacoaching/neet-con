/**
 * Brand lockup: DOPA wordmark logo + the NEET CON 2026 event logo.
 *
 * Both are blue/cyan wordmarks on transparent backgrounds. DOPA's cyan reads on
 * light and dark; the NEET CON logo's darker blue is low-contrast on navy, so on
 * dark surfaces it sits on a small white chip.
 */
const Logo = ({ className = '', dark = false }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <img src="/dopa-logo.png" alt="DOPA" className="h-5 w-auto object-contain sm:h-6" />
    <span className={`inline-flex items-center rounded-md ${dark ? 'bg-white px-1.5 py-1' : ''}`}>
      <img
        src="/neetcon-logo.png"
        alt="NEET CON 2026"
        className="h-6 w-auto object-contain sm:h-7"
      />
    </span>
  </div>
);

export default Logo;
