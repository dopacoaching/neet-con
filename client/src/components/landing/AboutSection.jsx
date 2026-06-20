const POINTS = [
  {
    icon: '🎯',
    title: 'What is NEET CON?',
    body: 'A focused one-day conclave demystifying the NEET counselling & college-allotment process — built for students and parents navigating admissions.',
  },
  {
    icon: '👨‍⚕️',
    title: 'Who Should Attend?',
    body: 'NEET 2027 & 2028 aspirants, repeaters, and parents who want a clear, data-driven roadmap from rank to a confirmed medical seat.',
  },
  {
    icon: '🏫',
    title: 'Hosted by DOPA',
    body: 'Organised by DOPA Coaching, Calicut — with years of mentoring experience and a track record of guiding students into top medical colleges.',
  },
];

const AboutSection = () => (
  <section id="about" className="bg-white py-20">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">About the event</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold text-navy sm:text-4xl">
          Clarity that turns a NEET rank into a medical seat
        </h2>
        <p className="mt-4 text-navy/70">
          Most students lose their dream seat not to marks, but to confusion in counselling.
          NEET CON 2026 fixes that.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {POINTS.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-navy/10 bg-brand-50/40 p-7 transition hover:shadow-lg"
          >
            <div className="text-3xl">{p.icon}</div>
            <h3 className="mt-4 font-heading text-lg font-bold text-navy">{p.title}</h3>
            <p className="mt-2 text-sm text-navy/70">{p.body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutSection;
