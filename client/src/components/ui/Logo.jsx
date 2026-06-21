/**
 * Brand lockup: DOPA wordmark + "Coaching", then the NEET CON 2026 event logo.
 *
 * Both logos are blue/cyan wordmarks on transparent backgrounds. "Coaching" uses
 * the DOPA cyan (text-dopa) so "DOPA Coaching" reads as one lockup on any
 * background. The NEET CON logo's darker blue is low-contrast on navy, so on
 * dark surfaces it sits on a small white chip.
 */
const Logo = ({ className = '', dark = false }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <img src="/dopa-logo.png" alt="DOPA" className="h-6 w-auto object-contain sm:h-7" />
    <span className="font-heading text-xl font-bold leading-none tracking-tight text-dopa sm:text-2xl">
      Coaching
    </span>
    <span
      className={`ml-1 inline-flex items-center rounded-lg ${dark ? 'bg-white px-2 py-1.5' : ''}`}
    >
      <img
        src="/neetcon-logo.png"
        alt="NEET CON 2026"
        className="h-7 w-auto object-contain sm:h-8"
      />
    </span>
  </div>
);

export default Logo;
