import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ContextMenu from '../../components/ContextMenu';
import SafetyListToolbar from '../../components/dispatch-safety/SafetyListToolbar';
import TruckFormModal from '../../components/dispatch-safety/TruckFormModal';

export default function TrucksPage() {
  const navigate = useNavigate();
  const { canEditSafetyEntities, canDeleteSafetyEntities, canLinkFolders } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [menu, setMenu] = useState(null);

  const loadTrucks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dispatch/trucks', {
        params: { search, status: status === 'all' ? undefined : status },
      });
      setTrucks(data.trucks || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trucks');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadTrucks, 250);
    return () => window.clearTimeout(timer);
  }, [loadTrucks]);

  const openCreate = () => {
    setSelectedTruck(null);
    setModalOpen(true);
  };

  const openEdit = (truck) => {
    setSelectedTruck(truck);
    setModalOpen(true);
  };

  const handleSave = async (form) => {
    if (selectedTruck) {
      await api.put(`/dispatch/trucks/${selectedTruck.id}`, form);
    } else {
      await api.post('/dispatch/trucks', form);
    }
    await loadTrucks();
  };

  const handleDelete = async (truck) => {
    if (!confirm(`Delete truck ${truck.truckNumber}?`)) return;
    try {
      await api.delete(`/dispatch/trucks/${truck.id}`);
      await loadTrucks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete truck');
    }
  };

  const menuItems = useMemo(() => {
    if (!menu?.truck) return [];
    const truck = menu.truck;
    const items = [
      {
        id: 'view',
        label: 'View / Edit truck',
        onClick: () => openEdit(truck),
      },
      {
        id: 'assignment',
        label: 'Go to truck assignment',
        onClick: () => navigate(`/safety/assignments?truckId=${truck.id}`),
      },
    ];

    if (canDeleteSafetyEntities) {
      items.push({
        id: 'delete',
        label: 'Delete truck',
        destructive: true,
        onClick: () => handleDelete(truck),
      });
    }

    return items;
  }, [menu, canDeleteSafetyEntities, navigate]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Trucks</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage fleet trucks, statuses, and folder links.
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
        status={status}
        onStatusChange={setStatus}
        onNew={openCreate}
        newLabel="New Truck"
        canCreate={canEditSafetyEntities}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {['Truck#', 'Type', 'Status', 'Make', 'Model', 'Year', 'Plate#'].map((label) => (
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
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : trucks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  No trucks found.
                </td>
              </tr>
            ) : (
              trucks.map((truck) => (
                <tr
                  key={truck.id}
                  className="cursor-context-menu text-slate-900 dark:text-slate-100"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, truck });
                  }}
                >
                  <td className="px-4 py-3 text-sm font-medium">{truck.truckNumber}</td>
                  <td className="px-4 py-3 text-sm">{truck.type || '—'}</td>
                  <td className="px-4 py-3 text-sm">{truck.status}</td>
                  <td className="px-4 py-3 text-sm">{truck.make || '—'}</td>
                  <td className="px-4 py-3 text-sm">{truck.model || '—'}</td>
                  <td className="px-4 py-3 text-sm">{truck.year || '—'}</td>
                  <td className="px-4 py-3 text-sm">{truck.plateNumber || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TruckFormModal
        truck={selectedTruck}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        canEdit={canEditSafetyEntities}
        canLinkFolder={canLinkFolders}
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
