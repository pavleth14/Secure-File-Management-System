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

export default function AssignmentsPage() {
  const [searchParams] = useSearchParams();
  const highlightTruckId = searchParams.get('truckId');
  const { canEditAssignments } = useAuth();
  const [assignments, setAssignments] = useState([]);
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

  useEffect(() => {
    const timer = window.setTimeout(loadAssignments, 250);
    return () => window.clearTimeout(timer);
  }, [loadAssignments]);

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
    await loadAssignments();
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

      <SafetyListToolbar
        search={search}
        onSearchChange={setSearch}
        status="all"
        onStatusChange={() => {}}
        canCreate={false}
      />

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
