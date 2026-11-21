import { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken } from './api';
const Context = createContext(null);
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    api('/health')
      .then((d) => setDemo(d.demo))
      .catch(() => {});
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);
  async function login(input, register = false) {
    const data = await api(`/auth/${register ? 'register' : 'login'}`, {
      method: 'POST',
      body: input,
    });
    setToken(data.token);
    setUser(data.user);
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setToken(null);
      setUser(null);
      location.hash = 'home';
      for (const key of Object.keys(sessionStorage).filter((k) => k.startsWith('delivery.')))
        sessionStorage.removeItem(key);
    }
  }
  return (
    <Context.Provider value={{ user, loading, demo, login, logout }}>{children}</Context.Provider>
  );
}
export const useSession = () => useContext(Context);
