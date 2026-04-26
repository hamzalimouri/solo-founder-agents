import { useState, useEffect } from 'react';
import { api, getToken, setToken, clearToken } from '../api.js';

export function useAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  const login = async (password: string): Promise<boolean> => {
    try {
      const { token } = await api.login(password);
      setToken(token);
      setAuthed(true);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    clearToken();
    setAuthed(false);
  };

  return { authed, login, logout };
}
