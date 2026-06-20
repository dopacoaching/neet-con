const BENEFITS = [
  { icon: '🧭', title: 'Allotment Guidance', body: 'Step-by-step walkthrough of NEET counselling rounds, choice-filling and locking.' },
  { icon: '🎓', title: 'Career Clarity', body: 'MBBS, BDS, BAMS, BHMS and allied options — understand what each path really means.' },
  { icon: '🏆', title: 'Topper Strategies', body: 'Proven study and exam-day tactics directly from students who scored top ranks.' },
  { icon: '💸', title: 'Fees & Finance', body: 'Government vs private fees, bonds, education loans and management quota explained.' },
  { icon: '🗂️', title: 'Personalised Roadmap', body: 'Leave with a clear, realistic plan tailored to your target NEET year.' },
  { icon: '🤝', title: 'Expert Q&A', body: 'Ask your toughest counselling questions and get answers from the panel live.' },
];

const BenefitsSection = () => (
  <section id="benefits" className="bg-brand-50/40 py-20">
    <div className="section">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">What you get</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold text-navy sm:text-4xl">
          Worth far more than ₹100
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
