import { Navigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../../hooks/useAdmin.js';
import PageLoader from '../../components/ui/PageLoader.jsx';

/**
 * Guards admin routes. While the session is being restored, shows a loader.
 * Redirects to the login page when not authenticated.
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAdmin();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking session…" />;

  if (!isAuthenticated) {
    return <Navigate to="/neetcon-admin/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
