// Programme for the day. Faculty is optional (e.g. breaks have none).
const SCHEDULE = [
  { title: 'Welcome', time: '10:00 – 10:10 AM', speaker: 'Dr. Asif' },
  {
    title: "Into the Aspirant's Mind",
    time: '10:10 – 10:50 AM',
    speaker: 'Shamil Muchukunnu',
  },
  {
    title: 'Doctor: Life Around the White Coat',
    time: '10:50 – 11:20 AM',
    speaker: 'Dr. Fathima Saheer',
  },
  {
    title: 'NEET: Self Analysis & Tips',
    time: '11:20 AM – 12:20 PM',
    speaker: 'Dr. Ashiq Sainudheen',
  },
  {
    title: 'Panel Discussion — Different Stories, One Dream',
    time: '12:20 – 1:10 PM',
    speaker: 'Dr. Niyas & Toppers',
  },
  { title: 'Training Habits', time: '1:10 – 1:30 PM', speaker: 'Afsal Safwan' },
  { title: 'Break & 1-on-1 Counseling', time: '1:30 – 3:00 PM' },
  {
    title: 'Panel Discussion — From Basics to Experts',
    time: '3:00 – 4:00 PM',
    speaker: 'HODs',
  },
  { title: 'NEET 27 Menti', time: '4:00 – 4:30 PM', speaker: 'Dr. Ashiq' },
  { title: 'Vote of Thanks', time: '4:00 – 4:30 PM' },
];

const ScheduleSection = () => (
  <section id="schedule" className="bg-navy py-20 text-white">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow-dark">Day schedule</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">
          10:00 AM – 4:30 PM · One power-packed day
        </h2>
      </div>

      <ol className="relative mx-auto mt-12 max-w-2xl border-l border-white/15 pl-6">
        {SCHEDULE.map((s) => (
          <li key={s.title} className="mb-8 last:mb-0">
            <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-navy bg-accent" />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="font-semibold leading-snug">{s.title}</h3>
              {s.time && <span className="text-sm font-bold text-accent">{s.time}</span>}
            </div>
            {s.speaker && (
              <p className="mt-0.5 text-sm font-medium text-white/60">
                Speaker · <span className="text-accent">{s.speaker}</span>
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default ScheduleSection;
