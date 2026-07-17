import { VENUE_MAP_URL } from '../../config/event.js';

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
      <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-brand/30 blur-3xl" />

      <div className="section relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div className="animate-fade-in">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white">
            Event concluded — thank you for joining us!
          </span>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
            NEET CON <span className="text-accent">2026</span>
          </h1>
          <p className="mt-4 text-lg font-medium text-white/80">
            Kerala's biggest NEET counselling &amp; strategy conclave.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5 text-sm">
            <span className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 font-semibold">
              📅 July 12, 2026
            </span>
            <a
              href={VENUE_MAP_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 font-semibold transition hover:border-accent hover:text-accent"
            >
              📍 Yamaniya Hall, Kuttikattor
            </a>
            <span className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 font-semibold">
              🎟️ Free Entry
            </span>
          </div>

          <p className="mt-6 max-w-md text-white/70">
            From rank prediction to college allotment strategy — get clarity from medical
            professionals and NEET toppers. One day that can shape your medical career.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#about"
              className="text-sm font-semibold text-white/80 transition hover:text-accent"
            >
              Learn more ↓
            </a>
          </div>
        </div>

        {/* Event card / poster placeholder */}
        <div className="animate-fade-in">
          <div className="mx-auto max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="mb-6 flex justify-center rounded-2xl bg-white p-4">
              <img
                src="/neetcon-logo.png"
                alt="NEET CON 2026"
                className="h-20 w-auto object-contain"
              />
            </div>
            <p className="text-xs uppercase tracking-widest text-accent">DOPA Coaching</p>
            <p className="mt-4 font-heading text-3xl font-extrabold leading-tight">
              Your Seat to a<br />Medical Future
            </p>
            <div className="mt-6 space-y-3 text-sm text-white/80">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span>Date</span>
                <strong>12 July 2026</strong>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span>Time</span>
                <strong>9:30 AM – 4:00 PM</strong>
              </div>
              <div className="flex justify-between">
                <span>Venue</span>
                <strong>Yamaniya Hall, Kuttikattor</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
