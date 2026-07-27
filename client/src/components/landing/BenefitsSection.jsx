const BENEFITS = [
  { icon: '🩺', title: 'MBBS Admission Possibilities', body: 'A realistic look at your MBBS admission chances based on where you stand today.' },
  { icon: '🎓', title: 'College Selection & Counselling Strategy', body: 'How to shortlist colleges and approach counselling rounds with a clear strategy.' },
  { icon: '🧭', title: 'Allotment Process Explained', body: 'A step-by-step walkthrough of how seat allotment actually works.' },
  { icon: '🚀', title: 'Careers After NEET', body: 'MBBS, BDS, BAMS, BHMS and allied options — understand what each path really means.' },
  { icon: '🔁', title: 'Repeating NEET — Right Choice?', body: 'An honest framework to decide whether repeating NEET makes sense for you.' },
  { icon: '🤝', title: 'Expert Q&A', body: 'Ask your toughest questions and get direct answers from the panel live.' },
];

const BenefitsSection = () => (
  <section id="benefits" className="bg-brand-50/40 py-20">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">What you get</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold text-navy sm:text-4xl">
          Free to attend — worth far more
        </h2>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-2xl bg-white p-7 shadow-sm transition hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-2xl">
              {b.icon}
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-navy">{b.title}</h3>
            <p className="mt-2 text-sm text-navy/70">{b.body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BenefitsSection;
