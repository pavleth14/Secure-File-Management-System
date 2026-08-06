import { Router } from 'express';
import { requireSheetsIngestApiKey } from '../middleware/sheetsIngestMiddleware.js';
import { ingestSheetLead } from '../services/sheetsIngestService.js';

const router = Router();

router.post('/ingest', requireSheetsIngestApiKey, async (req, res, next) => {
  try {
    const result = await ingestSheetLead(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
