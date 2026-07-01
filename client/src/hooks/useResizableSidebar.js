import { useCallback, useEffect, useRef, useState } from 'react';

export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_MIN_WIDTH = 256;
export const SIDEBAR_STORAGE_KEY = 'folderSidebarWidth';

function getMaxWidth() {
  if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH;
  return Math.floor(window.innerWidth * 0.5);
}

export function clampSidebarWidth(width) {
  return Math.min(getMaxWidth(), Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function readStoredWidth() {
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed)) {
        return clampSidebarWidth(parsed);
      }
    }
  } catch {
    // Ignore storage errors.
  }
  return SIDEBAR_DEFAULT_WIDTH;
}

export function useResizableSidebar() {
  const [width, setWidth] = useState(readStoredWidth);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);

  useEffect(() => {
    const handleWindowResize = () => {
      setWidth((current) => clampSidebarWidth(current));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handleMouseMove = (event) => {
      const delta = event.clientX - startXRef.current;
      setWidth(clampSidebarWidth(startWidthRef.current + delta));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setWidth((current) => {
        try {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, String(current));
        } catch {
          // Ignore storage errors.
        }
        return current;
      });
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  const startResize = useCallback(
    (event) => {
      event.preventDefault();
      startXRef.current = event.clientX;
      startWidthRef.current = width;
      setIsResizing(true);
    },
    [width]
  );

  return { width, isResizing, startResize };
}
