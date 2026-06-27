import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createRegistration, initiatePayment } from '../../services/api.js';
import { Spinner } from '../ui/PageLoader.jsx';

// 12th passing years: 2028 (current) down to 2005.
const PASS_YEARS = Array.from({ length: 2028 - 2005 + 1 }, (_, i) => 2028 - i);
const STORAGE_KEY = 'neetcon_reg_form';

/**
 * Redirect the browser to the payment gateway.
 * - GET (mock + live HDFC SmartGateway): navigate to the hosted payment URL.
 * - POST (other gateways): auto-submit a hidden form carrying payment.fields.
 */
const redirectToGateway = (payment) => {
  if (payment.mock || payment.method === 'GET') {
    window.location.href = payment.paymentUrl;
    return;
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payment.paymentUrl;
  Object.entries(payment.fields || {}).forEach(([k, v]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
};

const RegistrationForm = () => {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ mode: 'onTouched' });

  // Restore previously-entered data (e.g. after a failed payment "Try Again").
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) reset(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);

    // Persist so the Payment Failed page can pre-fill on retry.
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));

    try {
      const { orderId } = await createRegistration(values);
      const payment = await initiatePayment(orderId);
      toast.success('Redirecting to secure payment…');
      // Small delay so the toast is visible before the redirect.
      setTimeout(() => redirectToGateway(payment), 400);
    } catch (err) {
      // Do NOT clear the form on failure.
      toast.error(err.message || 'Could not start payment. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <label className="label" htmlFor="fullName">
          Full Name <span className="text-brand">*</span>
        </label>
        <input
          id="fullName"
          className="input-field"
          placeholder="As per your records"
          autoComplete="name"
          {...register('fullName', {
            required: 'Full name is required',
            minLength: { value: 2, message: 'Please enter your full name' },
          })}
        />
        {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}
      </div>

      <div>
        <label className="label" htmlFor="mobileNumber">
          Mobile Number <span className="text-brand">*</span>
        </label>
        <input
          id="mobileNumber"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          className="input-field"
          placeholder="10-digit mobile number"
          autoComplete="tel"
          {...register('mobileNumber', {
            required: 'Mobile number is required',
            pattern: {
              value: /^[6-9]\d{9}$/,
              message: 'Enter a valid 10-digit Indian mobile number',
            },
          })}
        />
        <p className="mt-1 text-xs text-navy/50">
          Your registration code &amp; entry QR will be sent here on WhatsApp.
        </p>
        {errors.mobileNumber && (
          <p className="mt-1 text-sm text-red-600">{errors.mobileNumber.message}</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="emailAddress">
          Email Address <span className="text-navy/40">(optional)</span>
        </label>
        <input
          id="emailAddress"
          type="email"
          className="input-field"
          placeholder="you@example.com"
          autoComplete="email"
          {...register('emailAddress', {
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
          })}
        />
        <p className="mt-1 text-xs text-navy/50">For our records — confirmation is sent via WhatsApp.</p>
        {errors.emailAddress && (
          <p className="mt-1 text-sm text-red-600">{errors.emailAddress.message}</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="schoolOrCollege">
          School / College <span className="text-brand">*</span>
        </label>
        <input
          id="schoolOrCollege"
          className="input-field"
          placeholder="Your institution name"
          {...register('schoolOrCollege', { required: 'School/College is required' })}
        />
        {errors.schoolOrCollege && (
          <p className="mt-1 text-sm text-red-600">{errors.schoolOrCollege.message}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="passedYear">
            Year of 12th
          </label>
          <select id="passedYear" className="input-field" defaultValue="" {...register('passedYear')}>
            <option value="" disabled>
              Select year
            </option>
            {PASS_YEARS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="preparingFor">
            Preparing For <span className="text-brand">*</span>
          </label>
          <select
            id="preparingFor"
            className="input-field"
            defaultValue=""
            {...register('preparingFor', { required: 'Please select what you are preparing for' })}
          >
            <option value="" disabled>
              Select
            </option>
            <option value="NEET 2027">NEET 2027</option>
            <option value="NEET 2028">NEET 2028</option>
          </select>
          {errors.preparingFor && (
            <p className="mt-1 text-sm text-red-600">{errors.preparingFor.message}</p>
          )}
        </div>
      </div>

      <button type="submit" className="btn-primary w-full text-base" disabled={submitting}>
        {submitting ? (
          <>
            <Spinner /> Processing…
          </>
        ) : (
          'Proceed to Pay ₹100'
        )}
      </button>
    </form>
  );
};

export default RegistrationForm;
