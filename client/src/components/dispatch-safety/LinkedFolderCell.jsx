import { Link } from 'react-router-dom';

export default function LinkedFolderCell({ linkedFolderId, linkedFolderPath, linkedFolderName }) {
  if (!linkedFolderId) {
    return <span className="text-slate-400">—</span>;
  }

  const label = linkedFolderPath || linkedFolderName || 'Linked folder';

  return (
    <Link
      to={`/folders/${linkedFolderId}/files`}
      className="text-sm text-brand-600 hover:underline dark:text-brand-400"
      title={label}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}

export function buildViewFilesMenuItem(entity, label = 'View files') {
  if (!entity?.linkedFolderId) return null;
  return {
    id: 'view-files',
    label,
    onClick: () => {
      window.location.href = `/folders/${entity.linkedFolderId}/files`;
    },
  };
}
