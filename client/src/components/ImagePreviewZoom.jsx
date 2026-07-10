import { useState, useRef, useCallback, useEffect } from 'react';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const DEFAULT_ZOOM = 1;
const DOUBLE_CLICK_ZOOM = 2;
const WHEEL_ZOOM_FACTOR = 1.1;

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export default function ImagePreviewZoom({ url, alt }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const centerImage = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.offsetWidth;
    const ih = img.offsetHeight;

    setPan({ x: (cw - iw) / 2, y: (ch - ih) / 2 });
  }, []);

  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    centerImage();
  }, [centerImage]);

  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  }, [url]);

  const zoomAtPoint = useCallback((clientX, clientY, targetZoom) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const nextZoom = clampZoom(targetZoom);

    setZoom((currentZoom) => {
      setPan((currentPan) => {
        const pointX = (mx - currentPan.x) / currentZoom;
        const pointY = (my - currentPan.y) / currentZoom;
        return {
          x: mx - pointX * nextZoom,
          y: my - pointY * nextZoom,
        };
      });
      return nextZoom;
    });
  }, []);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      setZoom((currentZoom) => {
        const nextZoom = clampZoom(currentZoom * factor);
        const container = containerRef.current;
        if (!container) return currentZoom;

        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        setPan((currentPan) => {
          const pointX = (mx - currentPan.x) / currentZoom;
          const pointY = (my - currentPan.y) / currentZoom;
          return {
            x: mx - pointX * nextZoom,
            y: my - pointY * nextZoom,
          };
        });
        return nextZoom;
      });
    },
    []
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback(
    (e) => {
      if (zoom <= DEFAULT_ZOOM || e.button !== 0) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsDragging(true);
    },
    [zoom, pan.x, pan.y]
  );

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMouseMove = (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPan({
        x: drag.panX + (e.clientX - drag.startX),
        y: drag.panY + (e.clientY - drag.startY),
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleDoubleClick = useCallback(
    (e) => {
      if (Math.abs(zoom - DEFAULT_ZOOM) < 0.01) {
        zoomAtPoint(e.clientX, e.clientY, DOUBLE_CLICK_ZOOM);
      } else {
        resetView();
      }
    },
    [zoom, zoomAtPoint, resetView]
  );

  const handleImageLoad = () => {
    centerImage();
  };

  const zoomPercent = Math.round(zoom * 100);
  const canPan = zoom > DEFAULT_ZOOM;

  return (
    <div className="relative h-[70vh] w-full">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded-lg bg-black/50 px-2 py-1 text-xs text-white">
        <span>{zoomPercent}%</span>
        <button
          type="button"
          onClick={resetView}
          className="rounded px-2 py-0.5 hover:bg-white/20"
        >
          Reset
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: canPan ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <div
          className="absolute left-0 top-0 will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.08s ease-out',
          }}
        >
          <img
            ref={imgRef}
            src={url}
            alt={alt}
            draggable={false}
            onLoad={handleImageLoad}
            className="block max-h-[70vh] max-w-full select-none object-contain"
          />
        </div>
      </div>
    </div>
  );
}
