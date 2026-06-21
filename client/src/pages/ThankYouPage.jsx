import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { getPaymentStatus } from '../services/api.js';
import Logo from '../components/ui/Logo.jsx';
import { Spinner } from '../components/ui/PageLoader.jsx';

const MAX_RETRIES = 5;
const RETRY_MS = 5000;

const ThankYouPage = () => {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | confirmed | pending | error
  const [data, setData] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const retries = useRef(0);

  // Generate the entry QR (encodes the registration code) once confirmed.
  useEffect(() => {
    if (status === 'confirmed' && data?.registrationNumber) {
      QRCode.toDataURL(data.registrationNumber, {
        width: 320,
        margin: 2,
        color: { dark: '#001e5f', light: '#FFFFFF' },
      })
        .then(setQrUrl)
        .catch(() => setQrUrl(''));
    }
  }, [status, data]);

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
          // Give up — send to failed page.
          navigate(`/payment-failed?orderId=${encodeURIComponent(orderId)}`, { replace: true });
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

      <div className="mt-8 w-full max-w-sm rounded-2xl bg-white/5 p-6 text-left">
        <p className="text-xs uppercase tracking-widest text-accent">Registration Code</p>
        <p className="font-heading text-2xl font-extrabold tracking-wide">
          {data.registrationNumber}
        </p>

        {/* Entry QR code */}
        <div className="mt-5 flex flex-col items-center rounded-xl bg-white p-4">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`Entry QR code for ${data.registrationNumber}`}
              className="h-44 w-44"
            />
          ) : (
            <div className="flex h-44 w-44 items-center justify-center">
              <Spinner className="h-6 w-6 border-navy/30 border-t-navy" />
            </div>
          )}
          <p className="mt-2 text-center text-xs font-medium text-navy/60">
            Show this QR code at the entry desk
          </p>
        </div>

        <div className="mt-5 space-y-2 text-sm text-white/80">
          <Row k="Name" v={data.fullName} />
          <Row k="Preparing For" v={data.preparingFor} />
          <Row k="Event Date" v="12 July 2026" />
          <Row k="Venue" v="Yamaniya Hall, Kuttikattor" />
          <Row k="Amount Paid" v={`₹${data.amount}`} />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        Your registration code and QR pass have been sent on WhatsApp to{' '}
        <span className="text-white/80">{data.mobileNumber || 'your registered mobile'}</span>. Please
        also take a screenshot for your records.
      </p>
    </Shell>
  );
};

const Shell = ({ children }) => (
  <div className="flex min-h-screen flex-col items-center bg-navy px-6 py-10 text-center text-white">
    <Link to="/" className="mb-6">
      <Logo dark />
    </Link>
    <div className="mb-8 inline-flex rounded-2xl bg-white p-3 shadow-lg">
      <img src="/neetcon-logo.png" alt="NEET CON 2026" className="h-12 w-auto object-contain" />
    </div>
    <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
  </div>
);

const Row = ({ k, v }) => (
  <div className="flex justify-between border-b border-white/10 pb-2 last:border-0">
    <span className="text-white/60">{k}</span>
    <strong>{v}</strong>
  </div>
);

export default ThankYouPage;
