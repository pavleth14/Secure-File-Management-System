import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LEAD_BOARD_PAGE_SIZES } from '../constants/recruitingConstants';
import { getLeadDateRange, isRecruiterBoardReadOnly } from '../utils/leadPermissions';
import { useLeadSources, useLeadStatuses, useRecruiters } from '../hooks/useRecruitingData';
import LeadBoardToolbar from '../components/recruiting/LeadBoardToolbar';
import LeadActivityTabs from '../components/recruiting/LeadActivityTabs';
import LeadBoardTable from '../components/recruiting/LeadBoardTable';
import LeadViewModal from '../components/recruiting/LeadViewModal';
import AddCommentModal from '../components/recruiting/AddCommentModal';
import AssignLeadModal from '../components/recruiting/AssignLeadModal';
import CreateLeadModal from '../components/recruiting/CreateLeadModal';

const GLOBAL_BOARD_USER_ID = 'global';

function buildQueryParams(filters, recruiterId, activityGroup, isGlobalBoard) {
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

  if (isGlobalBoard) {
    if (filters.recruiterId) params.recruiterId = filters.recruiterId;
  } else {
    params.recruiterId = recruiterId;
  }

  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.driverType) params.driverType = filters.driverType;
  if (filters.source) params.source = filters.source;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  if (!filters.status && activityGroup && activityGroup !== 'all') {
    params.activityGroup = activityGroup;
  }

  return params;
}

export default function RecruiterBoardPage() {
  const { userId } = useParams();
  const { user, isRecruitingManager, isRecruiter, isRecruitingModuleUser, isSuperAdmin } =
    useAuth();
  const isGlobalBoard = userId === GLOBAL_BOARD_USER_ID;
  const canManageLeads = isRecruitingManager || isSuperAdmin;
  const loggedInUserId = user?.id?.toString?.() || user?._id?.toString?.();
  const isOwnBoard = Boolean(
    !isGlobalBoard && loggedInUserId && userId && loggedInUserId === userId.toString()
  );
  const boardReadOnly =
    isGlobalBoard
      ? !canManageLeads
      : isRecruiterBoardReadOnly({
          isRecruiter,
          isRecruitingManager: canManageLeads,
          isOwnBoard,
        });
  const { sourceNames } = useLeadSources();
  const { statusNames, statusColorMap } = useLeadStatuses();
  const { recruiters } = useRecruiters();

  const [boardLabel, setBoardLabel] = useState('');
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState('');

  const [leads, setLeads] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const [activityGroup, setActivityGroup] = useState('all');
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
  const [scrollToComments, setScrollToComments] = useState(false);
  const [commentLead, setCommentLead] = useState(null);
  const [assignLead, setAssignLead] = useState(null);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [createLeadSubmitting, setCreateLeadSubmitting] = useState(false);
  const [createLeadError, setCreateLeadError] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const activeRecruiters = useMemo(
    () => recruiters.filter((recruiter) => !recruiter.name.includes('(Inactive)')),
    [recruiters]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      if (isGlobalBoard) {
        setBoardLabel('Global Board');
        setBoardError('');
        setBoardLoading(false);
        return;
      }

      setBoardLoading(true);
      setBoardError('');
      try {
        const { data } = await api.get(`/recruiting/boards/${userId}`);
        if (!cancelled) {
          setBoardLabel(data.board.label);
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
  }, [userId, isGlobalBoard]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      page: 1,
      recruiterId: isGlobalBoard ? prev.recruiterId : '',
    }));
    setActivityGroup('all');
  }, [userId, isGlobalBoard]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, [activityGroup]);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    setActionError('');
    try {
      const { data } = await api.get('/recruiting/leads', {
        params: buildQueryParams(filters, userId, activityGroup, isGlobalBoard),
      });
      setLeads(data.leads || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to load leads');
    } finally {
      setLeadsLoading(false);
    }
  }, [filters, userId, activityGroup, isGlobalBoard]);

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
    setFilters((prev) => {
      const next = { ...prev, [key]: value, page: 1 };
      if (key === 'status' && value !== 'Processing' && prev.sortBy === 'processingStep') {
        next.sortBy = 'date';
        next.sortDir = 'desc';
      }
      return next;
    });
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
      await handleSubmitComment(commentLead.id, text);
      setCommentLead(null);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleSubmitComment = async (leadId, text) => {
    setActionError('');
    const { data } = await api.post(`/recruiting/leads/${leadId}/comments`, { text });
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? data.lead : lead)));
    setViewLead((prev) => (prev?.id === leadId ? data.lead : prev));
    return data.lead;
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

      const assignedRecruiterId = data.lead.assignedRecruiter?.id?.toString?.();
      const filterRecruiterId = filters.recruiterId?.toString?.();
      const boardRecruiterId = userId?.toString?.();

      if (
        isGlobalBoard &&
        filterRecruiterId &&
        assignedRecruiterId &&
        assignedRecruiterId !== filterRecruiterId
      ) {
        setLeads((prev) => prev.filter((lead) => lead.id !== assignLead.id));
        setTotalCount((prev) => Math.max(prev - 1, 0));
      } else if (
        !isGlobalBoard &&
        assignedRecruiterId &&
        boardRecruiterId &&
        assignedRecruiterId !== boardRecruiterId
      ) {
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

  const handleViewLead = (lead, options = {}) => {
    setViewLead(lead);
    setScrollToComments(Boolean(options.scrollToComments));
  };

  const canAddManualLead = !isGlobalBoard && !boardReadOnly;

  const handleCreateLead = async (payload) => {
    setCreateLeadSubmitting(true);
    setCreateLeadError('');
    setActionError('');
    try {
      const body = {
        ...payload,
        ...(canManageLeads ? { assignedRecruiterId: userId } : {}),
      };
      await api.post('/recruiting/leads', body);
      setCreateLeadOpen(false);
      await loadLeads();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create lead';
      setCreateLeadError(message);
      setActionError(message);
    } finally {
      setCreateLeadSubmitting(false);
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{boardLabel}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isGlobalBoard
              ? 'All active leads across every recruiter board.'
              : canManageLeads
                ? 'Viewing recruiter board as recruiting manager.'
                : boardReadOnly
                  ? 'View-only access to this recruiter board.'
                  : isRecruitingModuleUser
                    ? 'Viewing recruiter board.'
                    : 'Your assigned leads.'}
          </p>
        </div>
        {canAddManualLead ? (
          <button
            type="button"
            onClick={() => {
              setCreateLeadError('');
              setCreateLeadOpen(true);
            }}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add Lead
          </button>
        ) : null}
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
        sources={sourceNames}
        statuses={statusNames}
        recruiters={activeRecruiters}
        showRecruiterFilter={isGlobalBoard}
      />

      <div className="mb-4 flex justify-end">
        <LeadActivityTabs value={activityGroup} onChange={setActivityGroup} />
      </div>

      <LeadBoardTable
        leads={leads}
        isRecruitingManager={canManageLeads}
        readOnly={boardReadOnly}
        currentUserId={user?.id}
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        onSortChange={handleSortChange}
        onViewLead={handleViewLead}
        onAddComment={boardReadOnly ? undefined : setCommentLead}
        onSubmitComment={boardReadOnly ? undefined : handleSubmitComment}
        onEditComment={boardReadOnly ? undefined : handleEditComment}
        onAssignLead={canManageLeads ? setAssignLead : undefined}
        onArchiveLead={canManageLeads ? handleArchiveLead : undefined}
        showRecruiterColumn={isGlobalBoard}
        recruiterColumnAfterStatus={isGlobalBoard}
        statusColorMap={statusColorMap}
        statusFilter={filters.status}
        loading={leadsLoading}
        emptyMessage={isGlobalBoard ? 'No leads found.' : 'No leads on this board yet.'}
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

      <LeadViewModal
        open={Boolean(viewLead)}
        lead={viewLead}
        onClose={() => {
          setViewLead(null);
          setScrollToComments(false);
        }}
        onSave={boardReadOnly ? undefined : handleUpdateLead}
        isRecruitingManager={canManageLeads}
        isRecruiter={isRecruiter}
        isOwnBoard={isGlobalBoard ? canManageLeads : isOwnBoard}
        readOnly={boardReadOnly}
        scrollToComments={scrollToComments}
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

      <CreateLeadModal
        open={createLeadOpen}
        sources={sourceNames}
        submitting={createLeadSubmitting}
        error={createLeadError}
        onSave={handleCreateLead}
        onCancel={() => {
          if (createLeadSubmitting) return;
          setCreateLeadOpen(false);
          setCreateLeadError('');
        }}
      />
    </div>
  );
}
