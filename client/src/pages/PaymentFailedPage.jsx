import { Link, useSearchParams } from 'react-router-dom';
import Logo from '../components/ui/Logo.jsx';

const PaymentFailedPage = () => {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const reason = params.get('reason');

  return (
    <div className="flex min-h-screen flex-col items-center bg-navy px-6 py-10 text-center text-white">
      <Link to="/" className="mb-10">
        <Logo dark />
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-3xl">
          ✕
        </div>
        <h1 className="mt-5 font-heading text-3xl font-extrabold">
          {reason === 'duplicate' ? 'You already have a seat' : 'Payment not completed'}
        </h1>
        <p className="mt-2 max-w-md text-white/70">
          {reason === 'duplicate'
            ? 'This mobile number already has a confirmed seat, so we did not book a second one. If you were charged again, it will be refunded after review — please contact DOPA support with your reference number.'
            : reason === 'signature'
            ? 'We could not verify the payment securely. If money was debited, it will be refunded automatically.'
            : 'Your payment was not successful or was cancelled. No seat has been booked yet.'}
        </p>
        {orderId && (
          <p className="mt-2 text-xs text-white/40">Reference: {orderId}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {/* Form data is kept in sessionStorage, so the form pre-fills on retry. */}
          <Link to="/register" className="btn-primary">
            Try Again
          </Link>
          <Link to="/" className="btn-ghost border-white/30 !text-white hover:!border-accent hover:!text-accent hover:!bg-white/5">
            Back to home
          </Link>
        </div>

        <div className="mt-10 max-w-md rounded-2xl bg-white/5 p-5 text-sm text-white/70">
          <p className="font-semibold text-white">If money was deducted</p>
          <p className="mt-1">
            {reason === 'duplicate'
              ? 'Since your seat was already booked, any second charge will be refunded after our team reviews it. Please contact DOPA support with your reference number.'
              : "Bank debits that don't confirm a seat are auto-reversed within 5–7 working days. For help, contact DOPA support with your reference number."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailedPage;
