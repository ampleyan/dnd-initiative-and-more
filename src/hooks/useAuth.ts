import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me()
      .then(u => { setUser(u as AuthUser); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const u = await api.auth.login(username, password);
      setUser(u as AuthUser);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Login failed';
    }
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
