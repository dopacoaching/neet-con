import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRegistrationStatus } from '../services/api.js';
import Logo from '../components/ui/Logo.jsx';
import { Spinner } from '../components/ui/PageLoader.jsx';
import { ONLINE_EVENT_LINK, EVENT_DATE, EVENT_TIME } from '../config/event.js';

const ThankYouPage = () => {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');

  const [status, setStatus] = useState('loading'); // loading | confirmed | error
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!orderId) {
      setStatus('error');
      return;
    }
    let active = true;

    (async () => {
      try {
        const res = await getRegistrationStatus(orderId);
        if (!active) return;
        setData(res);
        setStatus('confirmed');
      } catch {
        if (!active) return;
        setStatus('error');
      }
    })();

    return () => {
      active = false;
    };
  }, [orderId]);

  // --- Render states ---
  if (status === 'loading') {
    return (
      <Shell>
        <Spinner className="h-8 w-8" />
        <h1 className="mt-4 font-heading text-2xl font-bold">Loading your registration…</h1>
        <p className="mt-2 text-white/70">Please wait a moment.</p>
      </Shell>
    );
  }

  if (status === 'error' || !data) {
    return (
      <Shell>
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 font-heading text-2xl font-bold">We couldn't load your status</h1>
        <p className="mt-2 text-white/70">
          {orderId ? 'Please check again shortly.' : 'Missing order reference.'}
        </p>
        <Link to="/" className="btn-primary mt-6">
          Back to home
        </Link>
      </Shell>
    );
  }

  // Confirmed
  const waMessage = encodeURIComponent(
    `I'm registered for CareeRx! 🎉\nName: ${data.fullName}\nRegistration No: ${data.registrationNumber}`
  );

  return (
    <Shell>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-3xl">
        ✓
      </div>
      <h1 className="mt-5 font-heading text-3xl font-extrabold">Your seat is confirmed!</h1>
      <p className="mt-2 text-white/70">Thank you, {data.fullName}. We can't wait to see you online.</p>

      <div className="mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Registration Code</p>
        <p className="mt-1 font-heading text-2xl font-extrabold text-accent">{data.registrationNumber}</p>
        <div className="mt-4 space-y-1.5 text-sm text-white/70">
          <p>
            <strong className="text-white/90">{EVENT_DATE}</strong> · {EVENT_TIME}
          </p>
          <p>Online Conclave — no physical venue</p>
        </div>
      </div>

      <div className="mt-7 w-full max-w-md rounded-2xl border border-accent/30 bg-accent/10 p-6">
        <p className="font-heading text-lg font-bold text-white">Join the official WhatsApp group</p>
        <p className="mt-1 text-sm text-white/70">
          The event link and every update are shared there — this is for registered students only.
        </p>
        {ONLINE_EVENT_LINK ? (
          <a
            href={ONLINE_EVENT_LINK}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 font-semibold text-white transition hover:bg-green-600"
          >
            Join WhatsApp Group
          </a>
        ) : (
          <p className="mt-4 text-sm text-white/50">The group link will be shared with you shortly.</p>
        )}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <a
          href={`https://wa.me/?text=${waMessage}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-navy transition hover:bg-white/90"
        >
          Share on WhatsApp
        </a>
        <Link to="/" className="btn-ghost border-white/30 !text-white hover:!border-accent hover:!text-accent hover:!bg-white/5">
          Back to home
        </Link>
      </div>
      <p className="mt-6 max-w-sm text-sm text-white/50">
        We're also sending a confirmation to WhatsApp/email on{' '}
        <span className="text-white/80">{data.mobileNumber || 'your registered mobile'}</span>.
      </p>
    </Shell>
  );
};

const Shell = ({ children }) => (
  <div className="flex min-h-screen flex-col items-center bg-navy px-6 py-10 text-center text-white">
    <Link to="/" className="mb-10">
      <Logo dark />
    </Link>
    <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
  </div>
);

export default ThankYouPage;
