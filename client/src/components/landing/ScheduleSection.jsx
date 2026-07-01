// Programme for the day. Faculty is optional (e.g. Registration has none).
// Times are indicative — the day runs 10:00 AM – 4:00 PM; per-item slots can be
// added here once finalised.
const SCHEDULE = [
  { title: 'Registration' },
  { title: 'Opening Remarks', speaker: 'Dr. Asif Mohammed' },
  { title: 'DOPA NEET Assessment Tool — D-NAT', speaker: 'Dr. Ashiq Sainudheen' },
  {
    title: 'Habit Formation and Academic Discipline Training for NEET Repeaters',
    speaker: 'Dr. Niyas Paloth',
  },
  { title: 'Introduction to Basic Biology for NEET', speaker: 'Dr. Ashiq Sainudheen' },
  { title: 'Introduction to Basic Physics for NEET', speaker: 'Anoop K' },
  { title: 'Introduction to Basic Chemistry for NEET', speaker: 'Ashraf C' },
  { title: 'Introduction to Basic Maths for NEET', speaker: 'Dr. Thabsheer' },
  { title: 'Aiming for NEET 27–28 · Integrated School', speaker: 'Afsal Safwan' },
  { title: 'Vote of Thanks', speaker: 'Dr. Ashiq Sahal' },
];

const ScheduleSection = () => (
  <section id="schedule" className="bg-navy py-20 text-white">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow-dark">Day schedule</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">
          10:00 AM – 4:00 PM · One power-packed day
        </h2>
      </div>

      <ol className="relative mx-auto mt-12 max-w-2xl border-l border-white/15 pl-6">
        {SCHEDULE.map((s) => (
          <li key={s.title} className="mb-8 last:mb-0">
            <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-navy bg-accent" />
            <h3 className="font-semibold leading-snug">{s.title}</h3>
            {s.speaker && (
              <p className="mt-0.5 text-sm font-medium text-white/60">
                Faculty · <span className="text-accent">{s.speaker}</span>
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-center text-xs text-white/40">* Schedule is indicative and subject to change.</p>
    </div>
  </section>
);

export default ScheduleSection;
