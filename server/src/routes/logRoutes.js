import { Router } from 'express';
import * as XLSX from 'xlsx';
import { AuditLog } from '../models/AuditLog.js';
import { ROLES } from '../config/constants.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import {
  queryLogs,
  queryAllLogs,
  formatLog,
  formatRoleDisplay,
  canViewLog,
} from '../services/logQueryService.js';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', async (req, res, next) => {
  try {
    const result = await queryLogs(req.query, req.user.role);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const format = req.query.format || 'csv';
    const logs = await queryAllLogs(req.query, req.user.role);

    if (format === 'xlsx' || format === 'excel') {
      const rows = logs.map(logToExportRow);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-logs-${Date.now()}.xlsx"`
      );
      return res.send(buffer);
    }

    const csv = logsToCsv(logs);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${Date.now()}.csv"`
    );
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const log = await AuditLog.findById(req.params.id).lean();
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }
    if (!canViewLog(req.user.role, log)) {
      return res.status(403).json({ message: 'Insufficient role permissions' });
    }
    res.json({ log: formatLog(log) });
  } catch (err) {
    next(err);
  }
});

function logToExportRow(log) {
  return {
    Time: new Date(log.timestamp).toISOString(),
    User: log.username,
    Role: formatRoleDisplay(log.userRole),
    Category: log.category,
    Action: log.action,
    'Target Type': log.targetType || '',
    'Target Name': log.targetName || '',
    Details: log.details || '',
    'IP Address': log.ipAddress || '',
    'User Agent': log.userAgent || '',
    'Old Values': log.oldValues ? JSON.stringify(log.oldValues) : '',
    'New Values': log.newValues ? JSON.stringify(log.newValues) : '',
  };
}

function logsToCsv(logs) {
  const headers = [
    'Time',
    'User',
    'Role',
    'Category',
    'Action',
    'Target Type',
    'Target Name',
    'Details',
    'IP Address',
    'User Agent',
    'Old Values',
    'New Values',
  ];

  const escape = (val) => {
    const str = val == null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = logs.map((log) => {
    const row = logToExportRow(log);
    return headers.map((h) => escape(row[h])).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export default router;
