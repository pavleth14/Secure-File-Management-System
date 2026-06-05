import { useEffect, useState } from 'react';
import api from '../api/client';
import PermissionBadge from '../components/PermissionBadge';

const ALL_ACTIONS = ['READ', 'UPLOAD', 'DOWNLOAD', 'EDIT', 'DELETE', 'MOVE'];

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
      permissions: (group.permissions || []).map(normalizePermission),
    });
  };

  const addPermission = () => {
    if (!folders.length) {
      setError('No folders available. Create root folders first.');
      return;
    }
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        permissions: [
          ...prev.permissions,
          {
            folderId: toId(folders[0]._id),
            subfolderId: null,
            allowedActions: ['READ'],
          },
        ],
      };
    });
  };

  const updatePermission = (index, field, value) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const permissions = prev.permissions.map((perm, i) =>
        i === index ? { ...perm, [field]: value } : perm
      );
      return { ...prev, permissions };
    });
  };

  const toggleAction = (permIndex, action) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const permissions = prev.permissions.map((perm, i) => {
        if (i !== permIndex) return perm;
        const allowedActions = perm.allowedActions.includes(action)
          ? perm.allowedActions.filter((a) => a !== action)
          : [...perm.allowedActions, action];
        return { ...perm, allowedActions };
      });
      return { ...prev, permissions };
    });
  };

  const removePermission = (index) => {
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        permissions: prev.permissions.filter((_, i) => i !== index),
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
        permissions: editing.permissions.map((p) => ({
          folderId: p.folderId,
          subfolderId: p.subfolderId || null,
          allowedActions: p.allowedActions,
        })),
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

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Groups & ACL Permissions</h1>
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
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreateGroup}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-3 font-semibold text-slate-900">Create new group</h2>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name (e.g. logistics)"
              required
              className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create group'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            New groups start with READ on the first folder. Edit permissions after creation.
          </p>
        </form>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const groupId = toId(group._id);
          const isEditing = editing?.id === groupId;

          return (
            <div
              key={groupId}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold capitalize">{group.name}</h2>
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
                  {editing.permissions.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No permissions yet. Add a folder permission below.
                    </p>
                  ) : (
                    editing.permissions.map((perm, idx) => (
                      <div
                        key={`${groupId}-perm-${idx}`}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <select
                            value={perm.folderId}
                            onChange={(e) =>
                              updatePermission(idx, 'folderId', e.target.value)
                            }
                            className="rounded border border-slate-300 px-3 py-2 text-sm"
                          >
                            {folders.map((f) => (
                              <option key={toId(f._id)} value={toId(f._id)}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removePermission(idx)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {ALL_ACTIONS.map((action) => (
                            <label
                              key={action}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={perm.allowedActions.includes(action)}
                                onChange={() => toggleAction(idx, action)}
                                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                              />
                              {action}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={addPermission}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    + Add folder permission
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
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {group.permissions.length === 0 ? (
                    <p className="text-sm text-slate-500">No permissions configured</p>
                  ) : (
                    group.permissions.map((perm, idx) => (
                      <div
                        key={`${groupId}-view-${idx}`}
                        className="flex flex-wrap items-center gap-2 text-sm text-slate-600"
                      >
                        <span className="font-medium">
                          {perm.folderId?.name || 'Folder'}
                          {perm.subfolderId && ' (subfolder)'}
                        </span>
                        {perm.allowedActions.map((a) => (
                          <PermissionBadge key={a} permission={a} />
                        ))}
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
