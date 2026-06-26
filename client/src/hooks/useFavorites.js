import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

export function useFavorites() {
  const [favoriteKeys, setFavoriteKeys] = useState(new Set());

  const loadFavorites = useCallback(async () => {
    const { data } = await api.get('/favorites/ids');
    setFavoriteKeys(new Set(data.favorites || []));
  }, []);

  useEffect(() => {
    loadFavorites().catch(() => {});
  }, [loadFavorites]);

  const isFavorite = useCallback(
    (fileType, fileId) => favoriteKeys.has(`${fileType}:${fileId}`),
    [favoriteKeys]
  );

  const toggleFavorite = useCallback(async (fileType, fileId) => {
    const { data } = await api.post('/favorites', { fileType, fileId });
    const key = `${fileType}:${fileId}`;
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (data.favorited) next.add(key);
      else next.delete(key);
      return next;
    });
    return data.favorited;
  }, []);

  return { isFavorite, toggleFavorite, reloadFavorites: loadFavorites };
}
