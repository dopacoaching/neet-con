import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../ui/Logo.jsx';

const NAV_LINKS = [
  { href: '#about', label: 'About' },
  { href: '#schedule', label: 'Schedule' },
  { href: '#speakers', label: 'Speakers' },
  { href: '#benefits', label: 'Benefits' },
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
      className={`sticky top-0 z-50 transition-all ${
        scrolled ? 'bg-white/95 shadow-md backdrop-blur' : 'bg-transparent'
      }`}
    >
      <nav className="section flex items-center justify-between py-3">
        <Link to="/" aria-label="NEET CON 2026 home">
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
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
