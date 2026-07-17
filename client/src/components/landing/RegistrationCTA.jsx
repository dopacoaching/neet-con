const RegistrationCTA = () => {
  return (
    <section className="bg-navy py-20 text-white">
      <div className="section">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-700 px-8 py-14 text-center shadow-2xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <h2 className="font-heading text-3xl font-extrabold sm:text-4xl">
            Thank you for being part of NEET CON 2026
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            The event has concluded — stay tuned to DOPA Coaching for what's next.
          </p>
        </div>
      </div>
    </section>
  );
};

export default RegistrationCTA;
