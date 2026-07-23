import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LEAD_BOARD_PAGE_SIZES } from '../constants/recruitingConstants';
import { getLeadDateRange } from '../utils/leadPermissions';
import { useLeadSources, useRecruiters } from '../hooks/useRecruitingData';
import LeadBoardToolbar from '../components/recruiting/LeadBoardToolbar';
import LeadBoardTable from '../components/recruiting/LeadBoardTable';
import LeadViewModal from '../components/recruiting/LeadViewModal';
import AddCommentModal from '../components/recruiting/AddCommentModal';
import AssignLeadModal from '../components/recruiting/AssignLeadModal';

function buildQueryParams(filters) {
  const { dateFrom, dateTo } = getLeadDateRange(
    filters.datePreset,
    filters.customStart,
    filters.customEnd
  );

  const params = {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  };

  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.driverType) params.driverType = filters.driverType;
  if (filters.source) params.source = filters.source;
  if (filters.recruiterId) params.recruiterId = filters.recruiterId;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  return params;
}

export default function ArchiveLeadsPage() {
  const { user } = useAuth();
  const { sources } = useLeadSources();
  const { recruiters } = useRecruiters();

  const [leads, setLeads] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    driverType: '',
    source: '',
    recruiterId: '',
    datePreset: 'all',
    customStart: '',
    customEnd: '',
    page: 1,
    limit: 25,
    sortBy: 'date',
    sortDir: 'desc',
  });

  const [viewLead, setViewLead] = useState(null);
  const [commentLead, setCommentLead] = useState(null);
  const [assignLead, setAssignLead] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    setActionError('');
    try {
      const { data } = await api.get('/recruiting/leads/archived', {
        params: buildQueryParams(filters),
      });
      setLeads(data.leads || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to load archived leads');
    } finally {
      setLeadsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSortChange = (sortBy, sortDir) => {
    setFilters((prev) => ({ ...prev, sortBy, sortDir, page: 1 }));
  };

  const handleUpdateLead = async (leadId, updates) => {
    setActionError('');
    try {
      const { data } = await api.patch(`/recruiting/leads/${leadId}`, updates);
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? data.lead : lead)));
      setViewLead((prev) => (prev?.id === leadId ? data.lead : prev));
      return data.lead;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update lead';
      setActionError(message);
      await loadLeads();
      throw err;
    }
  };

  const handleAddComment = async (text) => {
    if (!commentLead) return;
    setCommentSubmitting(true);
    setActionError('');
    try {
      const { data } = await api.post(`/recruiting/leads/${commentLead.id}/comments`, { text });
      setLeads((prev) => prev.map((lead) => (lead.id === commentLead.id ? data.lead : lead)));
      setViewLead((prev) => (prev?.id === commentLead.id ? data.lead : prev));
      setCommentLead(null);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleEditComment = async (leadId, commentId, text) => {
    setActionError('');
    const { data } = await api.put(`/recruiting/leads/${leadId}/comments/${commentId}`, { text });
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? data.lead : lead)));
    setViewLead((prev) => (prev?.id === leadId ? data.lead : prev));
    return data.lead;
  };

  const handleAssignLead = async (recruiterId) => {
    if (!assignLead) return;
    setAssignSubmitting(true);
    setActionError('');
    try {
      const { data } = await api.post(`/recruiting/leads/${assignLead.id}/assign`, {
        assignedRecruiterId: recruiterId,
      });
      setLeads((prev) => prev.map((lead) => (lead.id === assignLead.id ? data.lead : lead)));
      setViewLead((prev) => (prev?.id === assignLead.id ? data.lead : prev));
      setAssignLead(null);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to assign lead');
    } finally {
      setAssignSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Archived Leads</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Review archived leads across all recruiter boards.
        </p>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {actionError}
        </div>
      )}

      <LeadBoardToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        filters={filters}
        onFilterChange={updateFilter}
        pageSizes={LEAD_BOARD_PAGE_SIZES}
        sources={sources}
        recruiters={recruiters}
        showRecruiterFilter
      />

      <LeadBoardTable
        leads={leads}
        isRecruitingManager
        currentUserId={user?.id}
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        onSortChange={handleSortChange}
        onViewLead={setViewLead}
        onAddComment={setCommentLead}
        onEditComment={handleEditComment}
        onAssignLead={setAssignLead}
        showRecruiterColumn
        showArchiveColumns
        loading={leadsLoading}
        emptyMessage="No archived leads found."
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {totalCount} archived lead{totalCount !== 1 ? 's' : ''} · Page {filters.page} of{' '}
          {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={filters.page <= 1 || leadsLoading}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={filters.page >= totalPages || leadsLoading}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Next
          </button>
        </div>
      </div>

      <LeadViewModal
        open={Boolean(viewLead)}
        lead={viewLead}
        onClose={() => setViewLead(null)}
        onSave={handleUpdateLead}
        isRecruitingManager
      />

      <AddCommentModal
        open={Boolean(commentLead)}
        lead={commentLead}
        submitting={commentSubmitting}
        onConfirm={handleAddComment}
        onCancel={() => setCommentLead(null)}
      />

      <AssignLeadModal
        open={Boolean(assignLead)}
        lead={assignLead}
        recruiters={recruiters}
        submitting={assignSubmitting}
        onConfirm={handleAssignLead}
        onCancel={() => setAssignLead(null)}
      />
    </div>
  );
}
