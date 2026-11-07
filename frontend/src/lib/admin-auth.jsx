import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api.js';

/**
 * Session state for the admin dashboard. The session itself lives in an
 * HttpOnly cookie; this provider only mirrors `GET /api/auth/me` so the React
 * tree can guard protected routes and show the signed-in administrator.
 */
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ admin: null, loading: true, error: null });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await api('/api/auth/me');
      const admin = data && data.admin ? data.admin : null;
      setState({ admin, loading: false, error: null });
      return admin;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({ admin: null, loading: false, error: null });
        return null;
      }
      setState({ admin: null, loading: false, error });
      throw error;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const login = useCallback(async (identifier, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    const admin = data && data.admin ? data.admin : null;
    setState({ admin, loading: false, error: null });
    return admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // The session may already be gone; always leave the dashboard.
    }
    setState({ admin: null, loading: false, error: null });
  }, []);

  const value = useMemo(
    () => ({ ...state, refresh, login, logout }),
    [state, refresh, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return context;
}
