import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { formatDate } from '../../utils/format';
import {
  canEditDriverType,
  canEditPersonalInfo,
  canEditStatus,
  sortCommentsNewestFirst,
} from '../../utils/leadPermissions';
import { DRIVER_TYPES, LEAD_STATUSES } from '../../constants/recruitingConstants';

const EDITABLE_FIELDS = [
  'status',
  'driverType',
  'firstName',
  'lastName',
  'phone',
  'stateCity',
  'email',
];

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function buildDraft(lead) {
  return {
    status: lead?.status || '',
    driverType: lead?.driverType || '',
    firstName: lead?.firstName || '',
    lastName: lead?.lastName || '',
    phone: lead?.phone || '',
    stateCity: lead?.stateCity || '',
    email: lead?.email || '',
  };
}

function getDraftChanges(original, draft) {
  const changes = {};
  for (const field of EDITABLE_FIELDS) {
    const originalValue = original[field] || '';
    const draftValue = draft[field] || '';
    if (draftValue !== originalValue) {
      changes[field] = draftValue;
    }
  }
  return changes;
}

export default function LeadViewModal({
  open,
  lead,
  onClose,
  onSave,
  isRecruitingManager = false,
  isRecruiter = false,
  isOwnBoard = false,
  readOnly = false,
}) {
  const [fullLead, setFullLead] = useState(lead);
  const [draft, setDraft] = useState(() => buildDraft(lead));
  const [editingFields, setEditingFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const permissionContext = useMemo(
    () => ({ isRecruitingManager, isRecruiter, isOwnBoard, readOnly }),
    [isRecruitingManager, isRecruiter, isOwnBoard, readOnly]
  );

  const displayLead = fullLead || lead;

  const fieldPermissions = useMemo(() => {
    if (!displayLead) {
      return {};
    }
    return {
      status: canEditStatus(displayLead, permissionContext),
      driverType: canEditDriverType(displayLead, permissionContext),
      firstName: canEditPersonalInfo(displayLead, permissionContext),
      lastName: canEditPersonalInfo(displayLead, permissionContext),
      phone: canEditPersonalInfo(displayLead, permissionContext),
      stateCity: canEditPersonalInfo(displayLead, permissionContext),
      email: canEditPersonalInfo(displayLead, permissionContext),
    };
  }, [displayLead, permissionContext]);

  const canSave = Boolean(onSave) && !readOnly;

  useEffect(() => {
    setFullLead(lead);
    setDraft(buildDraft(lead));
    setEditingFields({});
    setError('');
  }, [lead]);

  useEffect(() => {
    if (!open || !lead?.id) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');

    api
      .get(`/recruiting/leads/${lead.id}`)
      .then(({ data }) => {
        if (!cancelled) {
          setFullLead(data.lead);
          setDraft(buildDraft(data.lead));
          setEditingFields({});
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load lead details');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, lead?.id]);

  if (!open || !lead) return null;

  const comments = sortCommentsNewestFirst(displayLead?.comments);
  const hasUnsavedChanges = Object.keys(getDraftChanges(displayLead, draft)).length > 0;

  const startEditing = (field) => {
    setEditingFields((prev) => ({ ...prev, [field]: true }));
  };

  const updateDraft = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setDraft(buildDraft(displayLead));
    setEditingFields({});
    setError('');
    onClose();
  };

  const handleSave = async () => {
    if (!onSave || !displayLead) return;

    const changes = getDraftChanges(displayLead, draft);
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(displayLead.id, changes);
      setEditingFields({});
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-view-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h2
            id="lead-view-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {displayLead.firstName} {displayLead.lastName}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Lead details</p>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">Loading lead...</p>
        ) : (
          <>
            {error && (
              <p className="mx-5 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <EditableDetailField
                label="Status"
                field="status"
                value={draft.status}
                editable={fieldPermissions.status}
                editing={Boolean(editingFields.status)}
                onEdit={() => startEditing('status')}
                onChange={(value) => updateDraft('status', value)}
                type="select"
                options={LEAD_STATUSES}
              />
              <EditableDetailField
                label="Type of Driver"
                field="driverType"
                value={draft.driverType}
                editable={fieldPermissions.driverType}
                editing={Boolean(editingFields.driverType)}
                onEdit={() => startEditing('driverType')}
                onChange={(value) => updateDraft('driverType', value)}
                type="select"
                options={DRIVER_TYPES}
              />
              <DetailField label="Source" value={displayLead.source} />
              <DetailField
                label="Date"
                value={displayLead.date || formatDate(displayLead.createdAt)}
              />
              <EditableDetailField
                label="First Name"
                field="firstName"
                value={draft.firstName}
                editable={fieldPermissions.firstName}
                editing={Boolean(editingFields.firstName)}
                onEdit={() => startEditing('firstName')}
                onChange={(value) => updateDraft('firstName', value)}
              />
              <EditableDetailField
                label="Last Name"
                field="lastName"
                value={draft.lastName}
                editable={fieldPermissions.lastName}
                editing={Boolean(editingFields.lastName)}
                onEdit={() => startEditing('lastName')}
                onChange={(value) => updateDraft('lastName', value)}
              />
              <EditableDetailField
                label="Phone"
                field="phone"
                value={draft.phone}
                editable={fieldPermissions.phone}
                editing={Boolean(editingFields.phone)}
                onEdit={() => startEditing('phone')}
                onChange={(value) => updateDraft('phone', value)}
              />
              <EditableDetailField
                label="Email"
                field="email"
                value={draft.email}
                editable={fieldPermissions.email}
                editing={Boolean(editingFields.email)}
                onEdit={() => startEditing('email')}
                onChange={(value) => updateDraft('email', value)}
              />
              <EditableDetailField
                label="State / City"
                field="stateCity"
                value={draft.stateCity}
                editable={fieldPermissions.stateCity}
                editing={Boolean(editingFields.stateCity)}
                onEdit={() => startEditing('stateCity')}
                onChange={(value) => updateDraft('stateCity', value)}
                className="sm:col-span-2"
              />
            </div>

            <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Comments
              </h3>
              {comments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <p className="text-sm text-slate-900 dark:text-slate-100">{comment.text}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {comment.author || 'Unknown'} · {formatDate(comment.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          {canSave ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || !hasUnsavedChanges}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">{value || '—'}</dd>
    </div>
  );
}

function EditableDetailField({
  label,
  field,
  value,
  editable,
  editing,
  onEdit,
  onChange,
  type = 'text',
  options = [],
  className = '',
}) {
  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-2">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </dt>
        {editable && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            aria-label={`Edit ${label}`}
          >
            <span aria-hidden>✎</span>
            Edit
          </button>
        )}
      </div>

      {editable && editing ? (
        type === 'select' ? (
          <select
            id={`lead-field-${field}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
            autoFocus
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`lead-field-${field}`}
            type={field === 'email' ? 'email' : 'text'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
            autoFocus
          />
        )
      ) : (
        <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">{value || '—'}</dd>
      )}
    </div>
  );
}
