import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaintenanceInfoContent from '../../components/maintenance/MaintenanceInfoContent';
import MaintenanceInfoEditor from '../../components/maintenance/MaintenanceInfoEditor';

export default function MaintenanceInfoPage({ slug, title }) {
  const { canEditMaintenanceInfoPages } = useAuth();
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ updatedAt: null, updatedByName: null });

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/maintenance/info-pages/${slug}`);
      const page = data.page || {};
      setContent(page.content || '');
      setMeta({
        updatedAt: page.updatedAt || null,
        updatedByName: page.updatedByName || null,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load page');
      setContent('');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const startEdit = () => {
    setDraft(content);
    setEditing(true);
    setError('');
  };

  const cancelEdit = () => {
    setDraft(content);
    setEditing(false);
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put(`/maintenance/info-pages/${slug}`, {
        content: draft,
      });
      const page = data.page || {};
      setContent(page.content || '');
      setMeta({
        updatedAt: page.updatedAt || null,
        updatedByName: page.updatedByName || null,
      });
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updatedLabel =
    meta.updatedAt &&
    new Date(meta.updatedAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        {canEditMaintenanceInfoPages && !editing && (
          <button
            type="button"
            onClick={startEdit}
            disabled={loading}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Edit
          </button>
        )}
        {canEditMaintenanceInfoPages && editing && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {updatedLabel && (
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Last updated {updatedLabel}
          {meta.updatedByName ? ` by ${meta.updatedByName}` : ''}
        </p>
      )}

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : editing ? (
          <MaintenanceInfoEditor
            slug={slug}
            pageTitle={title}
            value={draft}
            onChange={setDraft}
            disabled={saving}
          />
        ) : (
          <MaintenanceInfoContent content={content} />
        )}
      </div>
    </div>
  );
}
