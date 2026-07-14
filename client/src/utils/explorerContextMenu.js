import { isPreviewableFile } from './filePreview';

export function buildFolderContextMenuItems({
  folder,
  folderId,
  folderCanDelete,
  canRead,
  canRename,
  allowRename = true,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
}) {
  return [
    {
      id: 'open',
      label: 'Open',
      visible: canRead && Boolean(onOpenFolder),
      onClick: () => onOpenFolder?.(folderId),
    },
    {
      id: 'rename',
      label: 'Rename',
      visible: canRename && allowRename && Boolean(onRenameFolder),
      onClick: () => onRenameFolder?.(folderId, folder.name),
    },
    {
      id: 'delete',
      label: 'Delete',
      visible: folderCanDelete && Boolean(onDeleteFolder),
      destructive: true,
      onClick: () => onDeleteFolder?.(folderId, folder.name),
    },
  ];
}

export function buildFileContextMenuItems({
  file,
  canRead,
  canRename,
  canDownload,
  canDelete,
  onOpenFile,
  onPreview,
  onRenameFile,
  onDownload,
  onDelete,
}) {
  const previewable = isPreviewableFile(file);

  return [
    {
      id: 'open',
      label: 'Open',
      visible: canRead && Boolean(onOpenFile || (previewable && onPreview)),
      onClick: () => {
        if (onOpenFile) {
          onOpenFile(file);
          return;
        }
        if (previewable) onPreview?.(file);
      },
    },
    {
      id: 'rename',
      label: 'Rename',
      visible: canRename && Boolean(onRenameFile),
      onClick: () => onRenameFile?.(file),
    },
    {
      id: 'download',
      label: 'Download',
      visible: canDownload && Boolean(onDownload),
      onClick: () => onDownload?.(file._id, file.originalName),
    },
    {
      id: 'delete',
      label: 'Delete',
      visible: canDelete && Boolean(onDelete),
      destructive: true,
      onClick: () => onDelete?.(file._id),
    },
  ];
}

export function buildRootViewContextMenuItems({ canRead, onOpenFolder }) {
  return [
    {
      id: 'open',
      label: 'Open',
      visible: canRead && Boolean(onOpenFolder),
      onClick: () => onOpenFolder?.(null),
    },
  ];
}

export function buildPersonalFolderContextMenuItems({
  folder,
  folderId,
  onOpenFolder,
  onRenameFolder,
  onDownloadFolder,
  onDeleteFolder,
}) {
  return [
    {
      id: 'open',
      label: 'Open',
      visible: true,
      onClick: () => onOpenFolder?.(folderId),
    },
    {
      id: 'rename',
      label: 'Rename',
      visible: true,
      onClick: () => onRenameFolder?.(folderId, folder.name),
    },
    {
      id: 'download',
      label: 'Download',
      visible: true,
      onClick: () => onDownloadFolder?.(folderId),
    },
    {
      id: 'delete',
      label: 'Delete',
      visible: true,
      destructive: true,
      onClick: () => onDeleteFolder?.(folderId, folder.name),
    },
  ];
}

export function buildPersonalFileContextMenuItems({
  file,
  onOpenFile,
  onPreview,
  onRenameFile,
  onDownload,
  onDelete,
}) {
  const previewable = isPreviewableFile(file);
  const fileId = file._id;
  const fileName = file.originalName || file.name;

  return [
    {
      id: 'open',
      label: 'Open',
      visible: true,
      onClick: () => {
        if (onOpenFile) {
          onOpenFile(file);
          return;
        }
        if (previewable) onPreview?.(file);
      },
    },
    {
      id: 'rename',
      label: 'Rename',
      visible: true,
      onClick: () => onRenameFile?.(file),
    },
    {
      id: 'download',
      label: 'Download',
      visible: true,
      onClick: () => onDownload?.(fileId, fileName),
    },
    {
      id: 'delete',
      label: 'Delete',
      visible: true,
      destructive: true,
      onClick: () => onDelete?.(fileId),
    },
  ];
}

export function buildPersonalRootViewContextMenuItems({
  onOpenFolder,
  onRenameFolder,
  onDownloadFolder,
  onDeleteFolder,
}) {
  return [
    {
      id: 'open',
      label: 'Open',
      visible: true,
      onClick: () => onOpenFolder?.(null),
    },
    {
      id: 'rename',
      label: 'Rename',
      visible: true,
      onClick: () => onRenameFolder?.(null, 'My Files'),
    },
    {
      id: 'download',
      label: 'Download',
      visible: true,
      onClick: () => onDownloadFolder?.(null),
    },
    {
      id: 'delete',
      label: 'Delete',
      visible: true,
      destructive: true,
      onClick: () => onDeleteFolder?.(null, 'My Files'),
    },
  ];
}
