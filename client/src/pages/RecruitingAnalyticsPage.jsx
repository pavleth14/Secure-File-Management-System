import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import {
  RECRUITER_DISQUALIFICATION_STATUSES,
  SAFETY_DISQUALIFICATION_STATUSES,
} from '../constants/recruitingConstants';
import {
  formatDurationMs,
  formatPeriodLabel,
  getDatePresetRange,
  getTodayChicagoDateString,
} from '../utils/recruitingAnalytics';

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

export default function RecruitingAnalyticsPage() {
  const [preset, setPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState(getTodayChicagoDateString());
  const [customTo, setCustomTo] = useState(getTodayChicagoDateString());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const period = useMemo(() => {
    if (preset === 'custom') {
      return { from: customFrom, to: customTo };
    }
    return getDatePresetRange(preset);
  }, [preset, customFrom, customTo]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/recruiting/analytics', {
        params: period,
      });
      setData(response);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const recruiterReasons = RECRUITER_DISQUALIFICATION_STATUSES;
  const safetyReasons = SAFETY_DISQUALIFICATION_STATUSES;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Recruiting Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Overview for recruiting managers (America/Chicago)
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="analytics-preset"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Period
            </label>
            <select
              id="analytics-preset"
              value={preset}
              onChange={(event) => setPreset(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {DATE_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {preset === 'custom' && (
            <>
              <div>
                <label
                  htmlFor="analytics-from"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  From
                </label>
                <input
                  id="analytics-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="analytics-to"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  To
                </label>
                <input
                  id="analytics-to"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </>
          )}

          <p className="pb-2 text-sm text-slate-600 dark:text-slate-300">
            {formatPeriodLabel(period.from, period.to)}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading analytics...</p>
      ) : data ? (
        <div className="space-y-6">
          <Section title="Processing">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Moved to Processing"
                value={data.processing?.count ?? 0}
                hint="Status entry events in selected period"
              />
            </div>

            <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
              <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Average time in Processing status
              </h3>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                From entering Processing until switching to another status. Counted when the exit
                happens in the selected period.
              </p>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <StatCard
                  label="Overall average"
                  value={
                    data.processingStatusDuration?.overallAverageMs != null
                      ? formatDurationMs(data.processingStatusDuration.overallAverageMs)
                      : '—'
                  }
                  hint={`${data.processingStatusDuration?.episodeCount ?? 0} completed episodes`}
                />
              </div>

              {(data.processingStatusDuration?.byRecruiter || []).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No Processing status exits in this period.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        <th className="px-3 py-2 font-medium">Recruiter</th>
                        <th className="px-3 py-2 font-medium">Average time in Processing</th>
                        <th className="px-3 py-2 font-medium">Episodes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.processingStatusDuration.byRecruiter.map((row) => (
                        <tr
                          key={row.recruiterId}
                          className="border-b border-slate-100 dark:border-slate-700/80"
                        >
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                            {row.recruiterName}
                          </td>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                            {row.averageMs != null ? formatDurationMs(row.averageMs) : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {row.episodeCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Section>

          <Section title="Disqualified Drivers">
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Recruiter disqualifications"
                value={data.disqualified?.recruiter?.total ?? 0}
              />
              <StatCard
                label="Safety disqualifications"
                value={data.disqualified?.safety?.total ?? 0}
              />
              <StatCard label="Total disqualifications" value={data.disqualified?.total ?? 0} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Recruiter reasons
                </h3>
                <ul className="space-y-2">
                  {recruiterReasons.map((reason) => (
                    <li
                      key={reason}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <span className="text-slate-700 dark:text-slate-200">{reason}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {data.disqualified?.recruiter?.byReason?.[reason] ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Safety reasons
                </h3>
                <ul className="space-y-2">
                  {safetyReasons.map((reason) => (
                    <li
                      key={reason}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <span className="text-slate-700 dark:text-slate-200">{reason}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {data.disqualified?.safety?.byReason?.[reason] ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          <Section title="Hired">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Moved to Hired"
                value={data.hired?.count ?? 0}
                hint="Status change events in selected period"
              />
            </div>
          </Section>

          <Section title="Processing Steps Saved">
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Count of Processing step saves (Save button timestamp) in the selected period.
            </p>
            <ul className="space-y-2">
              {(data.processingSteps || []).map((step) => (
                <li
                  key={step.stepKey}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                >
                  <span className="text-slate-700 dark:text-slate-200">{step.label}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {step.count}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Processing Step Time (Save to Save)">
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Average time between consecutive Processing step saves. Intervals are counted when
              the later save falls within the selected period.
            </p>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Overall average"
                value={
                  data.processingStepIntervals?.overallAverageMs != null
                    ? formatDurationMs(data.processingStepIntervals.overallAverageMs)
                    : '—'
                }
                hint={`${data.processingStepIntervals?.intervalCount ?? 0} intervals`}
              />
            </div>

            {(data.processingStepIntervals?.byRecruiter || []).length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No step intervals in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-3 py-2 font-medium">Recruiter</th>
                      <th className="px-3 py-2 font-medium">Average time</th>
                      <th className="px-3 py-2 font-medium">Intervals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.processingStepIntervals.byRecruiter.map((row) => (
                      <tr
                        key={row.recruiterId}
                        className="border-b border-slate-100 dark:border-slate-700/80"
                      >
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                          {row.recruiterName}
                        </td>
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                          {row.averageMs != null ? formatDurationMs(row.averageMs) : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {row.intervalCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      ) : null}
    </div>
  );
}
