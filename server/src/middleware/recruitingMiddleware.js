import { getLeadById, canAccessLead } from '../services/leadService.js';

export function requireRecruitingAccess(req, res, next) {
  if (!req.user?.isRecruiter && !req.user?.isRecruitingManager) {
    return res.status(403).json({ message: 'Recruiting access required' });
  }
  next();
}

export function requireRecruitingManager(req, res, next) {
  if (!req.user?.isRecruitingManager) {
    return res.status(403).json({ message: 'Recruiting manager access required' });
  }
  next();
}

export function canAccessRecruiterBoard(user, boardUserId) {
  if (user.isRecruitingManager) return true;
  if (user.isRecruiter && user._id.toString() === boardUserId.toString()) return true;
  return false;
}

export async function loadLeadForUser(req, res, next) {
  try {
    const leadId = req.params.leadId || req.params.id;
    const lead = await getLeadById(leadId);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    if (!canAccessLead(req.user, lead)) {
      return res.status(403).json({ message: 'Access denied to this lead' });
    }

    req.lead = lead;
    next();
  } catch (err) {
    next(err);
  }
}

export { canAccessLead };
