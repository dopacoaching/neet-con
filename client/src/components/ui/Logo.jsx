/**
 * CareerX wordmark. Two exported PNGs (trimmed from the official logo) cover
 * both surface types:
 *   - light: navy/blue text — for white/light backgrounds (navbar, footer top).
 *   - dark:  white/blue text — for the navy hero/footer/registration surfaces.
 */
const Logo = ({ className = '', dark = false }) => (
  <img
    src={dark ? '/careerx-logo-dark.png' : '/careerx-logo-light.png'}
    alt="CareerX — The Gateway to Medical Career"
    className={`h-8 w-auto object-contain sm:h-9 ${className}`}
  />
);

export default Logo;
