import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useRootNavigationState } from 'expo-router';
import { api } from './api';
import { useSession } from './session';
import { pushModule, syncPushDevice } from './push';
import { notificationDestination, pushNotificationId } from './notification-target';

const Context = createContext(null);
export function NotificationProvider({ children }) {
  const { user, loading } = useSession();
  const navigation = useRootNavigationState();
  const [summary, setSummary] = useState({ owner: null, unread: 0, pushEnabled: true });
  const [pending, setPending] = useState(null);
  const identity = `${user?.id}:${user?.role}`;
  const current = useRef(identity);
  current.current = identity;
  const refresh = useCallback(async () => {
    if (!user) return;
    const result = await api('/notifications/summary');
    if (current.current === identity) setSummary({ ...result, owner: identity });
  }, [identity, user]);
  const open = useCallback(
    async (id) => {
      const { notification } = await api(`/notifications/${encodeURIComponent(id)}`);
      if (current.current !== identity) return;
      await api(`/notifications/${notification.id}/read`, { method: 'PATCH' });
      refresh().catch(() => {});
      router.push(notificationDestination(notification, user.role));
    },
    [identity, user, refresh],
  );
  useEffect(() => {
    let disposed = false;
    const subscriptions = [];
    pushModule()
      .then(async (notifications) => {
        if (disposed) return;
        subscriptions.push(
          notifications.addNotificationResponseReceivedListener((response) => {
            const id = pushNotificationId(response);
            if (id) setPending(id);
            notifications.clearLastNotificationResponseAsync().catch(() => {});
          }),
        );
        subscriptions.push(
          notifications.addNotificationReceivedListener(() => {
            // The interval/foreground refresh also covers notifications received before login.
            AppState.currentState === 'active' &&
              setSummary((value) => ({ ...value, refreshAt: Date.now() }));
          }),
        );
        const response = await notifications.getLastNotificationResponseAsync();
        if (!disposed) {
          const id = pushNotificationId(response);
          if (id) setPending(id);
          await notifications.clearLastNotificationResponseAsync();
        }
      })
      .catch(() => {}); // Inbox remains available in Expo Go and before native setup.
    return () => {
      disposed = true;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const sync = () => {
      if (AppState.currentState !== 'active') return;
      refresh().catch(() => {});
    };
    sync();
    const register = () => syncPushDevice().catch(() => {});
    register();
    let tokenSubscription;
    pushModule()
      .then((notifications) => {
        if (active) tokenSubscription = notifications.addPushTokenListener(register);
      })
      .catch(() => {});
    const timer = setInterval(sync, 30000);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sync();
        register();
      }
    });
    return () => {
      active = false;
      clearInterval(timer);
      foreground.remove();
      tokenSubscription?.remove();
    };
  }, [user, refresh]);
  useEffect(() => {
    if (user && summary.refreshAt) refresh().catch(() => {});
  }, [summary.refreshAt, user, refresh]);
  useEffect(() => {
    if (!pending || !user || loading || !navigation?.key) return;
    setPending(null);
    open(pending).catch(() => router.push('/notifications'));
  }, [pending, user, loading, navigation?.key, open]);
  return (
    <Context.Provider
      value={{
        unread: summary.owner === identity ? summary.unread : 0,
        pushEnabled: summary.owner === identity ? summary.pushEnabled : true,
        refresh,
        open,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useNotifications = () => useContext(Context);
