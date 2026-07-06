import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getPaymentStatus, getPassUrl } from '../services/api.js';
import Logo from '../components/ui/Logo.jsx';
import { Spinner } from '../components/ui/PageLoader.jsx';
import { VENUE_MAP_URL } from '../config/event.js';

const MAX_RETRIES = 5;
const RETRY_MS = 5000;

const ThankYouPage = () => {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | confirmed | pending | error
  const [data, setData] = useState(null);
  const retries = useRef(0);

  // The branded entry pass (QR + details) is rendered server-side.
  const passUrl = orderId ? getPassUrl(orderId) : '';

  useEffect(() => {
    if (!orderId) {
      setStatus('error');
      return;
    }
    let timer;
    let active = true;

    const poll = async () => {
      try {
        const res = await getPaymentStatus(orderId);
        if (!active) return;
        setData(res);

        if (res.paymentStatus === 'CONFIRMED' || res.paymentStatus === 'MANUAL') {
          setStatus('confirmed');
          return;
        }

        // Still pending — HDFC may be slow. Retry up to MAX_RETRIES.
        if (retries.current < MAX_RETRIES) {
          retries.current += 1;
          setStatus('pending');
          timer = setTimeout(poll, RETRY_MS);
        } else {
          // Give up polling — but we genuinely don't know the outcome yet
          // (HDFC may just be slow), so don't tell the user it failed.
          navigate(
            `/payment-failed?orderId=${encodeURIComponent(orderId)}&reason=timeout`,
            { replace: true }
          );
        }
      } catch {
        if (!active) return;
        setStatus('error');
      }
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderId, navigate]);

  // --- Render states ---
  if (status === 'loading' || status === 'pending') {
    return (
      <Shell>
        <Spinner className="h-8 w-8" />
        <h1 className="mt-4 font-heading text-2xl font-bold">Verifying your payment…</h1>
        <p className="mt-2 text-white/70">
          {status === 'pending'
            ? `Confirming with the bank (attempt ${retries.current}/${MAX_RETRIES})…`
            : 'Please wait a moment.'}
        </p>
        <p className="mt-1 text-sm text-white/50">Do not close or refresh this page.</p>
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
    `I'm registered for NEET CON 2026! 🎉\nName: ${data.fullName}\nRegistration No: ${data.registrationNumber}\nDate: 12 July 2026, Yamaniya Hall, Kuttikattor.`
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
          Amount Paid: <strong className="text-white/90">₹{data.amount}</strong> ·{' '}
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
          download={`neetcon-2026-${String(data.registrationNumber).replace(/\s+/g, '-')}.png`}
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
        Your entry pass has also been sent on WhatsApp to{' '}
        <span className="text-white/80">{data.mobileNumber || 'your registered mobile'}</span>. Please
        download or screenshot it for the entry desk.
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
