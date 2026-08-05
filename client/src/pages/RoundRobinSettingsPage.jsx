import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const thClass =
  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const tdClass = 'px-4 py-3 text-sm text-slate-900 dark:text-slate-100';

export default function RoundRobinSettingsPage() {
  const [driverTypes, setDriverTypes] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/recruiting/round-robin/settings');
      setDriverTypes(data.driverTypes || []);
      setRecruiters(data.recruiters || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load round robin settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const liveCoverage = useMemo(() => {
    const next = Object.fromEntries(driverTypes.map((type) => [type, 0]));
    for (const recruiter of recruiters) {
      for (const driverType of recruiter.roundRobinDriverTypes || []) {
        if (next[driverType] !== undefined) {
          next[driverType] += 1;
        }
      }
    }
    return next;
  }, [recruiters, driverTypes]);

  const uncoveredTypes = useMemo(
    () => driverTypes.filter((type) => (liveCoverage[type] || 0) === 0),
    [driverTypes, liveCoverage]
  );

  const toggleType = (recruiterId, driverType) => {
    setRecruiters((prev) =>
      prev.map((recruiter) => {
        if (recruiter.id !== recruiterId) return recruiter;
        const selected = new Set(recruiter.roundRobinDriverTypes || []);
        if (selected.has(driverType)) {
          selected.delete(driverType);
        } else {
          selected.add(driverType);
        }
        return {
          ...recruiter,
          roundRobinDriverTypes: driverTypes.filter((type) => selected.has(type)),
        };
      })
    );
    setSuccess('');
  };

  const toggleColumn = (driverType, checked) => {
    setRecruiters((prev) =>
      prev.map((recruiter) => {
        const selected = new Set(recruiter.roundRobinDriverTypes || []);
        if (checked) {
          selected.add(driverType);
        } else {
          selected.delete(driverType);
        }
        return {
          ...recruiter,
          roundRobinDriverTypes: driverTypes.filter((type) => selected.has(type)),
        };
      })
    );
    setSuccess('');
  };

  const isColumnFullySelected = (driverType) =>
    recruiters.length > 0 &&
    recruiters.every((recruiter) => (recruiter.roundRobinDriverTypes || []).includes(driverType));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await api.put('/recruiting/round-robin/settings', {
        recruiters: recruiters.map((recruiter) => ({
          id: recruiter.id,
          roundRobinDriverTypes: recruiter.roundRobinDriverTypes || [],
        })),
      });
      setDriverTypes(data.driverTypes || []);
      setRecruiters(data.recruiters || []);
      setSuccess('Round robin settings saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save round robin settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Round Robin</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Choose which driver types each recruiter receives during round-robin assignment on
          import and Old Leads. Recruiters with no driver types selected are skipped.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
          {success}
        </div>
      )}

      {uncoveredTypes.length > 0 && !loading && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          No recruiters configured for: {uncoveredTypes.join(', ')}. Imports and round-robin
          assignment will fail for those driver types.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading settings...</p>
      ) : recruiters.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No recruiters found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className={thClass}>Recruiter</th>
                {driverTypes.map((driverType) => (
                  <th key={driverType} className={`${thClass} text-center`}>
                    <div className="flex flex-col items-center gap-2">
                      <span>{driverType}</span>
                      <label className="inline-flex items-center gap-1 text-[10px] font-normal normal-case tracking-normal text-slate-500 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={isColumnFullySelected(driverType)}
                          onChange={(event) => toggleColumn(driverType, event.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-600"
                        />
                        All
                      </label>
                      <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">
                        {liveCoverage[driverType] || 0} selected
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {recruiters.map((recruiter) => (
                <tr key={recruiter.id}>
                  <td className={`${tdClass} font-medium`}>{recruiter.name}</td>
                  {driverTypes.map((driverType) => {
                    const checked = (recruiter.roundRobinDriverTypes || []).includes(driverType);
                    return (
                      <td key={`${recruiter.id}-${driverType}`} className={`${tdClass} text-center`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleType(recruiter.id, driverType)}
                          aria-label={`${recruiter.name} handles ${driverType}`}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || recruiters.length === 0}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
