import { useState } from 'react';
import { toId } from '../utils/format';
import { StarIcon } from './icons';
import { useContextMenu } from '../hooks/useContextMenu';
import {
  buildFolderContextMenuItems,
  buildRootViewContextMenuItems,
  buildPersonalFolderContextMenuItems,
  buildPersonalRootViewContextMenuItems,
} from '../utils/explorerContextMenu';

export default function FolderSidebar({
  rootFolder,
  subfolders = [],
  selectedSubfolderId,
  onSelect,
  canManageSubfolders,
  canCreateSubfolders = canManageSubfolders,
  canDeleteSubfolders = canManageSubfolders,
  newSubfolderName,
  onNewSubfolderNameChange,
  onCreateSubfolder,
  onDeleteSubfolder,
  isFavorite,
  onToggleFavorite,
  folderFavoriteType = 'folder',
  width = 256,
  virtualRoot = false,
  sidebarTitle = 'Folders',
  showFolderFavorites = true,
  showContextMenu = false,
  canRead = true,
  canRename = false,
  onRenameFolder,
  personalContextMenu = false,
  onDownloadFolder,
}) {
  const [expanded, setExpanded] = useState({});
  const { openContextMenu, contextMenuNode } = useContextMenu();

  const ROOT_ID = rootFolder?._id;

  const toggleFolder = (id) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getChildren = (parentId) => {
    return subfolders.filter((f) => {
      const pid = f.parentFolderId ? toId(f.parentFolderId) : null;
      if (virtualRoot && parentId === ROOT_ID) {
        return pid === null;
      }
      return pid === parentId;
    });
  };

  const renderFolders = (parentId, level = 0) => {
    const folders = getChildren(parentId);

    return folders.map((folder) => {
      const id = toId(folder._id);

      const children = getChildren(id);
      const hasChildren = children.length > 0;

      const isExpanded = expanded[id];
      const isSelected = selectedSubfolderId === id;
      const favorited = isFavorite?.(folderFavoriteType, id);

      return (
        <div key={id}>
          <div
            className={`group flex items-center ${isSelected ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
            onContextMenu={
              showContextMenu
                ? (event) =>
                    openContextMenu(
                      event,
                      personalContextMenu
                        ? buildPersonalFolderContextMenuItems({
                            folder,
                            folderId: id,
                            onOpenFolder: onSelect,
                            onRenameFolder,
                            onDownloadFolder,
                            onDeleteFolder: onDeleteSubfolder,
                          })
                        : buildFolderContextMenuItems({
                            folder,
                            folderId: id,
                            folderCanDelete:
                              folder.canDelete !== undefined
                                ? folder.canDelete
                                : canDeleteSubfolders,
                            canRead,
                            canRename,
                            allowRename: true,
                            onOpenFolder: onSelect,
                            onRenameFolder,
                            onDeleteFolder: onDeleteSubfolder,
                          })
                    )
                : undefined
            }
          >
            {showFolderFavorites && onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(folderFavoriteType, id);
                }}
                className={`ml-1 shrink-0 rounded p-1 transition-colors ${
                  favorited
                    ? 'text-amber-500 hover:text-amber-600'
                    : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
                }`}
                aria-label={favorited ? 'Remove folder from favorites' : 'Add folder to favorites'}
              >
                <StarIcon filled={favorited} className="text-sm" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onSelect(id);
              }}
              className="flex w-full items-center gap-2 py-2 pr-2 text-left text-sm text-slate-700 dark:text-slate-200"
              style={{ paddingLeft: `${16 + level * 20}px` }}
            >
              {/* arrow */}
              <span
                className="w-4 shrink-0 text-xs text-slate-400 cursor-pointer dark:text-slate-500"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) toggleFolder(id);
                }}
              >
                {hasChildren ? (isExpanded ? '▼' : '▶︎') : ''}
              </span>

              {/* icon */}
              <span className="shrink-0">
                {folder.hasFiles
                  ? (isExpanded ? '📂' : '📁')
                  : (isExpanded ? '📂' : '📁')}
              </span>

              {/* name */}
              <span className="truncate">{folder.name}</span>
            </button>

            {(() => {
              const folderCanDelete =
                folder.canDelete !== undefined ? folder.canDelete : canDeleteSubfolders;
              if (folderCanDelete) {
                return (
                  <button
                    type="button"
                    onClick={() => onDeleteSubfolder(id, folder.name)}
                    className="mr-2 hidden text-xs text-red-500 group-hover:inline"
                  >
                    ×
                  </button>
                );
              }
              if (folder.deletionBlockedReason) {
                return (
                  <span
                    className="mr-2 hidden cursor-help text-xs text-slate-400 group-hover:inline dark:text-slate-500"
                    title={folder.deletionBlockedReason}
                  >
                    ×
                  </span>
                );
              }
              return null;
            })()}
          </div>

          {/* CHILDREN */}
          {hasChildren && isExpanded && (
            <div>{renderFolders(id, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <aside
      className="flex h-full min-h-0 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      style={{ width, minWidth: width, maxWidth: width }}
      onContextMenu={showContextMenu ? (event) => event.preventDefault() : undefined}
    >
      {/* header */}
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {sidebarTitle}
        </p>
        <p className="mt-1 truncate font-semibold text-slate-900 dark:text-slate-100">
          {rootFolder?.name || '—'}
        </p>
      </div>

      {/* tree */}
      <nav
        className="flex-1 overflow-y-auto py-2"
        onContextMenu={showContextMenu ? (event) => event.preventDefault() : undefined}
      >
        {/* ROOT VIEW */}
        <div
          className={`flex w-full items-center ${!selectedSubfolderId ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
          onContextMenu={
            showContextMenu
              ? (event) =>
                  openContextMenu(
                    event,
                    personalContextMenu
                      ? buildPersonalRootViewContextMenuItems({
                          onOpenFolder: onSelect,
                          onRenameFolder,
                          onDownloadFolder,
                          onDeleteFolder: onDeleteSubfolder,
                        })
                      : buildRootViewContextMenuItems({
                          canRead,
                          onOpenFolder: onSelect,
                        })
                  )
              : undefined
          }
        >
          {showFolderFavorites && onToggleFavorite && rootFolder?._id && (
            <button
              type="button"
              onClick={() => onToggleFavorite(folderFavoriteType, toId(rootFolder._id))}
              className={`ml-1 shrink-0 rounded p-1 transition-colors ${
                isFavorite?.(folderFavoriteType, toId(rootFolder._id))
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
              }`}
              aria-label={
                isFavorite?.(folderFavoriteType, toId(rootFolder._id))
                  ? 'Remove folder from favorites'
                  : 'Add folder to favorites'
              }
            >
              <StarIcon
                filled={isFavorite?.(folderFavoriteType, toId(rootFolder._id))}
                className="text-sm"
              />
            </button>
          )}
          <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm ${!selectedSubfolderId
              ? 'font-medium text-brand-700 dark:text-brand-300'
              : 'text-slate-700 dark:text-slate-200'
            }`}
        >
          <span>📂</span>
          <span>(root)</span>
        </button>
        </div>

        {/* START FROM ROOT FOLDER ID */}
        {renderFolders(ROOT_ID, 0)}
      </nav>

      {/* create subfolder */}
      {canCreateSubfolders && (
        <form
          onSubmit={(e) => {
            e.preventDefault();

            onCreateSubfolder({
              name: newSubfolderName,
              parentFolderId: virtualRoot
                ? (selectedSubfolderId || null)
                : (selectedSubfolderId || ROOT_ID),
            });
          }}
          className="border-t border-slate-200 p-3 flex flex-col dark:border-slate-700 border items-center"
        >
          <input
            type="text"
            value={newSubfolderName}
            onChange={(e) => onNewSubfolderNameChange(e.target.value)}
            placeholder="New subfolder"
            className="mb-2 w-56 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />

          <button
            type="submit"
            className="w-56  rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
          >
            Add subfolder
          </button>
        </form>
      )}
      {contextMenuNode}
    </aside>
  );
}