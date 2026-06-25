import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import api from '../api/client';

const UploadContext = createContext(null);

// Keep in sync with the server multer limit (50MB).
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
// How many files upload simultaneously (Google Drive style queue).
const MAX_CONCURRENT = 3;
// How long a successfully uploaded item lingers before auto-dismissing.
const SUCCESS_DISMISS_MS = 4000;

const STATUS = {
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELED: 'canceled',
};

let idCounter = 0;
const nextId = () => `up_${Date.now()}_${idCounter++}`;

export function UploadProvider({ children }) {
  const [uploads, setUploads] = useState([]);
  const [minimized, setMinimized] = useState(false);

  // Mirror of `uploads` for use inside async callbacks without stale closures.
  const uploadsRef = useRef([]);
  // Per-upload AbortControllers so an in-flight request can be cancelled.
  const controllersRef = useRef(new Map());
  // Per-upload progress samples for speed/ETA estimation.
  const samplesRef = useRef(new Map());
  // Pending auto-dismiss timers, so we can clear them on unmount.
  const timersRef = useRef(new Map());
  // Indirection so async callbacks always call the latest queue pump.
  const pumpRef = useRef(() => {});

  const syncState = useCallback((updater) => {
    setUploads((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      uploadsRef.current = next;
      return next;
    });
  }, []);

  const patchItem = useCallback(
    (id, patch) => {
      syncState((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) }
            : item
        )
      );
    },
    [syncState]
  );

  const removeUpload = useCallback(
    (id) => {
      const timer = timersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
      controllersRef.current.delete(id);
      samplesRef.current.delete(id);
      syncState((prev) => prev.filter((item) => item.id !== id));
    },
    [syncState]
  );

  const scheduleAutoDismiss = useCallback(
    (id) => {
      const timer = setTimeout(() => removeUpload(id), SUCCESS_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [removeUpload]
  );

  const startUpload = useCallback(
    (item) => {
      const controller = new AbortController();
      controllersRef.current.set(item.id, controller);
      samplesRef.current.set(item.id, { ts: Date.now(), loaded: 0, speed: 0 });

      patchItem(item.id, {
        status: STATUS.UPLOADING,
        progress: 0,
        error: '',
      });

      const formData = new FormData();
      formData.append('folderId', item.folderId);
      if (item.subfolderId) formData.append('subfolderId', item.subfolderId);
      formData.append('file', item.file);

      api
        .post('/files/upload', formData, {
          signal: controller.signal,
          onUploadProgress: (evt) => {
            const total = evt.total || item.size || 0;
            const loaded = evt.loaded || 0;
            const now = Date.now();
            const sample = samplesRef.current.get(item.id) || {
              ts: now,
              loaded: 0,
              speed: 0,
            };

            const dt = (now - sample.ts) / 1000;
            let speed = sample.speed;
            if (dt > 0.15) {
              const instantaneous = (loaded - sample.loaded) / dt;
              // Exponential smoothing keeps the speed/ETA readable.
              speed = sample.speed
                ? sample.speed * 0.7 + instantaneous * 0.3
                : instantaneous;
              samplesRef.current.set(item.id, { ts: now, loaded, speed });
            }

            const progress = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
            const remaining = speed > 0 ? (total - loaded) / speed : null;

            patchItem(item.id, {
              progress,
              loaded,
              speed,
              eta: remaining,
            });
          },
        })
        .then(() => {
          patchItem(item.id, {
            status: STATUS.SUCCESS,
            progress: 100,
            speed: 0,
            eta: 0,
          });
          // Let interested pages refresh their file lists.
          window.dispatchEvent(
            new CustomEvent('files:uploaded', {
              detail: { folderId: item.folderId, subfolderId: item.subfolderId },
            })
          );
          scheduleAutoDismiss(item.id);
        })
        .catch((err) => {
          const canceled =
            err?.code === 'ERR_CANCELED' ||
            err?.name === 'CanceledError' ||
            controller.signal.aborted;
          patchItem(item.id, {
            status: canceled ? STATUS.CANCELED : STATUS.ERROR,
            error: canceled
              ? 'Upload canceled'
              : err?.response?.data?.message || 'Upload failed',
          });
        })
        .finally(() => {
          controllersRef.current.delete(item.id);
          samplesRef.current.delete(item.id);
          // Free a concurrency slot and start the next queued upload.
          pumpRef.current();
        });
    },
    [patchItem, scheduleAutoDismiss]
  );

  // Starts queued uploads up to the concurrency limit.
  const pump = useCallback(() => {
    const current = uploadsRef.current;
    const active = current.filter((u) => u.status === STATUS.UPLOADING).length;
    if (active >= MAX_CONCURRENT) return;

    const slots = MAX_CONCURRENT - active;
    const queued = current.filter((u) => u.status === STATUS.QUEUED).slice(0, slots);
    queued.forEach((item) => startUpload(item));
  }, [startUpload]);

  pumpRef.current = pump;

  /**
   * Add files to the upload queue.
   * @param {FileList|File[]} files
   * @param {{folderId: string, subfolderId?: string|null, folderName?: string}} target
   */
  const enqueueFiles = useCallback(
    (files, target) => {
      const list = Array.from(files || []);
      if (!list.length || !target?.folderId) return;

      const items = list.map((file) => {
        const tooLarge = file.size > MAX_FILE_SIZE;
        return {
          id: nextId(),
          file,
          name: file.name,
          size: file.size,
          folderId: target.folderId,
          subfolderId: target.subfolderId || null,
          folderName: target.folderName || '',
          status: tooLarge ? STATUS.ERROR : STATUS.QUEUED,
          progress: 0,
          loaded: 0,
          speed: 0,
          eta: null,
          error: tooLarge
            ? `File exceeds the ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB limit`
            : '',
        };
      });

      setMinimized(false);
      syncState((prev) => [...items, ...prev]);
      // Allow state to settle before pumping the queue.
      setTimeout(() => pump(), 0);
    },
    [pump, syncState]
  );

  const cancelUpload = useCallback(
    (id) => {
      const controller = controllersRef.current.get(id);
      if (controller) {
        controller.abort();
      } else {
        // Not yet started — just mark it canceled.
        patchItem(id, { status: STATUS.CANCELED, error: 'Upload canceled' });
      }
    },
    [patchItem]
  );

  const retryUpload = useCallback(
    (id) => {
      const item = uploadsRef.current.find((u) => u.id === id);
      if (!item || item.size > MAX_FILE_SIZE) return;
      patchItem(id, { status: STATUS.QUEUED, error: '', progress: 0, loaded: 0 });
      setTimeout(() => pump(), 0);
    },
    [patchItem, pump]
  );

  const clearFinished = useCallback(() => {
    syncState((prev) =>
      prev.filter(
        (u) => u.status === STATUS.UPLOADING || u.status === STATUS.QUEUED
      )
    );
  }, [syncState]);

  const cancelAll = useCallback(() => {
    uploadsRef.current.forEach((u) => {
      if (u.status === STATUS.UPLOADING || u.status === STATUS.QUEUED) {
        cancelUpload(u.id);
      }
    });
  }, [cancelUpload]);

  useEffect(() => {
    const timers = timersRef.current;
    const controllers = controllersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      controllers.forEach((c) => c.abort());
    };
  }, []);

  const activeCount = uploads.filter(
    (u) => u.status === STATUS.UPLOADING || u.status === STATUS.QUEUED
  ).length;

  return (
    <UploadContext.Provider
      value={{
        uploads,
        activeCount,
        minimized,
        setMinimized,
        enqueueFiles,
        cancelUpload,
        retryUpload,
        removeUpload,
        clearFinished,
        cancelAll,
        STATUS,
        MAX_FILE_SIZE,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used within UploadProvider');
  return ctx;
}
