import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { addDaysToDateKey } from '../../utils/dispatchWeek';
import ContextMenu from '../../components/ContextMenu';
import DispatchBoardToolbar from '../../components/dispatch-board/DispatchBoardToolbar';
import DispatchBoardGrid from '../../components/dispatch-board/DispatchBoardGrid';
import LoadCommentsPopover from '../../components/dispatch-board/LoadCommentsPopover';
import LoadFormModal from '../../components/dispatch-safety/LoadFormModal';

export default function DispatchBoardPage() {
  const { boardKey } = useParams();
  const {
    canCreateOrEditLoads,
    canArchiveLoads,
    canCommentOnLoads,
  } = useAuth();

  const [weekStartParam, setWeekStartParam] = useState(undefined);
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [boardName, setBoardName] = useState('');
  const [days, setDays] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [menu, setMenu] = useState(null);
  const [commentsState, setCommentsState] = useState({ open: false, loadId: null, anchorRect: null });

  const loadGrid = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/dispatch/boards/${boardKey}/grid`, {
        params: weekStartParam ? { weekStart: weekStartParam } : undefined,
      });
      setBoardName(data.board?.name || 'Dispatch Board');
      setWeekStart(data.weekStart);
      setWeekEnd(data.weekEnd);
      setDays(data.days || []);
      setRows(data.rows || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [boardKey, weekStartParam]);

  useEffect(() => {
    setWeekStartParam(undefined);
  }, [boardKey]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const openLoad = async (loadId) => {
    try {
      const { data } = await api.get(`/dispatch/loads/${loadId}`);
      setSelectedLoad(data.load);
      setModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load details');
    }
  };

  const handleSave = async (form) => {
    const payload = {
      ...form,
      invoiceAmount: Number(form.invoiceAmount),
      loadedMiles: Number(form.loadedMiles),
      emptyMiles: Number(form.emptyMiles),
    };

    if (selectedLoad) {
      await api.put(`/dispatch/loads/${selectedLoad.id}`, payload);
    } else {
      await api.post('/dispatch/loads', payload);
    }
    await loadGrid();
  };

  const handleArchive = async (load) => {
    if (!confirm(`Archive Load #${load.loadNumber}?`)) return;
    try {
      await api.delete(`/dispatch/loads/${load.id}`);
      setModalOpen(false);
      await loadGrid();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to archive load');
    }
  };

  const handleMarkActive = async (load) => {
    try {
      await api.post(`/dispatch/loads/${load.id}/mark-active`);
      await openLoad(load.id);
      await loadGrid();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark load active');
    }
  };

  const handleMarkDelivered = async (load) => {
    try {
      await api.post(`/dispatch/loads/${load.id}/mark-delivered`);
      await openLoad(load.id);
      await loadGrid();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark load delivered');
    }
  };

  const menuItems = useMemo(() => {
    if (!menu?.load) return [];
    const load = menu.load;
    const items = [
      {
        id: 'view',
        label: canCreateOrEditLoads ? 'View / Edit load' : 'View load',
        onClick: () => openLoad(load.id),
      },
    ];

    if (canArchiveLoads) {
      items.push({
        id: 'archive',
        label: 'Archive load',
        destructive: true,
        onClick: async () => {
          await handleArchive({ id: load.id, loadNumber: load.loadNumber });
        },
      });
    }

    return items;
  }, [menu, canCreateOrEditLoads, canArchiveLoads]);

  const handleLoadClick = (event, load) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCommentsState({
      open: true,
      loadId: load.id,
      anchorRect: rect,
    });
  };

  const handleLoadContextMenu = (event, load) => {
    setMenu({
      x: event.clientX,
      y: event.clientY,
      load,
    });
  };

  return (
    <div>
      <DispatchBoardToolbar
        boardName={boardName || 'Dispatch Board'}
        weekStart={weekStart}
        weekEnd={weekEnd}
        loading={loading}
        canCreateLoads={canCreateOrEditLoads}
        onPrevWeek={() => weekStart && setWeekStartParam(addDaysToDateKey(weekStart, -7))}
        onNextWeek={() => weekStart && setWeekStartParam(addDaysToDateKey(weekStart, 7))}
        onThisWeek={() => setWeekStartParam(undefined)}
        onNewLoad={() => {
          setSelectedLoad(null);
          setModalOpen(true);
        }}
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Loading board...</div>
      ) : (
        <DispatchBoardGrid
          days={days}
          rows={rows}
          onLoadClick={handleLoadClick}
          onLoadContextMenu={handleLoadContextMenu}
        />
      )}

      <LoadFormModal
        load={selectedLoad}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={handleArchive}
        onMarkActive={handleMarkActive}
        onMarkDelivered={handleMarkDelivered}
        canEdit={canCreateOrEditLoads}
        canArchive={canArchiveLoads}
        canMarkStatus={canCreateOrEditLoads}
        canComment={canCommentOnLoads}
      />

      <LoadCommentsPopover
        loadId={commentsState.loadId}
        anchorRect={commentsState.anchorRect}
        open={commentsState.open}
        onClose={() => setCommentsState({ open: false, loadId: null, anchorRect: null })}
      />

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
