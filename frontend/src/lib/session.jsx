import { createContext, useContext, useState, useEffect } from 'react';
import { api, secret, setToken, restoreBaseUrl, onUnauthorized } from './api';
import { clearLocal, listPending } from './storage';
import { readSavedSession } from './session-state';
const Context = createContext(null);
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState(null);
  useEffect(() => {
    let active = true;
    onUnauthorized(() => {
      setToken(null);
      setUser(null);
      setNotice(
        'Your session expired. Sign in again to continue. Saved scans are kept for your account.',
      );
      secret.remove('laundrytrack.session').catch(() => {});
    });
    async function restore() {
      try {
        try {
          await restoreBaseUrl();
        } catch {
          await secret.remove('laundrytrack.api');
          setNotice('The saved API address could not be restored. Check connection settings.');
        }
        const value = await secret.get('laundrytrack.session');
        if (value) {
          const saved = readSavedSession(value);
          if (!saved || Date.parse(saved.expiresAt) <= Date.now()) {
            await secret.remove('laundrytrack.session');
            setNotice('Please sign in again. Any saved packing scans are kept for your account.');
          } else {
            setToken(saved.token);
            try {
              const fresh = await api('/auth/me');
              if (active) setUser(fresh.user);
            } catch (e) {
              if (e.offline && active) setUser(saved.user);
              else if (e.status !== 401) {
                setToken(null);
                setNotice(e.message);
              }
            }
          }
        }
      } catch {
        setToken(null);
        setStorageError(
          new Error('Secure session storage is unavailable. Restart the app and sign in again.'),
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => {
      active = false;
      onUnauthorized(null);
    };
  }, []);
  async function login(input, register = false) {
    const result = await api(`/auth/${register ? 'register' : 'login'}`, {
      method: 'POST',
      body: input,
    });
    try {
      await secret.set(
        'laundrytrack.session',
        JSON.stringify({ token: result.token, user: result.user, expiresAt: result.expiresAt }),
      );
    } catch {
      throw new Error(
        register
          ? 'Your account was created, but the phone could not securely save the session. Restart the app and sign in.'
          : 'The phone could not securely save your session. Restart the app and try signing in again.',
      );
    }
    setToken(result.token);
    setUser(result.user);
    setNotice('');
    setStorageError(null);
  }
  async function logout() {
    if (user && listPending(user.id).length)
      throw new Error('Sync or discard the saved scans before signing out.');
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (e) {
      if (!e.offline && e.status !== 401) throw e;
    }
    if (user) clearLocal(user.id);
    await secret.remove('laundrytrack.session');
    setToken(null);
    setUser(null);
    setNotice('');
  }
  async function checkConnection() {
    const result = await api('/health');
    if (result.status !== 'ok' || typeof result.version !== 'string')
      throw new Error('This address is not a LaundryTrack API.');
    return result;
  }
  return (
    <Context.Provider
      value={{ user, loading, login, logout, checkConnection, notice, storageError }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
