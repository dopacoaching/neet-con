const POINTS = [
  {
    icon: '🎯',
    title: 'What is CareerX?',
    body: 'A focused session giving you a complete roadmap after NEET 2026 — from MBBS admission possibilities to what comes next if things don’t go as planned.',
  },
  {
    icon: '🧭',
    title: 'Who Should Attend?',
    body: 'Students who appeared for NEET 2026, Plus Two students planning ahead, repeaters weighing their options, and parents seeking a clear picture.',
  },
  {
    icon: '🏫',
    title: 'Hosted by DOPA',
    body: 'Organised by DOPA Coaching — with years of mentoring experience and a track record of guiding students into medical colleges.',
  },
];

const AboutSection = () => (
  <section id="about" className="bg-white py-20">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">About the event</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold text-navy sm:text-4xl">
          Every NEET score has a possibility
        </h2>
        <p className="mt-4 text-navy/70">
          MBBS admissions, counselling strategy, college selection, or repeating — CareerX helps
          you decide your next step with clarity, not confusion.
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
