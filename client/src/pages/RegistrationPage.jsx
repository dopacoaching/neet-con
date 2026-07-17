import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo.jsx';

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

      <main className="section flex min-h-[70vh] flex-col items-center justify-center py-16 text-center text-white">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">
          NEET CON 2026 has concluded
        </span>
        <h1 className="max-w-xl font-heading text-3xl font-extrabold sm:text-4xl">
          Registrations are now closed
        </h1>
        <p className="mt-4 max-w-md text-white/70">
          Thank you to everyone who joined us on 12 July 2026 — it was a fantastic day! We hope
          to see you again at future DOPA Coaching events.
        </p>
        <Link to="/" className="btn-white mt-8 text-base">
          Back to home
        </Link>
      </main>
    </div>
  );
};

export default RegistrationPage;
