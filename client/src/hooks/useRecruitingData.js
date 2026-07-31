import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

function mapOptionItems(items = []) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    isDefault: Boolean(item.isDefault),
  }));
}

export function useLeadSources() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/recruiting/sources');
      setSources(mapOptionItems(data.sources));
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

  const sourceNames = useMemo(() => sources.map((source) => source.name), [sources]);

  return { sources, sourceNames, loading, error, reloadSources: loadSources };
}

export function useLeadStatuses() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStatuses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/recruiting/statuses');
      setStatuses(mapOptionItems(data.statuses));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load lead statuses');
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const statusNames = useMemo(() => statuses.map((status) => status.name), [statuses]);

  return { statuses, statusNames, loading, error, reloadStatuses: loadStatuses };
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
              name: board.label.replace(/ Board(?= \(|$)/, ''),
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
