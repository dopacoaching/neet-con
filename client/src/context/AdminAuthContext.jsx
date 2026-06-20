import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adminLogin, adminLogout, adminMe } from '../services/api.js';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore the session from the httpOnly cookie on mount.
  useEffect(() => {
    let active = true;
    adminMe()
      .then((data) => active && setAdmin(data))
      .catch(() => active && setAdmin(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await adminLogin(username, password);
    setAdmin(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminLogout();
    } finally {
      setAdmin(null);
    }
  }, []);

  const value = {
    admin,
    loading,
    isAuthenticated: !!admin,
    isAdminRole: admin?.role === 'admin',
    login,
    logout,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};

export default AdminAuthContext;
