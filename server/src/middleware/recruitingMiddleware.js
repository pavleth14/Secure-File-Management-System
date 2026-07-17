import { getLeadById, canAccessLead, canViewLead } from '../services/leadService.js';
import {
  hasRecruitingModuleAccess,
  hasRecruitingAllBoardsAccess,
  isRecruitingModuleUser,
} from '../utils/recruitingPermissions.js';

export function requireRecruitingAccess(req, res, next) {
  if (!hasRecruitingModuleAccess(req.user)) {
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
  if (hasRecruitingAllBoardsAccess(user)) return true;
  if (user.isRecruiter && user._id.toString() === boardUserId.toString()) return true;
  return false;
}

export async function loadLeadForView(req, res, next) {
  try {
    const leadId = req.params.leadId || req.params.id;
    const lead = await getLeadById(leadId);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    if (!canViewLead(req.user, lead)) {
      return res.status(403).json({ message: 'Access denied to this lead' });
    }

    req.lead = lead;
    next();
  } catch (err) {
    next(err);
  }
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

export { canAccessLead, isRecruitingModuleUser };
