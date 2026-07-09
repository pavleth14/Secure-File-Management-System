import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import PermissionBadge from '../components/PermissionBadge';

const ALL_ACTIONS = ['READ', 'UPLOAD', 'DOWNLOAD', 'EDIT', 'DELETE', 'MOVE', 'FOLDER_CREATE'];

function toId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id?.toString?.() ?? value.toString?.() ?? '';
}

function normalizePermission(perm) {
  return {
    folderId: toId(perm.folderId),
    subfolderId: perm.subfolderId ? toId(perm.subfolderId) : null,
    allowedActions: [...(perm.allowedActions || [])],
  };
}

function permissionsToRootConfigs(permissions) {
  const map = new Map();

  for (const perm of permissions.map(normalizePermission)) {
    if (!map.has(perm.folderId)) {
      map.set(perm.folderId, {
        folderId: perm.folderId,
        allowedActions: [],
        subfolderConfigs: [],
      });
    }

    const entry = map.get(perm.folderId);
    if (!perm.subfolderId) {
      entry.allowedActions = perm.allowedActions;
    } else {
      entry.subfolderConfigs.push({
        subfolderId: perm.subfolderId,
        allowedActions: perm.allowedActions,
        enabled: true,
      });
    }
  }

  return Array.from(map.values());
}

function rootConfigsToPermissions(rootConfigs) {
  const permissions = [];

  for (const root of rootConfigs) {
    permissions.push({
      folderId: root.folderId,
      subfolderId: null,
      allowedActions: root.allowedActions || [],
    });

    for (const sub of root.subfolderConfigs || []) {
      if (!sub.enabled) continue;
      permissions.push({
        folderId: root.folderId,
        subfolderId: sub.subfolderId,
        allowedActions: sub.allowedActions || [],
      });
    }
  }

  return permissions;
}

function groupPermissionsForDisplay(permissions) {
  const grouped = new Map();

  for (const perm of permissions || []) {
    const rootId = toId(perm.folderId);
    if (!grouped.has(rootId)) {
      grouped.set(rootId, {
        rootName: perm.folderId?.name || 'Folder',
        rootActions: [],
        subfolders: [],
      });
    }

    const entry = grouped.get(rootId);
    if (perm.subfolderId) {
      entry.subfolders.push({
        name: perm.subfolderId?.name || 'Subfolder',
        actions: perm.allowedActions || [],
      });
    } else {
      entry.rootActions = perm.allowedActions || [];
    }
  }

  return Array.from(grouped.values());
}

function mergeSubfolderConfigs(available, savedConfigs = []) {
  const existing = new Map(savedConfigs.map((sub) => [sub.subfolderId, sub]));

  const merged = available.map((sub) => {
    const saved = existing.get(sub.subfolderId);
    return saved
      ? { ...saved, name: sub.name, parentFolderId: sub.parentFolderId }
      : {
          subfolderId: sub.subfolderId,
          name: sub.name,
          parentFolderId: sub.parentFolderId,
          allowedActions: ['READ'],
          enabled: false,
        };
  });

  for (const saved of existing.values()) {
    if (!merged.some((sub) => sub.subfolderId === saved.subfolderId)) {
      merged.push(saved);
    }
  }

  return merged;
}

function getDescendantIds(subfolderId, allSubfolders) {
  const descendants = new Set();
  const byParent = new Map();

  for (const sub of allSubfolders) {
    const parentId = toId(sub.parentFolderId);
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(sub.subfolderId);
  }

  const queue = [subfolderId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const childId of byParent.get(toId(current)) || []) {
      if (!descendants.has(childId)) {
        descendants.add(childId);
        queue.push(childId);
      }
    }
  }

  return descendants;
}

function buildVisibleSubfolderList(rootId, allSubfolders, configsById) {
  const rootIdStr = toId(rootId);
  const byParent = new Map();

  for (const sub of allSubfolders) {
    const parentId = toId(sub.parentFolderId);
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(sub);
  }

  const result = [];

  const walk = (parentId, depth) => {
    const children = (byParent.get(parentId) || []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const child of children) {
      const saved = configsById.get(child.subfolderId);
      const entry = {
        subfolderId: child.subfolderId,
        name: child.name,
        parentFolderId: child.parentFolderId,
        allowedActions: saved?.allowedActions || ['READ'],
        enabled: saved?.enabled || false,
        depth,
      };
      result.push(entry);
      if (entry.enabled) {
        walk(child.subfolderId, depth + 1);
      }
    }
  };

  walk(rootIdStr, 0);
  return result;
}

function RootFolderPermissionsEditor({
  config,
  index,
  folders,
  usedRootIds,
  onChange,
  onRemove,
}) {
  const [loadingSubfolders, setLoadingSubfolders] = useState(false);
  const [subfolderSearch, setSubfolderSearch] = useState('');
  const [subfoldersOpen, setSubfoldersOpen] = useState(true);
  const [allSubfoldersTree, setAllSubfoldersTree] = useState([]);
  const [displaySubfolders, setDisplaySubfolders] = useState(config.subfolderConfigs || []);

  useEffect(() => {
    if (!config.folderId) return undefined;

    let cancelled = false;
    setLoadingSubfolders(true);

    api
      .get(`/folders/${config.folderId}/tree`)
      .then(({ data }) => {
        if (cancelled) return;
        const allFromApi = (data.subfolders || []).map((sub) => ({
          subfolderId: toId(sub._id),
          name: sub.name,
          parentFolderId: toId(sub.parentFolderId),
        }));
        setAllSubfoldersTree(allFromApi);
        setDisplaySubfolders(mergeSubfolderConfigs(allFromApi, config.subfolderConfigs));
      })
      .catch(() => {
        if (cancelled) return;
        setAllSubfoldersTree([]);
        setDisplaySubfolders(mergeSubfolderConfigs([], config.subfolderConfigs));
      })
      .finally(() => {
        if (!cancelled) setLoadingSubfolders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config.folderId]);

  const updateRoot = (updater) => onChange(index, updater);

  const persistSubfolderConfigs = (nextSubfolders) => {
    setDisplaySubfolders(nextSubfolders);
    onChange(index, (current) => ({
      ...current,
      subfolderConfigs: nextSubfolders,
    }));
  };

  const toggleRootAction = (action) => {
    updateRoot((current) => ({
      ...current,
      allowedActions: current.allowedActions.includes(action)
        ? current.allowedActions.filter((a) => a !== action)
        : [...current.allowedActions, action],
    }));
  };

  const toggleSubfolderEnabled = (subfolderId) => {
    const target = displaySubfolders.find((sub) => sub.subfolderId === subfolderId);
    const turningOff = target?.enabled;
    const descendantIds = turningOff ? getDescendantIds(subfolderId, allSubfoldersTree) : new Set();

    const next = displaySubfolders.map((sub) => {
      if (sub.subfolderId === subfolderId) {
        return { ...sub, enabled: !sub.enabled };
      }
      if (turningOff && descendantIds.has(sub.subfolderId)) {
        return { ...sub, enabled: false };
      }
      return sub;
    });
    persistSubfolderConfigs(next);
  };

  const toggleSubfolderAction = (subfolderId, action) => {
    const next = displaySubfolders.map((sub) => {
      if (sub.subfolderId !== subfolderId) return sub;
      const allowedActions = sub.allowedActions.includes(action)
        ? sub.allowedActions.filter((a) => a !== action)
        : [...sub.allowedActions, action];
      return { ...sub, allowedActions };
    });
    persistSubfolderConfigs(next);
  };

  const configsById = new Map(displaySubfolders.map((sub) => [sub.subfolderId, sub]));
  const visibleSubfolders = buildVisibleSubfolderList(
    config.folderId,
    allSubfoldersTree,
    configsById
  );
  const filteredSubfolders = visibleSubfolders.filter((sub) =>
    sub.name?.toLowerCase().includes(subfolderSearch.trim().toLowerCase())
  );
  const hasTopLevelSubfolders = allSubfoldersTree.some(
    (sub) => toId(sub.parentFolderId) === toId(config.folderId)
  );

  const rootFolderName =
    folders.find((folder) => toId(folder._id) === config.folderId)?.name || 'Root folder';

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={config.folderId}
          onChange={(e) =>
            updateRoot((current) => ({
              ...current,
              folderId: e.target.value,
              subfolderConfigs: [],
            }))
          }
          className="rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          {folders.map((folder) => {
            const folderId = toId(folder._id);
            const disabled = usedRootIds.has(folderId) && folderId !== config.folderId;
            return (
              <option key={folderId} value={folderId} disabled={disabled}>
                {folder.name}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-600 hover:underline"
        >
          Remove root folder
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">
          Root folder permissions — {rootFolderName}
        </p>
        <div className="flex flex-wrap gap-3">
          {ALL_ACTIONS.map((action) => (
            <label
              key={action}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
            >
              <input
                type="checkbox"
                checked={config.allowedActions.includes(action)}
                onChange={() => toggleRootAction(action)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {action}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setSubfoldersOpen((open) => !open)}
          className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-800 dark:text-slate-100"
        >
          <span>Subfolders</span>
          <span>{subfoldersOpen ? '▼' : '▶'}</span>
        </button>

        {subfoldersOpen && (
          <div className="mt-3 space-y-3">
            <input
              type="search"
              value={subfolderSearch}
              onChange={(e) => setSubfolderSearch(e.target.value)}
              placeholder="Search subfolders..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />

            {loadingSubfolders ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading subfolders...</p>
            ) : !hasTopLevelSubfolders ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No subfolders in this root folder yet.
              </p>
            ) : filteredSubfolders.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No subfolders match your search.
              </p>
            ) : (
              filteredSubfolders.map((sub) => (
                <div
                  key={sub.subfolderId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"
                  style={{ marginLeft: `${sub.depth * 16}px` }}
                >
                  <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={sub.enabled}
                      onChange={() => toggleSubfolderEnabled(sub.subfolderId)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {sub.name}
                  </label>

                  {sub.enabled && (
                    <div className="ml-6 flex flex-wrap gap-3">
                      {ALL_ACTIONS.map((action) => (
                        <label
                          key={`${sub.subfolderId}-${action}`}
                          className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={sub.allowedActions.includes(action)}
                            onChange={() => toggleSubfolderAction(sub.subfolderId, action)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          {action}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only top-level subfolders are shown initially. Enable a subfolder to reveal its
              nested subfolders. If none are selected, users can access all subfolders using the
              root folder permissions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [groupsRes, foldersRes] = await Promise.all([
        api.get('/groups'),
        api.get('/folders'),
      ]);
      setGroups(groupsRes.data.groups);
      setFolders(foldersRes.data.folders);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (group) => {
    setSuccess('');
    setEditing({
      id: toId(group._id),
      name: group.name,
      rootConfigs: permissionsToRootConfigs(group.permissions || []),
    });
  };

  const updateRootConfig = useCallback((index, updater) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const rootConfigs = prev.rootConfigs.map((config, i) =>
        i === index ? updater(config) : config
      );
      return { ...prev, rootConfigs };
    });
  }, []);

  const addRootFolder = () => {
    if (!folders.length) {
      setError('No folders available. Create root folders first.');
      return;
    }

    setEditing((prev) => {
      if (!prev) return prev;
      const used = new Set(prev.rootConfigs.map((config) => config.folderId));
      const nextFolder = folders.find((folder) => !used.has(toId(folder._id))) || folders[0];

      return {
        ...prev,
        rootConfigs: [
          ...prev.rootConfigs,
          {
            folderId: toId(nextFolder._id),
            allowedActions: ['READ'],
            subfolderConfigs: [],
          },
        ],
      };
    });
  };

  const removeRootFolder = (index) => {
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rootConfigs: prev.rootConfigs.filter((_, i) => i !== index),
      };
    });
  };

  const savePermissions = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        permissions: rootConfigsToPermissions(editing.rootConfigs),
      };
      await api.put(`/groups/${editing.id}`, payload);
      setEditing(null);
      setSuccess('Permissions saved successfully.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const name = newGroupName.trim().toLowerCase();
    if (!name) {
      setError('Group name is required');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/groups', {
        name,
        permissions: folders.length
          ? [
              {
                folderId: toId(folders[0]._id),
                subfolderId: null,
                allowedActions: ['READ'],
              },
            ]
          : [],
      });
      setNewGroupName('');
      setShowCreate(false);
      setSuccess(`Group "${name}" created.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!confirm(`Delete group "${groupName}"? Users in this group will need reassignment.`)) {
      return;
    }
    setError('');
    try {
      await api.delete(`/groups/${groupId}`);
      setSuccess(`Group "${groupName}" deleted.`);
      if (editing?.id === groupId) setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete group');
    }
  };

  if (loading) return <div className="text-slate-500 dark:text-slate-400">Loading...</div>;

  const usedRootIds = new Set((editing?.rootConfigs || []).map((config) => config.folderId));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Groups & ACL Permissions</h1>
        <button
          type="button"
          onClick={() => {
            setShowCreate(!showCreate);
            setError('');
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showCreate ? 'Cancel' : '+ New group'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          {success}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreateGroup}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Create new group</h2>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name (e.g. logistics)"
              required
              className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create group'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            New groups start with READ on the first folder. Edit permissions after creation.
          </p>
        </form>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const groupId = toId(group._id);
          const isEditing = editing?.id === groupId;
          const displayGroups = groupPermissionsForDisplay(group.permissions);

          return (
            <div
              key={groupId}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold capitalize text-slate-900 dark:text-slate-100">{group.name}</h2>
                <div className="flex gap-3">
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(group)}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      Edit permissions
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(groupId, group.name)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  {editing.rootConfigs.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No root folders assigned. Add a root folder below.
                    </p>
                  ) : (
                    editing.rootConfigs.map((config, idx) => (
                      <RootFolderPermissionsEditor
                        key={`${config.folderId}-${idx}`}
                        config={config}
                        index={idx}
                        folders={folders}
                        usedRootIds={usedRootIds}
                        onChange={updateRootConfig}
                        onRemove={() => removeRootFolder(idx)}
                      />
                    ))
                  )}

                  <button
                    type="button"
                    onClick={addRootFolder}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    + Add root folder
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={savePermissions}
                      disabled={saving}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayGroups.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No permissions configured</p>
                  ) : (
                    displayGroups.map((entry, idx) => (
                      <div key={`${groupId}-view-${idx}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Root folder: {entry.rootName}
                        </p>
                        <div className="mb-2 flex flex-wrap gap-2">
                          {entry.rootActions.map((action) => (
                            <PermissionBadge key={`root-${action}`} permission={action} />
                          ))}
                        </div>
                        {entry.subfolders.length > 0 && (
                          <div className="space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Subfolders
                            </p>
                            {entry.subfolders.map((sub, subIdx) => (
                              <div key={`${groupId}-sub-${subIdx}`} className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-medium text-slate-700 dark:text-slate-200">{sub.name}</span>
                                {sub.actions.map((action) => (
                                  <PermissionBadge key={`${sub.name}-${action}`} permission={action} />
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
