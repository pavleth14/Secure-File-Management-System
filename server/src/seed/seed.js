import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Folder } from '../models/Folder.js';
import {
  ROLES,
  GROUP_NAMES,
  ROOT_FOLDER_NAMES,
  PERMISSIONS,
} from '../config/constants.js';
import { UPLOADS_BASE } from '../config/multer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_GROUP_PERMISSIONS = {
  eld: { folder: 'folder1', actions: [PERMISSIONS.READ, PERMISSIONS.UPLOAD] },
  dispatch: {
    folder: 'folder2',
    actions: [PERMISSIONS.READ, PERMISSIONS.DOWNLOAD],
  },
  safety: { folder: 'folder3', actions: [PERMISSIONS.READ, PERMISSIONS.DELETE] },
  maintenance: {
    folder: 'folder4',
    actions: [PERMISSIONS.READ, PERMISSIONS.UPLOAD, PERMISSIONS.EDIT],
  },
};

export async function seedDatabase() {
  fs.mkdirSync(UPLOADS_BASE, { recursive: true });

  const rootFolders = {};
  for (const name of ROOT_FOLDER_NAMES) {
    let folder = await Folder.findOne({ name, isRoot: true });
    if (!folder) {
      folder = await Folder.create({ name, isRoot: true, parentFolderId: null });
      const dir = path.join(UPLOADS_BASE, name);
      fs.mkdirSync(dir, { recursive: true });
    }
    rootFolders[name] = folder;
  }

  for (const groupName of GROUP_NAMES) {
    let group = await Group.findOne({ name: groupName });
    const config = DEFAULT_GROUP_PERMISSIONS[groupName];
    const folder = rootFolders[config?.folder];

    const permissions = folder
      ? [
          {
            folderId: folder._id,
            subfolderId: null,
            allowedActions: config.actions,
          },
        ]
      : [];

    if (!group) {
      await Group.create({ name: groupName, permissions });
    } else if (group.permissions.length === 0 && permissions.length) {
      group.permissions = permissions;
      await group.save();
    }
  }

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('SUPER_ADMIN_EMAIL/PASSWORD not set — skipping super admin seed');
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });

  if (!existing) {
    await User.create({
      name: 'Super Admin',
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: ROLES.SUPER_ADMIN,
      groupId: null,
    });
    console.log('Super admin created');
  } else {
    // Keep the super admin account synchronized with the configured environment
    // variables. Re-running the seed (it runs on every server start) re-applies
    // the SUPER_ADMIN role and re-syncs the password whenever SUPER_ADMIN_PASSWORD
    // changes, so the password can be rotated through env config alone — without
    // editing code or running manual DB updates. The bcrypt.compare check keeps
    // this idempotent: the hash is only rewritten when the password differs.
    let changed = false;

    if (existing.role !== ROLES.SUPER_ADMIN) {
      existing.role = ROLES.SUPER_ADMIN;
      changed = true;
    }

    const passwordMatches = await bcrypt.compare(password, existing.passwordHash);
    if (!passwordMatches) {
      existing.passwordHash = await bcrypt.hash(password, 12);
      changed = true;
    }

    if (changed) {
      await existing.save();
      console.log('Super admin synchronized with environment configuration');
    }
  }

  console.log('Database seed completed');
}
