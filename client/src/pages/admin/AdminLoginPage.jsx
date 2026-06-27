import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAdmin } from '../../hooks/useAdmin.js';
import Logo from '../../components/ui/Logo.jsx';
import { Spinner } from '../../components/ui/PageLoader.jsx';

const AdminLoginPage = () => {
  const { login, isAuthenticated } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const from = location.state?.from?.pathname || '/neetcon-admin/dashboard';

  // Already logged in → go straight to dashboard (declarative redirect, no
  // navigation side-effect during render).
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async ({ username, password }) => {
    setSubmitting(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Login failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050c20] px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo dark />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur">
          <h1 className="font-heading text-2xl font-bold text-white">Admin Login</h1>
          <p className="mt-1 text-sm text-white/60">NEET CON 2026 — internal dashboard.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/80" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="input-dark"
                autoComplete="username"
                autoFocus
                {...register('username', { required: 'Username is required' })}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-400">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/80" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input-dark"
                autoComplete="current-password"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
              )}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-white/40">
          Authorised personnel only. This area is monitored.
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
