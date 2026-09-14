import { Router } from 'express';
import { requireRecruitingManager } from '../middleware/recruitingMiddleware.js';
import {
  buildDuplicateLeadsCsv,
  listDuplicateLeads,
} from '../services/duplicateLeadService.js';

const router = Router();

router.get('/', requireRecruitingManager, async (req, res, next) => {
  try {
    const result = await listDuplicateLeads({
      page: req.query.page,
      limit: req.query.limit,
      sortOccurrences: req.query.sortOccurrences,
      minOccurrences: req.query.minOccurrences,
      maxOccurrences: req.query.maxOccurrences,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/export', requireRecruitingManager, async (req, res, next) => {
  try {
    const csv = await buildDuplicateLeadsCsv({
      sortOccurrences: req.query.sortOccurrences,
      minOccurrences: req.query.minOccurrences,
      maxOccurrences: req.query.maxOccurrences,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="duplicate-leads.csv"'
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
