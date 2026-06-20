// Placeholder schedule — replace session titles/speakers once finalised.
const SCHEDULE = [
  { time: '9:30 AM', title: 'Registration & Welcome Kit', desc: 'Check-in, ID verification and seating.' },
  { time: '10:00 AM', title: 'Inauguration & Keynote', desc: 'Setting the stage: the NEET 2026 landscape.' },
  { time: '11:00 AM', title: 'Decoding NEET Counselling', desc: 'AIQ vs State Quota, rounds, mop-up & stray vacancy.' },
  { time: '12:30 PM', title: 'College & Course Selection Strategy', desc: 'How to fill your choice list the smart way.' },
  { time: '1:30 PM', title: 'Lunch Break', desc: 'Networking with mentors and fellow aspirants.' },
  { time: '2:30 PM', title: 'Topper Talk', desc: 'Real strategies from students who cracked NEET.' },
  { time: '3:30 PM', title: 'Parents & Finance Session', desc: 'Fees, bonds, loans and management quota clarity.' },
  { time: '4:30 PM', title: 'Live Q&A + Closing', desc: 'Your questions answered by the panel.' },
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
        {SCHEDULE.map((s) => (
          <li key={s.time} className="mb-8 last:mb-0">
            <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-navy bg-accent" />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="w-24 flex-shrink-0 font-heading text-sm font-bold text-accent">
                {s.time}
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-white/60">{s.desc}</p>
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
