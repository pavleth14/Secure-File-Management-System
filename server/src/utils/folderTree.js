import { Folder } from '../models/Folder.js';

export async function getDescendantsFlat(rootId) {
  const items = [];
  const queue = [{ id: rootId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    const children = await Folder.find({ parentFolderId: id }).sort({ name: 1 });

    for (const child of children) {
      items.push({
        ...child.toObject(),
        depth: depth + 1,
      });
      queue.push({ id: child._id, depth: depth + 1 });
    }
  }

  return items;
}

export async function countFolderTreeContents(rootId) {
  const descendants = await getDescendantsFlat(rootId);
  return descendants.length;
}
