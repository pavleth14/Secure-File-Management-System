import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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

function buildQueryParams(filters, recruiterId) {
  const { dateFrom, dateTo } = getLeadDateRange(
    filters.datePreset,
    filters.customStart,
    filters.customEnd
  );

  const params = {
    recruiterId,
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  };

  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.driverType) params.driverType = filters.driverType;
  if (filters.source) params.source = filters.source;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  return params;
}

export default function RecruiterBoardPage() {
  const { userId } = useParams();
  const { user, isRecruitingManager, isRecruiter, isRecruitingModuleUser } = useAuth();
  const isOwnBoard = user?.id === userId;
  const [boardReadOnly, setBoardReadOnly] = useState(
    isRecruiter && !isRecruitingManager && !isOwnBoard
  );
  const { sources } = useLeadSources();
  const { recruiters } = useRecruiters();

  const [boardLabel, setBoardLabel] = useState('');
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState('');

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

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      setBoardLoading(true);
      setBoardError('');
      try {
        const { data } = await api.get(`/recruiting/boards/${userId}`);
        if (!cancelled) {
          setBoardLabel(data.board.label);
          if (typeof data.permissions?.readOnly === 'boolean') {
            setBoardReadOnly(data.permissions.readOnly);
          } else {
            setBoardReadOnly(isRecruiter && !isRecruitingManager && user?.id !== userId);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setBoardError(err.response?.data?.message || 'Failed to load board');
        }
      } finally {
        if (!cancelled) {
          setBoardLoading(false);
        }
      }
    }

    loadBoard();

    return () => {
      cancelled = true;
    };
  }, [userId, isRecruiter, isRecruitingManager, user?.id]);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    setActionError('');
    try {
      const { data } = await api.get('/recruiting/leads', {
        params: buildQueryParams(filters, userId),
      });
      setLeads(data.leads || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to load leads');
    } finally {
      setLeadsLoading(false);
    }
  }, [filters, userId]);

  useEffect(() => {
    if (boardError) return;
    loadLeads();
  }, [loadLeads, boardError]);

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
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update lead');
      await loadLeads();
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

  const handleArchiveLead = async (lead) => {
    if (!window.confirm(`Archive lead ${lead.firstName} ${lead.lastName}?`)) return;
    setActionError('');
    try {
      await api.post(`/recruiting/leads/${lead.id}/archive`);
      setLeads((prev) => prev.filter((item) => item.id !== lead.id));
      setTotalCount((prev) => Math.max(prev - 1, 0));
      setViewLead((prev) => (prev?.id === lead.id ? null : prev));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to archive lead');
    }
  };

  const handleAssignLead = async (recruiterId) => {
    if (!assignLead) return;
    setAssignSubmitting(true);
    setActionError('');
    try {
      const { data } = await api.post(`/recruiting/leads/${assignLead.id}/assign`, {
        assignedRecruiterId: recruiterId,
      });

      if (data.lead.assignedRecruiter?.id !== userId) {
        setLeads((prev) => prev.filter((lead) => lead.id !== assignLead.id));
        setTotalCount((prev) => Math.max(prev - 1, 0));
      } else {
        setLeads((prev) => prev.map((lead) => (lead.id === assignLead.id ? data.lead : lead)));
      }

      setViewLead((prev) => (prev?.id === assignLead.id ? data.lead : prev));
      setAssignLead(null);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to assign lead');
    } finally {
      setAssignSubmitting(false);
    }
  };

  if (boardLoading) {
    return <div className="text-slate-500 dark:text-slate-400">Loading board...</div>;
  }

  if (boardError) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
        {boardError}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{boardLabel}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRecruitingManager
            ? 'Viewing recruiter board as recruiting manager.'
            : boardReadOnly
              ? 'View-only access to this recruiter board.'
              : isRecruitingModuleUser
                ? 'Viewing recruiter board.'
                : 'Your assigned leads.'}
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
      />

      <LeadBoardTable
        leads={leads}
        isRecruitingManager={isRecruitingManager}
        isRecruiter={isRecruiter}
        readOnly={boardReadOnly}
        currentUserId={user?.id}
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        onSortChange={handleSortChange}
        onUpdateLead={boardReadOnly ? undefined : handleUpdateLead}
        onViewLead={setViewLead}
        onAddComment={boardReadOnly ? undefined : setCommentLead}
        onEditComment={boardReadOnly ? undefined : handleEditComment}
        onAssignLead={isRecruitingManager ? setAssignLead : undefined}
        onArchiveLead={isRecruitingManager ? handleArchiveLead : undefined}
        loading={leadsLoading}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {totalCount} lead{totalCount !== 1 ? 's' : ''} · Page {filters.page} of {totalPages}
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

      <LeadViewModal open={Boolean(viewLead)} lead={viewLead} onClose={() => setViewLead(null)} />

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
