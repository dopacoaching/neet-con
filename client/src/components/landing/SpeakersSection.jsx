// Placeholder speakers — swap names, designations and photos when confirmed.
const SPEAKERS = [
  { name: 'Dr. To Be Announced', role: 'Senior Medical Professional', tag: 'Keynote' },
  { name: 'To Be Announced', role: 'NEET Counselling Expert', tag: 'Strategy' },
  { name: 'To Be Announced', role: 'NEET 2025 Topper', tag: 'Topper Talk' },
  { name: 'To Be Announced', role: 'Admissions Advisor', tag: 'Panel' },
];

const initials = (name) =>
  name
    .replace(/^Dr\.\s*/, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const SpeakersSection = () => (
  <section id="speakers" className="bg-white py-20">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Speakers &amp; mentors</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold text-navy sm:text-4xl">
          Learn from doctors &amp; toppers
        </h2>
        <p className="mt-4 text-navy/70">Full speaker line-up will be announced soon.</p>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {SPEAKERS.map((sp, i) => (
          <div
            key={i}
            className="group rounded-2xl border border-navy/10 bg-white p-6 text-center transition hover:-translate-y-1 hover:shadow-xl"
          >
            {/* Photo placeholder — lazy-loaded once real images exist */}
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-700 font-heading text-2xl font-extrabold text-white">
              {initials(sp.name)}
            </div>
            <span className="mt-4 inline-block rounded-full bg-brand-50 px-3 py-0.5 text-[11px] font-semibold text-brand-700">
              {sp.tag}
            </span>
            <h3 className="mt-2 font-heading font-bold text-navy">{sp.name}</h3>
            <p className="text-sm text-navy/60">{sp.role}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default SpeakersSection;
