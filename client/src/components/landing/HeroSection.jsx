import { Link } from 'react-router-dom';
import { EVENT_TIME, VENUE_NAME, VENUE_MAP_URL } from '../../config/event.js';

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-navy via-navy to-navy-light text-white">
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl" />

      <div className="section relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div className="animate-fade-in">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white">
            Registrations are open — free entry
          </span>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-[3.4rem]">
            Your Complete Roadmap <span className="text-accent">After NEET 2026</span>
          </h1>
          <p className="mt-4 text-lg font-medium text-white/80">
            Every NEET score has a possibility. MBBS admissions, counselling strategy, college
            selection, or repeating — get clarity in one session.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5 text-sm">
            <span className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 font-semibold">
              📅 Date will be notified soon
            </span>
            <a
              href={VENUE_MAP_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:border-accent hover:text-accent"
            >
              📍 {VENUE_NAME}
            </a>
            <span className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 font-semibold">
              🎟️ Free Entry
            </span>
          </div>

          <p className="mt-2 text-sm text-white/50">🕤 {EVENT_TIME}</p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/register" className="btn-white text-base">
              Register Now — Free
            </Link>
            <a
              href="#about"
              className="text-sm font-semibold text-white/80 transition hover:text-accent"
            >
              Learn more ↓
            </a>
          </div>
        </div>

        {/* Event card */}
        <div className="animate-fade-in">
          <div className="mx-auto max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="mb-6 flex justify-center rounded-2xl bg-white p-5">
              <img
                src="/careerx-logo-light.png"
                alt="CareerX"
                className="h-16 w-auto object-contain"
              />
            </div>
            <p className="text-xs uppercase tracking-widest text-accent">DOPA Coaching</p>
            <p className="mt-4 font-heading text-3xl font-extrabold leading-tight">
              Your Gateway to a<br />Medical Career
            </p>
            <div className="mt-6 space-y-3 text-sm text-white/80">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span>Date</span>
                <strong>Will be notified soon</strong>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span>Time</span>
                <strong>{EVENT_TIME}</strong>
              </div>
              <div className="flex justify-between">
                <span>Venue</span>
                <strong>{VENUE_NAME}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
