import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-center text-white">
    <p className="font-heading text-7xl font-extrabold text-accent">404</p>
    <h1 className="mt-2 font-heading text-2xl font-bold">Page not found</h1>
    <p className="mt-2 max-w-md text-white/70">
      The page you're looking for doesn't exist or has moved.
    </p>
    <Link to="/" className="btn-primary mt-6">
      Back to home
    </Link>
  </div>
);

export default NotFoundPage;
