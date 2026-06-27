import { Link } from 'react-router-dom';
import RegistrationForm from '../components/registration/RegistrationForm.jsx';
import Logo from '../components/ui/Logo.jsx';
import { VENUE_MAP_URL } from '../config/event.js';

const RegistrationPage = () => {
  return (
    <div className="min-h-screen bg-navy">
      {/* Header */}
      <header className="section flex items-center justify-between py-4">
        <Link to="/">
          <Logo dark />
        </Link>
        <Link to="/" className="text-sm font-medium text-white/70 transition hover:text-accent">
          ← Back to event
        </Link>
      </header>

      <main className="section grid items-start gap-8 pb-20 pt-4 lg:grid-cols-[1fr_1.1fr]">
        {/* Left — event summary */}
        <div className="text-white">
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
            Register for NEET CON 2026
          </h1>
          <p className="mt-3 max-w-md text-white/70">
            Fill in your details and pay ₹100 to confirm your seat. You'll receive a registration
            number on successful payment.
          </p>

          <div className="mt-8 space-y-3 text-sm">
            {[
              ['📅 Date', 'July 12, 2026'],
              ['🕘 Time', '9:30 AM – 5:00 PM'],
              ['📍 Venue', 'Yamaniya Hall, Kuttikattor'],
              ['🎟️ Fee', '₹100 per student'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between border-b border-white/10 pb-2 text-white/80"
              >
                <span>{k}</span>
                <strong className="text-white">
                  {k.includes('Venue') ? (
                    <a
                      href={VENUE_MAP_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:text-accent hover:underline"
                    >
                      {v}
                    </a>
                  ) : (
                    v
                  )}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form card */}
        <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <h2 className="mb-1 font-heading text-xl font-bold text-navy">Your details</h2>
          <p className="mb-6 text-sm text-navy/60">All fields marked * are required.</p>
          <RegistrationForm />
        </div>
      </main>
    </div>
  );
};

export default RegistrationPage;
