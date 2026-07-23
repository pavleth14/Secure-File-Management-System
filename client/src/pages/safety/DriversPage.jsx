import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ContextMenu from '../../components/ContextMenu';
import SafetyListToolbar from '../../components/dispatch-safety/SafetyListToolbar';
import DriverFormModal from '../../components/dispatch-safety/DriverFormModal';
import LinkedFolderCell, { buildViewFilesMenuItem } from '../../components/dispatch-safety/LinkedFolderCell';

export default function DriversPage() {
  const { canEditSafetyEntities, canDeleteSafetyEntities, canLinkFolders } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [menu, setMenu] = useState(null);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dispatch/drivers', {
        params: { search, status: status === 'all' ? undefined : status },
      });
      setDrivers(data.drivers || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadDrivers, 250);
    return () => window.clearTimeout(timer);
  }, [loadDrivers]);

  const openCreate = () => {
    setSelectedDriver(null);
    setModalOpen(true);
  };

  const openEdit = async (driver) => {
    try {
      const { data } = await api.get(`/dispatch/drivers/${driver.id}`);
      setSelectedDriver(data.driver);
      setModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load driver');
    }
  };

  const handleSave = async (form) => {
    if (selectedDriver) {
      await api.put(`/dispatch/drivers/${selectedDriver.id}`, form);
    } else {
      await api.post('/dispatch/drivers', form);
    }
    await loadDrivers();
  };

  const handleDelete = async (driver) => {
    if (!confirm(`Delete driver ${driver.name}?`)) return;
    try {
      await api.delete(`/dispatch/drivers/${driver.id}`);
      await loadDrivers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete driver');
    }
  };

  const menuItems = useMemo(() => {
    if (!menu?.driver) return [];
    const driver = menu.driver;
    const items = [
      {
        id: 'view',
        label: 'View / Edit driver',
        onClick: () => openEdit(driver),
      },
    ];

    const viewFilesItem = buildViewFilesMenuItem(driver);
    if (viewFilesItem) items.push(viewFilesItem);

    if (canDeleteSafetyEntities) {
      items.push({
        id: 'delete',
        label: 'Delete driver',
        destructive: true,
        onClick: () => handleDelete(driver),
      });
    }

    return items;
  }, [menu, canDeleteSafetyEntities]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Drivers</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage drivers, CDL info, and folder links.
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
        newLabel="New Driver"
        canCreate={canEditSafetyEntities}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {['Name', 'Type', 'Status', 'Phone', 'Email', 'CDL#', 'CDL State', 'Folder'].map((label) => (
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
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  No drivers found.
                </td>
              </tr>
            ) : (
              drivers.map((driver) => (
                <tr
                  key={driver.id}
                  className="cursor-context-menu text-slate-900 dark:text-slate-100"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, driver });
                  }}
                >
                  <td className="px-4 py-3 text-sm font-medium">{driver.name}</td>
                  <td className="px-4 py-3 text-sm">{driver.driverType}</td>
                  <td className="px-4 py-3 text-sm">{driver.status}</td>
                  <td className="px-4 py-3 text-sm">{driver.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm">{driver.email || '—'}</td>
                  <td className="px-4 py-3 text-sm">{driver.cdlNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm">{driver.cdlState || '—'}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-sm">
                    <LinkedFolderCell
                      linkedFolderId={driver.linkedFolderId}
                      linkedFolderPath={driver.linkedFolderPath}
                      linkedFolderName={driver.linkedFolderName}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DriverFormModal
        driver={selectedDriver}
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
