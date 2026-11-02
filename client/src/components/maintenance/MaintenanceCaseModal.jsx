import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../ConfirmDialog';
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_OOS_STATUSES,
  MAINTENANCE_TAG_TYPES,
} from '../../constants/maintenanceConstants';
import MaintenanceTagPill from './MaintenanceTagPill';
import MaintenanceReplaceCaseStatusDialog from './MaintenanceReplaceCaseStatusDialog';
import MaintenanceEditTagDialog from './MaintenanceEditTagDialog';
import { useContextMenu } from '../../hooks/useContextMenu';

const TAG_FORM_FIELD_BY_TYPE = {
  case_status: 'caseStatus',
  project: 'project',
  case_type: 'caseType',
  invoice_status: 'invoiceStatus',
  dispatch_status: 'dispatchStatus',
};

const TAG_UI_LABEL_BY_TYPE = {
  case_status: 'status',
  project: 'project',
  case_type: 'type',
  invoice_status: 'invoice status',
  dispatch_status: 'dispatch status',
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const ATTACHMENT_ACCEPT =
  'image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.gif,.heic';

const FORM_DIRTY_KEYS = [
  'issue',
  'assigneeId',
  'dueDate',
  'truckId',
  'trailerId',
  'caseStatus',
  'priority',
  'project',
  'oosStatus',
  'caseType',
  'repairShop',
  'issueDescription',
  'invoiceStatus',
  'dateClosed',
  'dispatchStatus',
  'cost',
  'estimatedCost',
];

function serializeFormSnapshot(form) {
  const out = {};
  for (const key of FORM_DIRTY_KEYS) {
    const value = form?.[key];
    out[key] = value === null || value === undefined ? '' : String(value);
  }
  return JSON.stringify(out);
}

function buildEmptyForm(canPickAnyAssignee, userId) {
  return {
    issue: '',
    assigneeId: canPickAnyAssignee ? '' : userId || '',
    dueDate: '',
    truckId: '',
    trailerId: '',
    truckNumber: '',
    trailerNumber: '',
    caseStatus: 'Open',
    priority: 'Normal',
    project: '',
    oosStatus: 'In Service',
    caseType: '',
    repairShop: '',
    issueDescription: '',
    invoiceStatus: '',
    dateClosed: '',
    dispatchStatus: '',
    cost: '',
    estimatedCost: '',
  };
}

function buildFormFromCaseData(caseData) {
  return {
    ...caseData,
    dueDate: caseData.dueDate ? caseData.dueDate.slice(0, 10) : '',
    dateClosed: caseData.dateClosed ? caseData.dateClosed.slice(0, 10) : '',
    cost: caseData.cost != null && caseData.cost !== '' ? String(caseData.cost) : '',
    estimatedCost:
      caseData.estimatedCost != null && caseData.estimatedCost !== ''
        ? String(caseData.estimatedCost)
        : '',
  };
}

function tagNamesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function TagField({
  label,
  type,
  value,
  onChange,
  readOnly,
  tags,
  onCreateTag,
  manageTags,
  onEditTag,
  onDeleteTag,
}) {
  const [color, setColor] = useState('#6366F1');
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const { openContextMenu, contextMenuNode } = useContextMenu();

  const handleSaveTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    if (tags.some((tag) => tagNamesMatch(tag.name, name))) {
      const existing = tags.find((tag) => tagNamesMatch(tag.name, name));
      onChange(existing.name);
      setNewTagName('');
      setShowCreate(false);
      return;
    }
    const createdName = await onCreateTag(type, name, color);
    onChange(createdName || name);
    setNewTagName('');
    setShowCreate(false);
  };

  const selectedColor = tags.find((t) => tagNamesMatch(t.name, value))?.color;

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
                onContextMenu={(event) => {
                  if (!manageTags || readOnly || !onDeleteTag || !onEditTag) return;
                  if (String(tag.id).startsWith('default:')) return;
                  openContextMenu(event, [
                    {
                      id: 'edit-tag',
                      label: 'Edit',
                      onClick: () => onEditTag(tag),
                    },
                    {
                      id: 'delete-tag',
                      label: 'Delete',
                      onClick: () => onDeleteTag(tag),
                    },
                  ]);
                }}
                className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                  tagNamesMatch(value, tag.name) ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                }`}
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </button>
            ))}
            {value && !tags.some((t) => tagNamesMatch(t.name, value)) && (
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
      {contextMenuNode}
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
  currentUserId,
}) {
  const { user, isSuperAdmin, isMaintenanceManager, canEditMaintenanceCases } = useAuth();
  const canPickAnyAssignee = isSuperAdmin || isMaintenanceManager;
  const resolvedUserId = currentUserId || user?.id;

  const [form, setForm] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [tags, setTags] = useState({});
  const [commentText, setCommentText] = useState('');
  const [initialFormSnapshot, setInitialFormSnapshot] = useState('');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState([]);
  const [error, setError] = useState('');
  const [tagDelete, setTagDelete] = useState(null);
  const [tagDeleteError, setTagDeleteError] = useState('');
  const [tagDeleteSubmitting, setTagDeleteSubmitting] = useState(false);
  const [tagEdit, setTagEdit] = useState(null);
  const [tagEditError, setTagEditError] = useState('');
  const [tagEditSubmitting, setTagEditSubmitting] = useState(false);

  const canUploadAttachments = useMemo(() => {
    if (!caseData?.id) return false;
    if (canEditMaintenanceCases) return true;
    const uid = resolvedUserId ? String(resolvedUserId) : '';
    if (!uid) return false;
    if (caseData.assigneeId && String(caseData.assigneeId) === uid) return true;
    if (caseData.createdById && String(caseData.createdById) === uid) return true;
    return false;
  }, [caseData, canEditMaintenanceCases, resolvedUserId]);

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

  const formSessionKey = open ? caseData?.id ?? 'new' : '';

  useEffect(() => {
    if (!open) {
      setForm(null);
      setInitialFormSnapshot('');
      setCommentText('');
      setDiscardConfirmOpen(false);
      setError('');
      setPendingAttachmentFiles([]);
      setUploadError('');
      return;
    }

    const nextForm = caseData
      ? buildFormFromCaseData(caseData)
      : buildEmptyForm(canPickAnyAssignee, user?.id);

    setForm(nextForm);
    setInitialFormSnapshot(serializeFormSnapshot(nextForm));
    setCommentText('');
    setDiscardConfirmOpen(false);
    setError('');
    setPendingAttachmentFiles([]);
    setUploadError('');
    // Re-init only when opening or switching case; omit caseData so comment refresh does not reset edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caseData read when formSessionKey changes
  }, [open, formSessionKey, canPickAnyAssignee, user?.id]);

  const isFormDirty =
    Boolean(form) &&
    (serializeFormSnapshot(form) !== initialFormSnapshot ||
      commentText.trim().length > 0 ||
      pendingAttachmentFiles.length > 0);

  const requestClose = useCallback(() => {
    if (readOnly || !isFormDirty) {
      onClose();
      return;
    }
    setDiscardConfirmOpen(true);
  }, [readOnly, isFormDirty, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !discardConfirmOpen) {
        event.preventDefault();
        requestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, discardConfirmOpen, requestClose]);

  if (!open || !form) return null;

  const handleCreateTag = async (type, name, color) => {
    const { data } = await api.post(`/maintenance/tags/${type}`, { name, color });
    await loadTags();
    return data.tag?.name;
  };

  const manageTagProps = readOnly
    ? {}
    : {
        manageTags: true,
        onEditTag: (tag) => {
          setTagEdit({ tag });
          setTagEditError('');
        },
        onDeleteTag: (tag) => requestDeleteTag(tag),
      };

  const updateFormFieldIfMatched = (tagType, oldName, newName) => {
    const field = TAG_FORM_FIELD_BY_TYPE[tagType];
    if (!field) return;
    setForm((prev) => {
      if (!tagNamesMatch(prev[field], oldName)) return prev;
      return { ...prev, [field]: newName ?? '' };
    });
  };

  const requestDeleteTag = async (tag) => {
    const label = TAG_UI_LABEL_BY_TYPE[tag.type] || 'tag';
    try {
      const { data } = await api.get(`/maintenance/tags/by-id/${tag.id}/usage`);
      if (data.count === 0) {
        if (!window.confirm(`Delete ${label} "${tag.name}"?`)) return;
        await api.delete(`/maintenance/tags/by-id/${tag.id}`, { data: {} });
        await loadTags();
        updateFormFieldIfMatched(tag.type, tag.name, '');
        return;
      }
      setTagDelete({ tag, count: data.count });
      setTagDeleteError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check tag usage');
    }
  };

  const confirmDeleteTag = async (payload) => {
    if (!tagDelete?.tag?.id) return;
    setTagDeleteSubmitting(true);
    setTagDeleteError('');
    try {
      const { data } = await api.delete(`/maintenance/tags/by-id/${tagDelete.tag.id}`, {
        data: payload,
      });
      await loadTags();
      const replacement =
        data.replacementName ||
        payload.replacementName ||
        payload.newReplacement?.name ||
        '';
      updateFormFieldIfMatched(tagDelete.tag.type, tagDelete.tag.name, replacement);
      setTagDelete(null);
    } catch (err) {
      setTagDeleteError(err.response?.data?.message || 'Failed to delete tag');
    } finally {
      setTagDeleteSubmitting(false);
    }
  };

  const confirmEditTag = async ({ name, color }) => {
    if (!tagEdit?.tag?.id) return;
    setTagEditSubmitting(true);
    setTagEditError('');
    try {
      const oldName = tagEdit.tag.name;
      const { data } = await api.patch(`/maintenance/tags/by-id/${tagEdit.tag.id}`, {
        name,
        color,
      });
      await loadTags();
      updateFormFieldIfMatched(tagEdit.tag.type, oldName, data.tag?.name || name);
      setTagEdit(null);
    } catch (err) {
      setTagEditError(err.response?.data?.message || 'Failed to update tag');
    } finally {
      setTagEditSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setUploadError('');
    try {
      const savedCase = await onSave(form);
      const caseId = savedCase?.id || caseData?.id;
      if (caseId && pendingAttachmentFiles.length && onUpload) {
        for (const file of pendingAttachmentFiles) {
          await onUpload(caseId, file);
        }
        setPendingAttachmentFiles([]);
      }
      setDiscardConfirmOpen(false);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !caseData?.id) return;
    await onComment(caseData.id, commentText.trim());
    setCommentText('');
  };

  const handleDownloadAttachment = async (fileId, originalName) => {
    if (!caseData?.id) return;
    try {
      const { data } = await api.get(
        `/maintenance/cases/${caseData.id}/attachments/${fileId}/download`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = originalName || 'attachment';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Failed to download file');
    }
  };

  const handleAttachmentUpload = async (file) => {
    if (!caseData?.id || !onUpload) return;
    setUploading(true);
    setUploadError('');
    try {
      await onUpload(caseData.id, file);
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleQueueAttachment = (file) => {
    if (!file || readOnly) return;
    setUploadError('');
    setPendingAttachmentFiles((prev) => [...prev, file]);
  };

  const handleRemovePendingAttachment = (index) => {
    setPendingAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canAttachFiles =
    !readOnly &&
    onUpload &&
    (caseData ? canUploadAttachments : true);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
        role="presentation"
      >
        <div className="my-8 w-full max-w-4xl rounded-xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold">
            {caseData ? 'Edit maintenance case' : 'New maintenance case'}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            className="text-slate-500 hover:text-slate-800"
          >
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
                disabled={readOnly || (!canPickAnyAssignee && assignees.length <= 1)}
                value={form.assigneeId || ''}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value || null })}
              >
                {canPickAnyAssignee && <option value="">Unassigned</option>}
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
              {...manageTagProps}
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
              {...manageTagProps}
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
            {...manageTagProps}
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
              {...manageTagProps}
            />
            <TagField
              label="Dispatch status"
              type={MAINTENANCE_TAG_TYPES.dispatchStatus}
              value={form.dispatchStatus}
              onChange={(v) => setForm({ ...form, dispatchStatus: v })}
              readOnly={readOnly}
              tags={tags[MAINTENANCE_TAG_TYPES.dispatchStatus] || []}
              onCreateTag={handleCreateTag}
              {...manageTagProps}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Estimated price (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                readOnly={readOnly}
                value={form.estimatedCost ?? ''}
                onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Cost (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                readOnly={readOnly}
                value={form.cost ?? ''}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-slate-500">
                Final amount; used in cost reports. Upload invoice under Attachments.
              </p>
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Attachments (PDF & images)
            </label>
            {caseData ? (
              <ul className="space-y-1 text-sm">
                {(caseData.attachments || []).length === 0 ? (
                  <li className="text-slate-500">No attachments yet.</li>
                ) : (
                  (caseData.attachments || []).map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadAttachment(file.fileId, file.originalName)
                        }
                        className="text-left text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {file.originalName}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <ul className="space-y-1 text-sm">
                {pendingAttachmentFiles.length === 0 ? (
                  <li className="text-slate-500">
                    No files selected. Add PDF or images below — they upload when you save.
                  </li>
                ) : (
                  pendingAttachmentFiles.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-2">
                      <span className="truncate">{file.name}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemovePendingAttachment(index)}
                          className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
            {canAttachFiles && (
              <div className="mt-2">
                <input
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  className="text-sm"
                  disabled={uploading || saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (caseData) {
                      handleAttachmentUpload(file);
                    } else {
                      handleQueueAttachment(file);
                    }
                    e.target.value = '';
                  }}
                />
                {(uploading || (saving && pendingAttachmentFiles.length > 0)) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {saving && pendingAttachmentFiles.length > 0
                      ? 'Saving case and uploading attachments…'
                      : 'Uploading…'}
                  </p>
                )}
                {uploadError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                )}
              </div>
            )}
          </div>

          {caseData && (
            <>
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
              <button
                type="button"
                onClick={requestClose}
                className="rounded-lg border px-4 py-2 text-sm"
              >
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

      <MaintenanceReplaceCaseStatusDialog
        open={Boolean(tagDelete)}
        statusName={tagDelete?.tag?.name}
        caseCount={tagDelete?.count || 0}
        tagLabel={TAG_UI_LABEL_BY_TYPE[tagDelete?.tag?.type] || 'tag'}
        replacementOptions={(tags[tagDelete?.tag?.type] || []).map((tag) => tag.name)}
        onCancel={() => {
          if (!tagDeleteSubmitting) setTagDelete(null);
        }}
        onConfirm={confirmDeleteTag}
        submitting={tagDeleteSubmitting}
        error={tagDeleteError}
      />

      <MaintenanceEditTagDialog
        open={Boolean(tagEdit)}
        tagName={tagEdit?.tag?.name}
        tagColor={tagEdit?.tag?.color}
        tagLabel={TAG_UI_LABEL_BY_TYPE[tagEdit?.tag?.type] || 'tag'}
        onCancel={() => {
          if (!tagEditSubmitting) setTagEdit(null);
        }}
        onConfirm={confirmEditTag}
        submitting={tagEditSubmitting}
        error={tagEditError}
      />

      <ConfirmDialog
        open={discardConfirmOpen}
        title="Are you sure?"
        message="You have unsaved changes. Close without saving?"
        confirmLabel="Yes"
        cancelLabel="No"
        destructive
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          onClose();
        }}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
    </>
  );
}
