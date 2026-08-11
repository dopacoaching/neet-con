import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createRegistration } from '../../services/api.js';
import { Spinner } from '../ui/PageLoader.jsx';

// 12th passing years: 2028 (current) down to 2005.
const PASS_YEARS = Array.from({ length: 2028 - 2005 + 1 }, (_, i) => 2028 - i);
const STORAGE_KEY = 'careerx_reg_form';

const RegistrationForm = () => {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ mode: 'onTouched' });

  const dopaStatus = watch('dopaStatus');
  const isDopa = dopaStatus === 'DOPA';

  // Restore previously-entered data (e.g. after a failed submission "Try Again").
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

    // Persist so the form can pre-fill on retry after a failure.
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));

    try {
      // Free event — no payment step. Registering confirms the seat immediately.
      const { orderId } = await createRegistration(values);
      sessionStorage.removeItem(STORAGE_KEY);
      toast.success('Registration confirmed!');
      navigate(`/thank-you?orderId=${encodeURIComponent(orderId)}`);
    } catch (err) {
      // Do NOT clear the form on failure.
      toast.error(err.message || 'Could not complete registration. Please try again.');
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
          Phone Number <span className="text-brand">*</span>
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
            required: 'Phone number is required',
            pattern: {
              value: /^[6-9]\d{9}$/,
              message: 'Enter a valid 10-digit Indian mobile number',
            },
          })}
        />
        <p className="mt-1 text-xs text-navy/50">
          Your registration code &amp; confirmation will be sent here on WhatsApp.
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
        {errors.emailAddress && (
          <p className="mt-1 text-sm text-red-600">{errors.emailAddress.message}</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="dopaStatus">
          DOPA or Non-DOPA <span className="text-brand">*</span>
        </label>
        <select
          id="dopaStatus"
          className="input-field"
          defaultValue=""
          {...register('dopaStatus', { required: 'Please select DOPA or Non-DOPA' })}
        >
          <option value="" disabled>
            Select
          </option>
          <option value="DOPA">DOPA</option>
          <option value="Non-DOPA">Non-DOPA</option>
        </select>
        {errors.dopaStatus && (
          <p className="mt-1 text-sm text-red-600">{errors.dopaStatus.message}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="schoolOrCollege">
            {isDopa ? 'Campus Name' : 'Campus / Institution Name'} <span className="text-brand">*</span>
          </label>
          <input
            id="schoolOrCollege"
            className="input-field"
            placeholder={isDopa ? 'e.g. DOPA Calicut' : 'Your institution name'}
            {...register('schoolOrCollege', {
              required: isDopa ? 'Campus name is required' : 'Institution name is required',
            })}
          />
          {errors.schoolOrCollege && (
            <p className="mt-1 text-sm text-red-600">{errors.schoolOrCollege.message}</p>
          )}
        </div>

        {isDopa && (
          <div>
            <label className="label" htmlFor="batch">
              Batch <span className="text-brand">*</span>
            </label>
            <input
              id="batch"
              className="input-field"
              placeholder="e.g. NEET 2026"
              {...register('batch', { required: isDopa ? 'Batch is required' : false })}
            />
            {errors.batch && <p className="mt-1 text-sm text-red-600">{errors.batch.message}</p>}
          </div>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="neetScore">
            NEET 2026 Score <span className="text-brand">*</span>
          </label>
          <input
            id="neetScore"
            className="input-field"
            placeholder="e.g. 580 or Not appeared"
            {...register('neetScore', { required: 'NEET 2026 score is required' })}
          />
          {errors.neetScore && (
            <p className="mt-1 text-sm text-red-600">{errors.neetScore.message}</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="passedYear">
            12th Pass Out Year <span className="text-brand">*</span>
          </label>
          <select
            id="passedYear"
            className="input-field"
            defaultValue=""
            {...register('passedYear', { required: '12th pass-out year is required' })}
          >
            <option value="" disabled>
              Select year
            </option>
            {PASS_YEARS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          {errors.passedYear && (
            <p className="mt-1 text-sm text-red-600">{errors.passedYear.message}</p>
          )}
        </div>
      </div>

      <button type="submit" className="btn-primary w-full text-base" disabled={submitting}>
        {submitting ? (
          <>
            <Spinner /> Registering…
          </>
        ) : (
          'Complete Registration — Free'
        )}
      </button>
    </form>
  );
};

export default RegistrationForm;
