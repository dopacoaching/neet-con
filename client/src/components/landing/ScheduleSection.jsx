// Sessions and the faculty leading each. Times are indicative (the day runs
// 9:30 AM – 5:00 PM); per-session slots can be added here once finalised.
const SCHEDULE = [
  { title: 'D-NAT', speaker: 'Ashiq' },
  { title: 'Training Habit', speaker: 'Niyas' },
  { title: 'Basic Course – Biology', speaker: 'Ashiq' },
  { title: 'Physics', speaker: 'Anoob' },
  { title: 'Chemistry', speaker: 'Ashraf' },
  { title: 'Basic Math', speaker: 'Thabsheer' },
  { title: 'NEET 27', speaker: 'Afsal' },
];

const ScheduleSection = () => (
  <section id="schedule" className="bg-navy py-20 text-white">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow-dark">Day schedule</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">
          9:30 AM – 5:00 PM · One power-packed day
        </h2>
      </div>

      <ol className="relative mx-auto mt-12 max-w-3xl border-l border-white/15 pl-6">
        {SCHEDULE.map((s, i) => (
          <li key={s.title} className="mb-8 last:mb-0">
            <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-navy bg-accent" />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="w-24 flex-shrink-0 font-heading text-sm font-bold text-accent">
                Session {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm font-medium text-white/60">
                  Faculty · <span className="text-accent">{s.speaker}</span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-center text-xs text-white/40">* Schedule is indicative and subject to change.</p>
    </div>
  </section>
);

export default ScheduleSection;
