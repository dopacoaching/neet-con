// Confirmed speakers. Photos live in client/public (served from the site root).
const SPEAKERS = [
  {
    name: 'Dr. Ashiq Sainudheen',
    role: 'Director, DOPA',
    photo: '/Ashiq-zainu.png',
  },
  {
    name: 'Dr. Niyas Paloth',
    role: 'Director, DOPA',
    photo: '/Niyas.png',
  },
  {
    name: 'Dr. Asif Mohammed',
    role: 'Director, DOPA',
    photo: '/Asif.png',
  },
];

const SpeakersSection = () => (
  <section id="speakers" className="bg-white py-20">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Speakers &amp; mentors</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold text-navy sm:text-4xl">
          Learn from doctors &amp; toppers
        </h2>
        <p className="mt-4 text-navy/70">
          Meet the doctors guiding you through NEET CON 2026.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
        {SPEAKERS.map((sp, i) => (
          <div
            key={i}
            className="group rounded-2xl border border-navy/10 bg-white p-6 text-center transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="mx-auto h-32 w-32 overflow-hidden rounded-full ring-4 ring-brand-50">
              <img
                src={sp.photo}
                alt={sp.name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <h3 className="mt-4 font-heading font-bold text-navy">{sp.name}</h3>
            <p className="text-sm text-navy/60">{sp.role}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default SpeakersSection;
