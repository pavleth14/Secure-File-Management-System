import { toId } from './format';

/**
 * Build breadcrumb segments from root → current subfolder using flat subfolder list.
 * @returns {{ id: string, name: string }[]}
 */
export function buildSubfolderPath(subfolders, selectedSubfolderId, rootFolderId) {
  if (!selectedSubfolderId) return [];

  const byId = new Map(subfolders.map((folder) => [toId(folder._id), folder]));
  const path = [];
  let current = byId.get(selectedSubfolderId);
  const rootId = rootFolderId ? toId(rootFolderId) : null;

  while (current) {
    path.unshift({ id: toId(current._id), name: current.name });
    const parentId = current.parentFolderId ? toId(current.parentFolderId) : null;
    if (!parentId || parentId === rootId) break;
    current = byId.get(parentId);
  }

  return path;
}

/** Parent subfolder id, or null when already at root of the tree. */
export function getParentSubfolderId(subfolders, selectedSubfolderId, rootFolderId) {
  if (!selectedSubfolderId) return null;

  const folder = subfolders.find((item) => toId(item._id) === selectedSubfolderId);
  if (!folder?.parentFolderId) return null;

  const parentId = toId(folder.parentFolderId);
  const rootId = rootFolderId ? toId(rootFolderId) : null;

  return parentId === rootId ? null : parentId;
}
