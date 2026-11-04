export const MAINTENANCE_BOARD_INITIAL_FILTERS = {
  issue: '',
  assigneeId: '',
  dateOpened: '',
  dateClosed: '',
  dueDate: '',
  equipment: '',
  statusFilters: ['Open'],
  priorities: [],
  projects: [],
  oosStatuses: [],
  caseTypes: [],
  repairShop: '',
  invoiceStatuses: [],
  dispatchStatuses: [],
  reportPeriod: 'month',
  reportReferenceDate: '',
  reportWithCostOnly: false,
};

export function buildMaintenanceCaseQueryParams(filters, { limit = 100 } = {}) {
  const params = { limit };
  if (filters.issue.trim()) params.issue = filters.issue.trim();
  if (filters.assigneeId) params.assigneeId = filters.assigneeId;
  if (filters.dateOpened) params.dateOpened = filters.dateOpened;
  if (filters.dateClosed) params.dateClosed = filters.dateClosed;
  if (filters.dueDate) params.dueDate = filters.dueDate;
  if (filters.equipment.trim()) params.equipment = filters.equipment.trim();
  if (filters.repairShop.trim()) params.repairShop = filters.repairShop.trim();
  const statusFilters = Array.isArray(filters.statusFilters)
    ? filters.statusFilters.filter(Boolean)
    : (() => {
        const legacy = String(filters.statusFilter || '').trim();
        if (!legacy || legacy === 'all') return [];
        return [legacy];
      })();
  if (statusFilters.length) params.caseStatus = statusFilters.join(',');
  if (filters.priorities.length) params.priority = filters.priorities.join(',');
  if (filters.projects.length) params.project = filters.projects.join(',');
  if (filters.oosStatuses.length) params.oosStatus = filters.oosStatuses.join(',');
  if (filters.caseTypes.length) params.caseType = filters.caseTypes.join(',');
  if (filters.invoiceStatuses.length) params.invoiceStatus = filters.invoiceStatuses.join(',');
  if (filters.dispatchStatuses.length) params.dispatchStatus = filters.dispatchStatuses.join(',');
  return params;
}
