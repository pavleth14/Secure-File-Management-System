import { useCallback, useState } from 'react';
import ContextMenu from '../components/ContextMenu';

export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openContextMenu = useCallback((event, items) => {
    event.preventDefault();
    event.stopPropagation();
    const visibleItems = items.filter((item) => item.visible !== false);
    if (!visibleItems.length) return;
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: visibleItems,
    });
  }, []);

  const contextMenuNode = contextMenu ? (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={contextMenu.items}
      onClose={closeContextMenu}
    />
  ) : null;

  return { openContextMenu, closeContextMenu, contextMenuNode };
}
