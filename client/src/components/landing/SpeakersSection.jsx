// Confirmed speakers. Photos live in client/public (served from the site root).
// The *-head.png files are pre-cropped square head-and-shoulders shots (the face
// is already centered), generated from the full-body originals with sharp.
const SPEAKERS = [
  {
    name: 'Dr. Niyas Paloth',
    role: 'CEO of DOPA',
    photo: '/Niyas-head.png',
  },
  {
    name: 'Dr. Ashiq Sainudheen',
    role: 'Director, DOPA',
    photo: '/Ashiq-zainu-head.png',
  },
  {
    name: 'Dr. Asif Mohammed',
    role: 'Director, DOPA',
    photo: '/Asif-head.png',
  },
  {
    name: 'Shamil Muchukunnu',
    role: 'Mentalist',
    photo: '/Shamil-head.png',
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

      <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-8 sm:grid-cols-4">
        {SPEAKERS.map((sp, i) => (
          <div
            key={i}
            className="group rounded-2xl border border-navy/10 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="mx-auto h-40 w-40 overflow-hidden rounded-full bg-gradient-to-b from-brand-50 to-white ring-4 ring-brand-50">
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
