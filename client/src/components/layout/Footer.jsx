import Logo from '../ui/Logo.jsx';
import { VENUE_MAP_URL } from '../../config/event.js';

const Footer = () => (
  <footer className="bg-navy text-white/80">
    <div className="section grid gap-10 py-14 md:grid-cols-3">
      <div>
        <Logo dark />
        <p className="mt-4 max-w-xs text-sm text-white/60">
          NEET CON 2026 — Kerala's premier NEET counselling & strategy conclave, hosted by
          DOPA Coaching, Calicut.
        </p>
      </div>

      <div>
        <h4 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-white">
          Event
        </h4>
        <ul className="space-y-2 text-sm">
          <li>📅 July 12, 2026</li>
          <li>
            📍{' '}
            <a
              href={VENUE_MAP_URL}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-accent hover:underline"
            >
              Yamaniya Hall, Kuttikattor
            </a>
          </li>
          <li>🎟️ ₹100 per student</li>
          <li>🪑 Limited seats — register early</li>
        </ul>
      </div>

      <div>
        <h4 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-white">
          Contact
        </h4>
        <ul className="space-y-2 text-sm">
          <li>
            📞{' '}
            <a href="tel:+919207912200" className="hover:text-accent">
              +91 92079 12200
            </a>
          </li>
          <li>
            ✉️{' '}
            <a href="mailto:dopacalicut@gmail.com" className="hover:text-accent">
              dopacalicut@gmail.com
            </a>
          </li>
          <li className="flex gap-3 pt-1">
            <a
              href="https://instagram.com/dopacoaching"
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent"
            >
              Instagram
            </a>
            <a
              href="https://www.youtube.com/@DOPACoaching"
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent"
            >
              YouTube
            </a>
            <a
              href="https://wa.me/919207912200"
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent"
            >
              WhatsApp
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div className="border-t border-white/10">
      <div className="section flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/50 sm:flex-row">
        <p>© {new Date().getFullYear()} DOPA Coaching, Calicut. All rights reserved.</p>
        <p className="text-center sm:text-right">
          Registration fee is non-refundable. By registering you agree to the event terms &amp;
          conditions.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
