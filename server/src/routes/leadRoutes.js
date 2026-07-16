import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  requireRecruitingAccess,
  requireRecruitingManager,
  loadLeadForUser,
} from '../middleware/recruitingMiddleware.js';
import {
  listActiveLeads,
  listArchivedLeads,
  createLead,
  updateLead,
  addComment,
  editComment,
  assignLead,
  archiveLead,
  formatLead,
  handleLeadDuplicateError,
} from '../services/leadService.js';
import {
  auditLeadArchived,
  auditLeadCommentAdded,
  auditLeadCommentEdited,
  auditLeadCreated,
  auditLeadReassigned,
  auditLeadUpdated,
} from '../services/recruitingAuditService.js';
import { Lead } from '../models/Lead.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRecruitingAccess);

function pickLeadSnapshot(leadDoc) {
  return {
    firstName: leadDoc.firstName,
    lastName: leadDoc.lastName,
    phone: leadDoc.phone,
    email: leadDoc.email,
    stateCity: leadDoc.stateCity,
    status: leadDoc.status,
    driverType: leadDoc.driverType,
    assignedRecruiter: leadDoc.assignedRecruiter?.toString?.() || leadDoc.assignedRecruiter,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const {
      recruiterId,
      page,
      limit,
      search,
      status,
      driverType,
      source,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
    } = req.query;

    const result = await listActiveLeads(req.user, {
      recruiterId,
      page,
      limit,
      search,
      status,
      driverType,
      source,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
    });

    res.json({
      leads: result.leads.map(formatLead),
      page: result.page,
      limit: result.limit,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/archived', requireRecruitingManager, async (req, res, next) => {
  try {
    const {
      recruiterId,
      page,
      limit,
      search,
      status,
      driverType,
      source,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
    } = req.query;

    const result = await listArchivedLeads(req.user, {
      recruiterId,
      page,
      limit,
      search,
      status,
      driverType,
      source,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
    });

    res.json({
      leads: result.leads.map(formatLead),
      page: result.page,
      limit: result.limit,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', loadLeadForUser, async (req, res) => {
  res.json({ lead: formatLead(req.lead) });
});

router.post('/', async (req, res, next) => {
  try {
    const lead = await createLead(req.user, req.body);
    await auditLeadCreated({ user: req.user, lead, req });
    res.status(201).json({ lead: formatLead(lead) });
  } catch (err) {
    const duplicateErr = handleLeadDuplicateError(err);
    next(duplicateErr || err);
  }
});

router.put('/:id', loadLeadForUser, async (req, res, next) => {
  try {
    const leadDoc = await Lead.findById(req.lead._id);
    const oldValues = pickLeadSnapshot(leadDoc);
    const lead = await updateLead(req.user, leadDoc, req.body);
    await auditLeadUpdated({
      user: req.user,
      lead: leadDoc,
      req,
      oldValues,
      newValues: pickLeadSnapshot(leadDoc),
    });
    res.json({ lead: formatLead(lead) });
  } catch (err) {
    const duplicateErr = handleLeadDuplicateError(err);
    next(duplicateErr || err);
  }
});

router.patch('/:id', loadLeadForUser, async (req, res, next) => {
  try {
    const leadDoc = await Lead.findById(req.lead._id);
    const oldValues = pickLeadSnapshot(leadDoc);
    const lead = await updateLead(req.user, leadDoc, req.body);
    await auditLeadUpdated({
      user: req.user,
      lead: leadDoc,
      req,
      oldValues,
      newValues: pickLeadSnapshot(leadDoc),
    });
    res.json({ lead: formatLead(lead) });
  } catch (err) {
    const duplicateErr = handleLeadDuplicateError(err);
    next(duplicateErr || err);
  }
});

router.post('/:id/comments', loadLeadForUser, async (req, res, next) => {
  try {
    const leadDoc = await Lead.findById(req.lead._id);
    const lead = await addComment(req.user, leadDoc, req.body.text);
    await auditLeadCommentAdded({
      user: req.user,
      lead: leadDoc,
      req,
      commentText: req.body.text,
    });
    res.status(201).json({ lead: formatLead(lead) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/comments/:commentId', loadLeadForUser, async (req, res, next) => {
  try {
    const leadDoc = await Lead.findById(req.lead._id);
    const existing = leadDoc.comments.id(req.params.commentId);
    const oldText = existing?.text || null;
    const lead = await editComment(req.user, leadDoc, req.params.commentId, req.body.text);
    await auditLeadCommentEdited({
      user: req.user,
      lead: leadDoc,
      req,
      oldText,
      newText: req.body.text,
    });
    res.json({ lead: formatLead(lead) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/assign', requireRecruitingManager, loadLeadForUser, async (req, res, next) => {
  try {
    const { assignedRecruiterId } = req.body;
    if (!assignedRecruiterId) {
      return res.status(400).json({ message: 'assignedRecruiterId is required' });
    }

    const leadDoc = await Lead.findById(req.lead._id);
    const oldRecruiterId = leadDoc.assignedRecruiter?.toString?.() || leadDoc.assignedRecruiter;
    const lead = await assignLead(req.user, leadDoc, assignedRecruiterId);
    await auditLeadReassigned({
      user: req.user,
      lead: leadDoc,
      req,
      oldRecruiterId,
      newRecruiterId: assignedRecruiterId,
    });
    res.json({ lead: formatLead(lead) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/archive', requireRecruitingManager, loadLeadForUser, async (req, res, next) => {
  try {
    const leadDoc = await Lead.findById(req.lead._id);
    const wasArchived = leadDoc.archived;
    const lead = await archiveLead(req.user, leadDoc);
    if (!wasArchived) {
      await auditLeadArchived({ user: req.user, lead: leadDoc, req });
    }
    res.json({ lead: formatLead(lead) });
  } catch (err) {
    next(err);
  }
});

export default router;
