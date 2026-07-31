import { useState } from 'react';
import api from '../api/client';
import { useLeadSources } from '../hooks/useRecruitingData';
import RecruitingOptionManager from '../components/recruiting/RecruitingOptionManager';

export default function LeadSourcesPage() {
  const { sources, loading, error, reloadSources } = useLeadSources();
  const [newSource, setNewSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAddSource = async (event) => {
    event.preventDefault();
    const trimmed = newSource.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setActionError('');
    setSuccess('');

    try {
      await api.post('/recruiting/sources', { name: trimmed });
      setNewSource('');
      setSuccess(`Added source "${trimmed}".`);
      await reloadSources();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to add source');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSource = async (source) => {
    if (!confirm(`Delete lead source "${source.name}"?`)) return;

    setDeletingId(source.id);
    setActionError('');
    setSuccess('');

    try {
      await api.delete(`/recruiting/sources/${source.id}`);
      setSuccess(`Deleted source "${source.name}".`);
      await reloadSources();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to delete source');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <RecruitingOptionManager
      title="Lead Sources"
      description="Manage lead sources available for import, boards, and lead creation."
      itemLabel="Source"
      placeholder="Source name"
      addButtonLabel="Add source"
      items={sources}
      loading={loading}
      listError={error}
      actionError={actionError}
      success={success}
      newValue={newSource}
      onNewValueChange={setNewSource}
      submitting={submitting}
      deletingId={deletingId}
      onSubmit={handleAddSource}
      onDelete={handleDeleteSource}
    />
  );
}
