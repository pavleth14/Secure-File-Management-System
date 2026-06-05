import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    groupId: '',
  });

  const canChangePassword = (user) => {
    if (user.role === 'SUPER_ADMIN') return false;
    if (isSuperAdmin) return true;
    return user.role === 'USER';
  };

  const load = async () => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        api.get('/users'),
        api.get('/groups'),
      ]);
      setUsers(usersRes.data.users);
      setGroups(groupsRes.data.groups);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', {
        ...form,
        groupId: form.groupId || null,
      });
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'USER', groupId: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleGroupChange = async (userId, groupId) => {
    try {
      await api.put(`/users/${userId}`, { groupId: groupId || null });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordUser || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      await api.put(`/users/${passwordUser.id}`, { password: newPassword });
      setPasswordUser(null);
      setNewPassword('');
      setSuccess(`Password updated for ${passwordUser.name}.`);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      {passwordUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPasswordUser(null)}
        >
          <form
            onSubmit={handlePasswordSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Change password</h2>
            <p className="mb-4 text-sm text-slate-500">{passwordUser.name} ({passwordUser.email})</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              required
              minLength={8}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Save password
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordUser(null);
                  setNewPassword('');
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? 'Cancel' : 'Add user'}
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

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded-lg border px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="rounded-lg border px-3 py-2"
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="rounded-lg border px-3 py-2"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="rounded-lg border px-3 py-2"
            >
              <option value="USER">USER</option>
              {isSuperAdmin && <option value="ADMIN">ADMIN</option>}
            </select>
            <select
              value={form.groupId}
              onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              className="rounded-lg border px-3 py-2 sm:col-span-2"
            >
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            Create user
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Group
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-sm font-medium">{user.name}</td>
                <td className="px-4 py-3 text-sm">{user.email}</td>
                <td className="px-4 py-3 text-sm">{user.role}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.groupId || ''}
                    onChange={(e) => handleGroupChange(user.id, e.target.value)}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value="">None</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canChangePassword(user) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordUser(user);
                        setNewPassword('');
                        setSuccess('');
                      }}
                      className="mr-3 text-sm text-brand-600 hover:underline"
                    >
                      Password
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(user.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
