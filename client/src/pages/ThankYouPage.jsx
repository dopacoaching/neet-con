import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRegistrationStatus, getPassUrl } from '../services/api.js';
import Logo from '../components/ui/Logo.jsx';
import { Spinner } from '../components/ui/PageLoader.jsx';
import { VENUE_MAP_URL } from '../config/event.js';

const ThankYouPage = () => {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');

  const [status, setStatus] = useState('loading'); // loading | confirmed | error
  const [data, setData] = useState(null);

  // The branded entry pass (QR + details) is rendered server-side.
  const passUrl = orderId ? getPassUrl(orderId) : '';

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
    `I'm registered for CareerX! 🎉\nName: ${data.fullName}\nRegistration No: ${data.registrationNumber}`
  );

  return (
    <Shell>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-3xl">
        ✓
      </div>
      <h1 className="mt-5 font-heading text-3xl font-extrabold">Your seat is confirmed!</h1>
      <p className="mt-2 text-white/70">Thank you, {data.fullName}. We can't wait to see you.</p>

      {/* Branded entry pass (QR + details), rendered server-side */}
      <div className="mt-8 w-full max-w-2xl">
        <div className="overflow-hidden rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
          <img
            src={passUrl}
            alt={`Entry pass for ${data.registrationNumber}`}
            className="w-full rounded-xl"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        <p className="mt-4 text-sm text-white/60">
          <strong className="text-white/90">Free Entry</strong> ·{' '}
          <a
            href={VENUE_MAP_URL}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-accent hover:underline"
          >
            Get directions to the venue
          </a>
        </p>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <a
          href={passUrl}
          download={`careerx-${String(data.registrationNumber).replace(/\s+/g, '-')}.png`}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-navy transition hover:bg-white/90"
        >
          ⬇ Download Pass
        </a>
        <a
          href={`https://wa.me/?text=${waMessage}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 font-semibold text-white transition hover:bg-green-600"
        >
          Share on WhatsApp
        </a>
        <Link to="/" className="btn-ghost border-white/30 !text-white hover:!border-accent hover:!text-accent hover:!bg-white/5">
          Back to home
        </Link>
      </div>
      <p className="mt-6 max-w-sm text-sm text-white/50">
        We're also trying to send a copy to WhatsApp/email on{' '}
        <span className="text-white/80">{data.mobileNumber || 'your registered mobile'}</span>, but
        please download or screenshot the pass above now so you have it either way.
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
