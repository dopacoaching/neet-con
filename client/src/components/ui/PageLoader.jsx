/**
 * Full-screen centered spinner used as a Suspense / loading fallback.
 */
const PageLoader = ({ label = 'Loading…' }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-navy text-white">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-brand" />
    <p className="mt-4 text-sm text-white/70">{label}</p>
  </div>
);

export const Spinner = ({ className = 'h-5 w-5' }) => (
  <span
    className={`inline-block animate-spin rounded-full border-2 border-white/40 border-t-white ${className}`}
  />
);

export default PageLoader;
