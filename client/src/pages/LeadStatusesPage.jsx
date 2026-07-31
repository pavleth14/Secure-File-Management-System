import { useState } from 'react';
import api from '../api/client';
import { useLeadStatuses } from '../hooks/useRecruitingData';
import RecruitingOptionManager from '../components/recruiting/RecruitingOptionManager';

export default function LeadStatusesPage() {
  const { statuses, loading, error, reloadStatuses } = useLeadStatuses();
  const [newStatus, setNewStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAddStatus = async (event) => {
    event.preventDefault();
    const trimmed = newStatus.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setActionError('');
    setSuccess('');

    try {
      await api.post('/recruiting/statuses', { name: trimmed });
      setNewStatus('');
      setSuccess(`Added status "${trimmed}".`);
      await reloadStatuses();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to add status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStatus = async (status) => {
    if (!confirm(`Delete lead status "${status.name}"?`)) return;

    setDeletingId(status.id);
    setActionError('');
    setSuccess('');

    try {
      await api.delete(`/recruiting/statuses/${status.id}`);
      setSuccess(`Deleted status "${status.name}".`);
      await reloadStatuses();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to delete status');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <RecruitingOptionManager
      title="Lead Statuses"
      description="Manage lead statuses available for boards, imports, and lead updates."
      itemLabel="Status"
      placeholder="Status name"
      addButtonLabel="Add status"
      items={statuses}
      loading={loading}
      listError={error}
      actionError={actionError}
      success={success}
      newValue={newStatus}
      onNewValueChange={setNewStatus}
      submitting={submitting}
      deletingId={deletingId}
      onSubmit={handleAddStatus}
      onDelete={handleDeleteStatus}
    />
  );
}
