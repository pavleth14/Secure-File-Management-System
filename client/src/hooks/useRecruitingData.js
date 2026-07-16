import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';

export function useLeadSources() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/recruiting/sources');
      setSources((data.sources || []).map((source) => source.name));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load lead sources');
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  return { sources, loading, error, reloadSources: loadSources };
}

export function useRecruiters() {
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await api.get('/recruiting/boards');
        if (!cancelled) {
          setRecruiters(
            (data.boards || []).map((board) => ({
              id: board.userId,
              name: board.label.replace(/ Board$/, ''),
            }))
          );
        }
      } catch {
        if (!cancelled) setRecruiters([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { recruiters, loading };
}
