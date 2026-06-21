/**
 * Brand lockup: DOPA wordmark + "Coaching", then the NEET CON 2026 event logo.
 *
 * Both logos are blue/cyan wordmarks on transparent backgrounds. DOPA's cyan
 * reads on both light and dark; the NEET CON logo's darker blue is low-contrast
 * on navy, so on dark surfaces it sits on a small white chip.
 */
const Logo = ({ className = '', dark = false }) => {
  const textColor = dark ? 'text-white' : 'text-navy';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src="/dopa-logo.png" alt="DOPA" className="h-5 w-auto object-contain sm:h-6" />
      <span className={`font-heading text-base font-bold sm:text-lg ${textColor}`}>Coaching</span>
      <span
        className={`ml-1.5 inline-flex items-center rounded-lg ${dark ? 'bg-white px-2 py-1' : ''}`}
      >
        <img
          src="/neetcon-logo.png"
          alt="NEET CON 2026"
          className="h-6 w-auto object-contain sm:h-7"
        />
      </span>
    </div>
  );
};

export default Logo;
