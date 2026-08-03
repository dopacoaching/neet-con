import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../ui/Logo.jsx';

const NAV_LINKS = [
  { href: '#about', label: 'About' },
  { href: '#benefits', label: "What You'll Get" },
];

/**
 * Public site navbar with a sticky Register button (desktop).
 */
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        scrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}
    >
      <nav className="section flex items-center justify-between py-3">
        <Link to="/" aria-label="CareeRx home">
          <Logo dark={!scrolled} />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition ${
                scrolled ? 'text-navy/80 hover:text-brand' : 'text-white/90 hover:text-accent'
              }`}
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/register"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              scrolled
                ? 'bg-brand text-white hover:bg-brand-600'
                : 'bg-white text-brand hover:bg-white/90'
            }`}
          >
            Register — Free
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
