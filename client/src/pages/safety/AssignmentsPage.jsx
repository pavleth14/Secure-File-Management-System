import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ContextMenu from '../../components/ContextMenu';
import SafetyListToolbar from '../../components/dispatch-safety/SafetyListToolbar';
import AssignmentEditModal from '../../components/dispatch-safety/AssignmentEditModal';

function formatDrivers(assignment) {
  if (!assignment.driverName) return '—';
  if (assignment.coDriverName) {
    return `${assignment.driverName} / ${assignment.coDriverName}`;
  }
  return assignment.driverName;
}

function formatHistoryDrivers(entry) {
  if (!entry.driverName) return '—';
  if (entry.coDriverName) {
    return `${entry.driverName} / ${entry.coDriverName}`;
  }
  return entry.driverName;
}

export default function AssignmentsPage() {
  const [searchParams] = useSearchParams();
  const highlightTruckId = searchParams.get('truckId');
  const { canEditAssignments } = useAuth();
  const [view, setView] = useState('current');
  const [assignments, setAssignments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [menu, setMenu] = useState(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dispatch/assignments', {
        params: {
          search,
          truckId: highlightTruckId || undefined,
        },
      });
      setAssignments(data.assignments || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [search, highlightTruckId]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dispatch/assignments/history', {
        params: { search },
      });
      setHistory(data.history || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assignment history');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (view === 'current') {
        loadAssignments();
      } else {
        loadHistory();
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [view, loadAssignments, loadHistory]);

  useEffect(() => {
    if (!highlightTruckId || assignments.length === 0) return;
    const match = assignments.find((assignment) => assignment.truckId === highlightTruckId);
    if (match) {
      setSelectedAssignment(match);
      setModalOpen(true);
    }
  }, [highlightTruckId, assignments]);

  const openEdit = async (assignment) => {
    try {
      const { data } = await api.get(`/dispatch/assignments/truck/${assignment.truckId}`);
      setSelectedAssignment(data.assignment);
      setModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assignment');
    }
  };

  const handleSave = async (payload) => {
    await api.put(`/dispatch/assignments/truck/${selectedAssignment.truckId}`, payload);
    if (view === 'current') {
      await loadAssignments();
    } else {
      await loadHistory();
    }
  };

  const menuItems = useMemo(() => {
    if (!menu?.assignment) return [];
    return [
      {
        id: 'edit',
        label: canEditAssignments ? 'Edit assignment' : 'View assignment',
        onClick: () => openEdit(menu.assignment),
      },
    ];
  }, [menu, canEditAssignments]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Assignments</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Assign drivers and dispatchers to active trucks. Only Active trucks appear here.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {[
          { id: 'current', label: 'Current assignments' },
          { id: 'history', label: 'History' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              view === tab.id
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SafetyListToolbar
        search={search}
        onSearchChange={setSearch}
        status="all"
        onStatusChange={() => {}}
        canCreate={false}
      />

      {view === 'current' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Truck#', 'Driver(s)', 'Dispatcher', 'Updated'].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    No assignments found.
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    className={`cursor-context-menu text-slate-900 dark:text-slate-100 ${
                      highlightTruckId === assignment.truckId ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                    }`}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMenu({ x: event.clientX, y: event.clientY, assignment });
                    }}
                    onDoubleClick={() => openEdit(assignment)}
                  >
                    <td className="px-4 py-3 text-sm font-medium">{assignment.truckNumber}</td>
                    <td className="px-4 py-3 text-sm">{formatDrivers(assignment)}</td>
                    <td className="px-4 py-3 text-sm">{assignment.dispatcherName || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {assignment.updatedAt
                        ? new Date(assignment.updatedAt).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['When', 'Truck#', 'Action', 'Driver(s)', 'Dispatcher', 'Changed by'].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No assignment history found.
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id} className="text-slate-900 dark:text-slate-100">
                    <td className="px-4 py-3 text-sm">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{entry.truckNumber || '—'}</td>
                    <td className="px-4 py-3 text-sm capitalize">
                      {entry.action?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">{formatHistoryDrivers(entry)}</td>
                    <td className="px-4 py-3 text-sm">{entry.dispatcherName || '—'}</td>
                    <td className="px-4 py-3 text-sm">{entry.changedByName || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <AssignmentEditModal
        assignment={selectedAssignment}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        canEdit={canEditAssignments}
      />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
