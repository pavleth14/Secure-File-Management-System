import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_OOS_STATUSES,
  MAINTENANCE_TAG_TYPES,
} from '../../constants/maintenanceConstants';
import MaintenanceTagPill from './MaintenanceTagPill';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function TagField({ label, type, value, onChange, readOnly, tags, onCreateTag }) {
  const [color, setColor] = useState('#6366F1');
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const handleSaveTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    onCreateTag(type, name, color);
    onChange(name);
    setNewTagName('');
    setShowCreate(false);
  };

  const selectedColor = tags.find((t) => t.name === value)?.color;

  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-slate-500">{label}</label>
      {readOnly ? (
        <MaintenanceTagPill label={value} color={selectedColor} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => onChange(tag.name)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                  value === tag.name ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                }`}
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </button>
            ))}
            {value && !tags.some((t) => t.name === value) && (
              <MaintenanceTagPill label={value} color={selectedColor} />
            )}
            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-base font-medium leading-none transition-colors ${
                showCreate
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-500'
              }`}
              title="Add new tag"
              aria-label={`Add new ${label} tag`}
              aria-expanded={showCreate}
            >
              +
            </button>
          </div>
          {showCreate && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={`${inputClass} min-w-[10rem] flex-1`}
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveTag();
                  }
                }}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 shrink-0 rounded border dark:border-slate-600"
                title="Color for new tag"
              />
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-xs font-medium dark:border-slate-600"
                onClick={handleSaveTag}
              >
                Save tag
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => {
                  setShowCreate(false);
                  setNewTagName('');
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EquipmentSearch({ label, value, display, onSelect, readOnly, fetchUrl }) {
  const [query, setQuery] = useState(display || '');
  const [options, setOptions] = useState([]);

  useEffect(() => {
    setQuery(display || '');
  }, [display]);

  const search = useCallback(
    async (text) => {
      if (!text.trim()) {
        setOptions([]);
        return;
      }
      const { data } = await api.get(fetchUrl, { params: { search: text.trim() } });
      const list = data.trucks || data.trailers || [];
      setOptions(list.slice(0, 12));
    },
    [fetchUrl]
  );

  if (readOnly) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium uppercase text-slate-500">{label}</label>
        <p className="text-sm">{display || '—'}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium uppercase text-slate-500">{label}</label>
      <input
        className={inputClass}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          search(e.target.value);
        }}
        placeholder="Search number…"
      />
      {options.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-white shadow dark:border-slate-600 dark:bg-slate-800">
          {options.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => {
                  onSelect(item);
                  setQuery(item.truckNumber || item.trailerNumber);
                  setOptions([]);
                }}
              >
                {item.truckNumber || item.trailerNumber}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MaintenanceCaseModal({
  open,
  onClose,
  caseData,
  readOnly,
  canDelete,
  onSave,
  onDelete,
  onComment,
  onUpload,
}) {
  const [form, setForm] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [tags, setTags] = useState({});
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadTags = useCallback(async () => {
    const types = Object.values(MAINTENANCE_TAG_TYPES);
    const entries = await Promise.all(
      types.map(async (type) => {
        const { data } = await api.get(`/maintenance/tags/${type}`);
        return [type, data.tags || []];
      })
    );
    setTags(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    if (!open) return;
    loadTags();
    api.get('/maintenance/assignees').then(({ data }) => setAssignees(data.assignees || []));
  }, [open, loadTags]);

  useEffect(() => {
    if (!caseData) {
      setForm({
        issue: '',
        assigneeId: '',
        dueDate: '',
        truckId: '',
        trailerId: '',
        truckNumber: '',
        trailerNumber: '',
        caseStatus: '',
        priority: 'Normal',
        project: '',
        oosStatus: 'In Service',
        caseType: '',
        repairShop: '',
        issueDescription: '',
        invoiceStatus: '',
        dateClosed: '',
        dispatchStatus: '',
      });
      return;
    }
    setForm({
      ...caseData,
      dueDate: caseData.dueDate ? caseData.dueDate.slice(0, 10) : '',
      dateClosed: caseData.dateClosed ? caseData.dateClosed.slice(0, 10) : '',
    });
  }, [caseData, open]);

  if (!open || !form) return null;

  const handleCreateTag = async (type, name, color) => {
    await api.post(`/maintenance/tags/${type}`, { name, color });
    await loadTags();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !caseData?.id) return;
    await onComment(caseData.id, commentText.trim());
    setCommentText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-4xl rounded-xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold">
            {caseData ? 'Edit maintenance case' : 'New maintenance case'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">Issue</label>
            <input
              className={inputClass}
              required
              readOnly={readOnly}
              value={form.issue}
              onChange={(e) => setForm({ ...form, issue: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Assignee
              </label>
              <select
                className={inputClass}
                disabled={readOnly}
                value={form.assigneeId || ''}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.extension ? ` x${a.extension}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Due date
              </label>
              <input
                type="date"
                className={inputClass}
                readOnly={readOnly}
                value={form.dueDate || ''}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <EquipmentSearch
              label="Truck"
              fetchUrl="/dispatch/trucks"
              display={form.truckNumber}
              value={form.truckId}
              readOnly={readOnly}
              onSelect={(truck) =>
                setForm({ ...form, truckId: truck.id, truckNumber: truck.truckNumber })
              }
            />
            <EquipmentSearch
              label="Trailer"
              fetchUrl="/dispatch/trailers"
              display={form.trailerNumber}
              value={form.trailerId}
              readOnly={readOnly}
              onSelect={(trailer) =>
                setForm({
                  ...form,
                  trailerId: trailer.id,
                  trailerNumber: trailer.trailerNumber,
                })
              }
            />
          </div>

          {(form.truckId || form.trailerId) && (
            <div className="flex flex-wrap gap-3 text-sm">
              {form.truckId && (
                <Link
                  to={`/safety/trucks?search=${encodeURIComponent(form.truckNumber || '')}`}
                  className="text-brand-600 hover:underline"
                >
                  Open truck in Safety
                </Link>
              )}
              {form.trailerId && (
                <Link
                  to={`/safety/trailers?search=${encodeURIComponent(form.trailerNumber || '')}`}
                  className="text-brand-600 hover:underline"
                >
                  Open trailer in Safety
                </Link>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TagField
              label="Case status"
              type={MAINTENANCE_TAG_TYPES.caseStatus}
              value={form.caseStatus}
              onChange={(v) => setForm({ ...form, caseStatus: v })}
              readOnly={readOnly}
              tags={tags[MAINTENANCE_TAG_TYPES.caseStatus] || []}
              onCreateTag={handleCreateTag}
            />
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Priority
              </label>
              <select
                className={inputClass}
                disabled={readOnly}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {MAINTENANCE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TagField
              label="Project"
              type={MAINTENANCE_TAG_TYPES.project}
              value={form.project}
              onChange={(v) => setForm({ ...form, project: v })}
              readOnly={readOnly}
              tags={tags[MAINTENANCE_TAG_TYPES.project] || []}
              onCreateTag={handleCreateTag}
            />
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                OOS status
              </label>
              <select
                className={inputClass}
                disabled={readOnly}
                value={form.oosStatus}
                onChange={(e) => setForm({ ...form, oosStatus: e.target.value })}
              >
                {MAINTENANCE_OOS_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <TagField
            label="Case type"
            type={MAINTENANCE_TAG_TYPES.caseType}
            value={form.caseType}
            onChange={(v) => setForm({ ...form, caseType: v })}
            readOnly={readOnly}
            tags={tags[MAINTENANCE_TAG_TYPES.caseType] || []}
            onCreateTag={handleCreateTag}
          />

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Repair shop
            </label>
            <input
              className={inputClass}
              readOnly={readOnly}
              value={form.repairShop}
              onChange={(e) => setForm({ ...form, repairShop: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Issue description
            </label>
            <textarea
              className={inputClass}
              rows={4}
              readOnly={readOnly}
              value={form.issueDescription}
              onChange={(e) => setForm({ ...form, issueDescription: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TagField
              label="Invoice status"
              type={MAINTENANCE_TAG_TYPES.invoiceStatus}
              value={form.invoiceStatus}
              onChange={(v) => setForm({ ...form, invoiceStatus: v })}
              readOnly={readOnly}
              tags={tags[MAINTENANCE_TAG_TYPES.invoiceStatus] || []}
              onCreateTag={handleCreateTag}
            />
            <TagField
              label="Dispatch status"
              type={MAINTENANCE_TAG_TYPES.dispatchStatus}
              value={form.dispatchStatus}
              onChange={(v) => setForm({ ...form, dispatchStatus: v })}
              readOnly={readOnly}
              tags={tags[MAINTENANCE_TAG_TYPES.dispatchStatus] || []}
              onCreateTag={handleCreateTag}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Date closed
            </label>
            <input
              type="date"
              className={inputClass}
              readOnly={readOnly}
              value={form.dateClosed || ''}
              onChange={(e) => setForm({ ...form, dateClosed: e.target.value })}
            />
          </div>

          {caseData && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                  Attachments
                </label>
                <ul className="space-y-1 text-sm">
                  {(caseData.attachments || []).map((file) => (
                    <li key={file.id}>
                      <a
                        href={`/api/maintenance/cases/${caseData.id}/attachments/${file.fileId}/download`}
                        className="text-brand-600 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.originalName}
                      </a>
                    </li>
                  ))}
                </ul>
                {!readOnly && (
                  <input
                    type="file"
                    className="mt-2 text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUpload(caseData.id, file);
                      e.target.value = '';
                    }}
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                  Comments / updates
                </label>
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3 dark:border-slate-700">
                  {(caseData.comments || []).map((c) => (
                    <li key={c.id} className="text-sm">
                      <span className="font-medium">{c.author}</span>{' '}
                      <span className="text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                      <p className="whitespace-pre-wrap">{c.text}</p>
                    </li>
                  ))}
                </ul>
                {!readOnly && (
                  <div className="mt-2 flex gap-2">
                    <textarea
                      className={`${inputClass} flex-1`}
                      rows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add update…"
                    />
                    <button
                      type="button"
                      onClick={handleComment}
                      className="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white"
                    >
                      Post
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500">
                Last edited: {caseData.lastEditedAtLabel || '—'}
              </p>
              {(form.truckVin || form.trailerVin) && (
                <p className="text-xs text-slate-500">
                  VIN: {[form.truckVin, form.trailerVin].filter(Boolean).join(' / ')} · Specs:{' '}
                  {[form.truckSpecs, form.trailerSpecs].filter(Boolean).join(' / ')}
                </p>
              )}
            </>
          )}

          <div className="flex justify-between border-t pt-4 dark:border-slate-700">
            {canDelete && caseData ? (
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() => onDelete(caseData.id)}
              >
                Delete case
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
