import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './api';
import { cacheGet, cacheSet } from './storage';
import { useSession } from './session';
export function useResource(path) {
  const { user } = useSession();
  const key = `${user?.id}:${user?.role}:${path}`;
  const [data, setData] = useState(null);
  const [dataKey, setDataKey] = useState(key);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    if (!user) return;
    const request = ++generation.current;
    setRefreshing(true);
    try {
      const result = await api(path);
      if (request !== generation.current) return;
      setData(result);
      setDataKey(key);
      cacheSet(key, result);
      setError(null);
      setOffline(false);
      return result;
    } catch (e) {
      if (request !== generation.current) return;
      const cached = e.offline ? cacheGet(key) : null;
      setData(cached);
      setDataKey(key);
      setOffline(!!cached);
      setError(e);
    } finally {
      if (request === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [path, key, user]);
  useFocusEffect(
    useCallback(() => {
      const cached = cacheGet(key);
      setData(cached);
      setDataKey(key);
      setLoading(!cached);
      setError(null);
      setOffline(false);
      reload();
      return () => {
        generation.current++;
      };
    }, [key, reload]),
  );
  const update = (next) => {
    generation.current++;
    setData(next);
    setDataKey(key);
    setLoading(false);
    setRefreshing(false);
    setError(null);
    setOffline(false);
    cacheSet(key, next);
  };
  return {
    data: dataKey === key ? data : null,
    setData: update,
    error: dataKey === key ? error : null,
    loading: dataKey !== key || loading,
    refreshing,
    reload,
    offline: dataKey === key && offline,
  };
}
