import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AnalyticsStatCard from '../components/recruiting/analytics/AnalyticsStatCard';
import AnalyticsBarChart from '../components/recruiting/analytics/AnalyticsBarChart';
import { formatDurationMs, formatPercent, getDatePresetRange } from '../utils/recruitingAnalytics';
import { formatLeadPhoneDisplay } from '../utils/leadPhoneFormat';
import { formatLeadDisplayEmail } from '../utils/leadEmailFormat';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'recruiters', label: 'Recruiters' },
  { id: 'sources', label: 'Sources' },
  { id: 'old-leads', label: 'Old Leads' },
];

const thClass =
  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const tdClass = 'px-4 py-3 text-sm text-slate-900 dark:text-slate-100';

const selectClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

export default function RecruitingAnalyticsPage() {
  const { isRecruitingManager, isSuperAdmin, isRecruitingModuleUser } = useAuth();
  const viewAll = isRecruitingManager || isSuperAdmin || isRecruitingModuleUser;

  const [activeTab, setActiveTab] = useState('overview');
  const [datePreset, setDatePreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [driverTypeGroup, setDriverTypeGroup] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => viewAll || tab.id !== 'old-leads'),
    [viewAll]
  );

  const queryRange = useMemo(() => {
    if (datePreset === 'custom') {
      return { from: customFrom, to: customTo };
    }
    return getDatePresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { driverTypeGroup };
      if (queryRange.from) params.from = queryRange.from;
      if (queryRange.to) params.to = queryRange.to;
      const { data: response } = await api.get('/recruiting/analytics', { params });
      setData(response);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [driverTypeGroup, queryRange.from, queryRange.to]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const statusChartItems = useMemo(
    () =>
      (data?.byStatus || []).map((row) => ({
        label: row.status,
        count: row.count,
      })),
    [data]
  );

  const sourceChartItems = useMemo(
    () =>
      (data?.bySource || []).map((row) => ({
        label: row.source,
        count: row.count,
      })),
    [data]
  );

  const pipelineActive = useMemo(
    () => (data?.pipeline || []).filter((row) => row.isActive),
    [data]
  );
  const pipelineInactive = useMemo(
    () => (data?.pipeline || []).filter((row) => !row.isActive),
    [data]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Recruiting Analytics
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {viewAll
            ? 'Team-wide recruiting performance, pipeline, sources, and old leads.'
            : 'Your board performance and pipeline metrics.'}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Period
          </label>
          <select
            value={datePreset}
            onChange={(event) => setDatePreset(event.target.value)}
            className={selectClass}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {datePreset === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                From
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className={selectClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                To
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className={selectClass}
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Driver group
          </label>
          <select
            value={driverTypeGroup}
            onChange={(event) => setDriverTypeGroup(event.target.value)}
            className={selectClass}
          >
            <option value="all">All</option>
            <option value="local">Local</option>
            <option value="otr">OTR</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading analytics...</p>
      ) : !data ? null : (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AnalyticsStatCard label="Active leads" value={data.overview.activeLeads} />
                <AnalyticsStatCard label="New in period" value={data.overview.newLeads} />
                <AnalyticsStatCard label="Imported" value={data.overview.importedLeads} />
                <AnalyticsStatCard label="Hired" value={data.overview.hired} />
                <AnalyticsStatCard label="Rejected outcomes" value={data.overview.rejectedOutcomes} />
                <AnalyticsStatCard
                  label="Conversion rate"
                  value={formatPercent(data.overview.conversionRate)}
                  hint="Hired / (Hired + rejected outcomes)"
                />
                <AnalyticsStatCard label="Archived" value={data.overview.archivedLeads} />
                <AnalyticsStatCard
                  label="Stale active leads"
                  value={data.overview.staleLeads}
                  hint={`No update in ${7}+ days`}
                />
                {viewAll && (
                  <>
                    <AnalyticsStatCard
                      label="Old leads assigned"
                      value={data.overview.oldLeadsAssigned ?? 0}
                    />
                    <AnalyticsStatCard label="Reassignments" value={data.reassignments ?? 0} />
                  </>
                )}
                <AnalyticsStatCard
                  label="Average response time"
                  value={formatDurationMs(data.overview.averageResponseTimeMs)}
                  hint={`New Lead → Attempting (${data.overview.averageResponseTimeCount ?? 0} in period)`}
                />
              </div>

              {(data.responseTimeByRecruiter?.length ?? 0) > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Average response time by recruiter
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Time from lead import/creation to first Attempting status (transitions in
                      selected period).
                    </p>
                  </div>
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                      <tr>
                        <th className={thClass}>Recruiter</th>
                        <th className={thClass}>Avg response time</th>
                        <th className={thClass}>Leads counted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {data.responseTimeByRecruiter.map((row) => (
                        <tr key={row.id || row.name}>
                          <td className={`${tdClass} font-medium`}>{row.name}</td>
                          <td className={tdClass}>{formatDurationMs(row.averageResponseTimeMs)}</td>
                          <td className={tdClass}>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Longest waiting New Leads
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Active leads still in New Lead status, sorted by time waiting.
                  </p>
                </div>
                {(data.longestWaitingNewLeads?.length ?? 0) === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                    No leads currently waiting in New Lead status.
                  </p>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                      <tr>
                        <th className={thClass}>Waiting</th>
                        <th className={thClass}>Recruiter</th>
                        <th className={thClass}>Status</th>
                        <th className={thClass}>Driver type</th>
                        <th className={thClass}>Source</th>
                        <th className={thClass}>Date</th>
                        <th className={thClass}>First name</th>
                        <th className={thClass}>Last name</th>
                        <th className={thClass}>Phone</th>
                        <th className={thClass}>Email</th>
                        <th className={thClass}>State / City</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {data.longestWaitingNewLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td className={`${tdClass} whitespace-nowrap font-medium`}>
                            {formatDurationMs(lead.waitingMs)}
                          </td>
                          <td className={tdClass}>{lead.recruiterName}</td>
                          <td className={tdClass}>{lead.status}</td>
                          <td className={tdClass}>{lead.driverType}</td>
                          <td className={tdClass}>{lead.source}</td>
                          <td className={tdClass}>{lead.date || '—'}</td>
                          <td className={tdClass}>{lead.firstName}</td>
                          <td className={tdClass}>{lead.lastName}</td>
                          <td className={tdClass}>{formatLeadPhoneDisplay(lead.phone)}</td>
                          <td className={tdClass}>{formatLeadDisplayEmail(lead.email)}</td>
                          <td className={tdClass}>{lead.stateCity || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <AnalyticsBarChart title="Leads by status (period)" items={statusChartItems} />
                <AnalyticsBarChart title="Leads by source (period)" items={sourceChartItems} />
              </div>

              <AnalyticsBarChart
                title="Leads by driver type (period)"
                items={(data.byDriverType || []).map((row) => ({
                  label: row.driverType,
                  count: row.count,
                }))}
              />
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              <AnalyticsBarChart
                title="Active pipeline (current non-archived)"
                items={pipelineActive.map((row) => ({
                  label: row.status,
                  count: row.count,
                }))}
              />
              <AnalyticsBarChart
                title="Non-active outcomes (current non-archived)"
                items={pipelineInactive.map((row) => ({
                  label: row.status,
                  count: row.count,
                }))}
              />
              {data.rejectionReasons?.length > 0 && (
                <AnalyticsBarChart
                  title="Top rejection reasons (period)"
                  items={data.rejectionReasons.map((row) => ({
                    label: row.reason,
                    count: row.count,
                  }))}
                  labelKey="label"
                />
              )}
            </div>
          )}

          {activeTab === 'recruiters' && (
            <div className="space-y-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr>
                      <th className={thClass}>Recruiter</th>
                      <th className={thClass}>Active</th>
                      <th className={thClass}>New (period)</th>
                      <th className={thClass}>Hired</th>
                      <th className={thClass}>Rejected</th>
                      <th className={thClass}>Conversion</th>
                      <th className={thClass}>Local active</th>
                      <th className={thClass}>OTR active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {(data.recruiters || []).map((recruiter) => (
                      <tr key={recruiter.id}>
                        <td className={`${tdClass} font-medium`}>{recruiter.name}</td>
                        <td className={tdClass}>{recruiter.active}</td>
                        <td className={tdClass}>{recruiter.newInPeriod}</td>
                        <td className={tdClass}>{recruiter.hired}</td>
                        <td className={tdClass}>{recruiter.rejected}</td>
                        <td className={tdClass}>{formatPercent(recruiter.conversionRate)}</td>
                        <td className={tdClass}>{recruiter.local}</td>
                        <td className={tdClass}>{recruiter.otr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewAll && data.roundRobinBalance?.length > 0 && (
                <AnalyticsBarChart
                  title="Imported lead distribution (period)"
                  items={data.roundRobinBalance.map((row) => ({
                    label: row.name,
                    count: row.assignedInPeriod,
                  }))}
                  emptyMessage="No imported leads in this period."
                />
              )}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className={thClass}>Source</th>
                    <th className={thClass}>Leads</th>
                    <th className={thClass}>Hired</th>
                    <th className={thClass}>Rejected</th>
                    <th className={thClass}>Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {(data.bySource || []).map((row) => (
                    <tr key={row.source}>
                      <td className={`${tdClass} font-medium`}>{row.source}</td>
                      <td className={tdClass}>{row.count}</td>
                      <td className={tdClass}>{row.hired}</td>
                      <td className={tdClass}>{row.rejected}</td>
                      <td className={tdClass}>{formatPercent(row.conversionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'old-leads' && viewAll && data.oldLeads && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnalyticsStatCard label="Total old leads" value={data.oldLeads.total} />
                <AnalyticsStatCard label="Unassigned" value={data.oldLeads.unassigned} />
                <AnalyticsStatCard label="Assigned" value={data.oldLeads.assigned} />
                <AnalyticsStatCard
                  label="Assigned in period"
                  value={data.oldLeads.assignedInPeriod}
                />
                <AnalyticsStatCard
                  label="Unassigned 7+ days"
                  value={data.oldLeads.unassignedOlderThan7Days}
                />
                <AnalyticsStatCard
                  label="Unassigned 30+ days"
                  value={data.oldLeads.unassignedOlderThan30Days}
                />
              </div>

              <AnalyticsBarChart
                title="Old leads by driver type"
                items={(data.oldLeads.byDriverType || []).map((row) => ({
                  label: row.driverType,
                  count: row.count,
                }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
