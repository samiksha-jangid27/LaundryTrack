import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './api';
import { cacheGet, cacheSet } from './storage';
import { useSession } from './session';
export function useResource(path) {
  const { user } = useSession();
  const key = `${user?.id}:${path}`;
  const [data, setData] = useState(null);
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
      cacheSet(key, result);
      setError(null);
      setOffline(false);
      return result;
    } catch (e) {
      if (request !== generation.current) return;
      const cached = e.offline ? cacheGet(key) : null;
      setData(cached);
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
    setLoading(false);
    setRefreshing(false);
    setError(null);
    setOffline(false);
    cacheSet(key, next);
  };
  return { data, setData: update, error, loading, refreshing, reload, offline };
}
