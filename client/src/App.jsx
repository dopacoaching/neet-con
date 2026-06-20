import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import ProtectedRoute from './pages/admin/ProtectedRoute.jsx';
import PageLoader from './components/ui/PageLoader.jsx';

// Public pages
import LandingPage from './pages/LandingPage.jsx';
import RegistrationPage from './pages/RegistrationPage.jsx';
import ThankYouPage from './pages/ThankYouPage.jsx';
import PaymentFailedPage from './pages/PaymentFailedPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// Admin pages (lazy — keeps the public bundle lean)
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'));

function App() {
  return (
    <AdminAuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
          <Route path="/payment-failed" element={<PaymentFailedPage />} />

          {/* Admin */}
          <Route path="/neetcon-admin/login" element={<AdminLoginPage />} />
          <Route
            path="/neetcon-admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AdminAuthProvider>
  );
}

export default App;
