import { useAdminAuth } from '../context/AdminAuthContext.jsx';

/**
 * Thin convenience hook re-exporting the admin auth context.
 * Keeps component imports tidy (`useAdmin()` vs the longer context import).
 */
export const useAdmin = () => useAdminAuth();

export default useAdmin;
