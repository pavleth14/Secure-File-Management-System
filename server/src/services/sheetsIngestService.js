import validator from 'validator';
import { Lead } from '../models/Lead.js';
import { SheetSyncRow } from '../models/SheetSyncRow.js';
import { User } from '../models/User.js';
import { ROLES } from '../config/constants.js';
import {
  DEFAULT_LEAD_STATUS,
  DRIVER_TYPES,
} from '../config/recruitingConstants.js';
import { assertValidLeadSource } from './leadSourceService.js';
import { prependStatusCommentsToLeadData } from './leadStatusChangeService.js';
import { prependReassignmentCommentToLeadData } from './leadReassignmentService.js';
import { getRoundRobinAssignment } from './roundRobinService.js';
import { findDuplicateLead, handleLeadDuplicateError } from './leadService.js';
import { formatLeadDateIso } from '../utils/leadDateFormat.js';
import { notifyNewLeadSlack } from './slackNotificationService.js';

export const SHEET_NAME_TO_DRIVER_TYPE = {
  tbf_form_company: 'Solo',
  tbf_form_owner: 'Owner Operator',
  tbf_form_team: 'Team',
  tbf_form_local: 'Local',
  'Leads 2026': 'Solo',
};

function resolveDriverTypeFromPosition(position) {
  const value = String(position || '').trim().toLowerCase();
  if (!value) return null;
  if (value === 'company' || value.includes('solo')) return 'Solo';
  if (value.includes('owner')) return 'Owner Operator';
  if (value.includes('team')) return 'Team';
  if (value.includes('local')) return 'Local';
  return null;
}

function resolveIngestPresentation(payload, sheetName, metaLeadId, rowNumber) {
  const source = payload.source || process.env.SHEETS_DEFAULT_LEAD_SOURCE || 'Facebook';
  const isWebsite = source === 'Website';

  return {
    source,
    commentText: isWebsite
      ? `Imported from website (Apply Now / ${sheetName}, metaLeadId: ${metaLeadId}, row ${rowNumber ?? '?'}).`
      : `Imported from Google Sheets (${sheetName}, metaLeadId: ${metaLeadId}, row ${rowNumber ?? '?'}).`,
    authorLabel: isWebsite ? 'Website' : 'Google Sheets',
    reassignmentSourceLabel: isWebsite ? 'Website' : 'Google Sheets',
    slackSourceLabel: isWebsite ? `Website (${sheetName})` : `Google Sheets (${sheetName})`,
  };
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function parseCreatedTime(value) {
  if (value === null || value === undefined || value === '') {
    return new Date();
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 1_000_000_000) {
    const ms = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const parsed = new Date(String(value).trim());
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
}

function resolveDriverType(payload) {
  const fromPayload = String(payload.driverType || '').trim();
  if (fromPayload && DRIVER_TYPES.includes(fromPayload)) {
    return fromPayload;
  }

  const fromPosition = resolveDriverTypeFromPosition(payload.extraFields?.position);
  if (fromPosition) {
    return fromPosition;
  }

  const fromSheet = SHEET_NAME_TO_DRIVER_TYPE[String(payload.sheetName || '').trim()];
  if (fromSheet) {
    return fromSheet;
  }

  const err = new Error(`Unable to resolve driver type for sheet: ${payload.sheetName || 'unknown'}`);
  err.status = 400;
  throw err;
}

function mapExtraFields(extraFields) {
  if (!extraFields || typeof extraFields !== 'object' || Array.isArray(extraFields)) {
    return new Map();
  }

  const map = new Map();
  for (const [key, value] of Object.entries(extraFields)) {
    if (value === null || value === undefined) continue;
    const normalizedKey = String(key).trim();
    if (!normalizedKey) continue;
    map.set(normalizedKey, String(value).trim());
  }
  return map;
}

async function getIngestActorUserId() {
  if (process.env.SHEETS_INGEST_ACTOR_USER_ID) {
    return process.env.SHEETS_INGEST_ACTOR_USER_ID;
  }

  const superAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN }).select('_id');
  if (!superAdmin) {
    const err = new Error('No ingest actor user configured for Google Sheets leads');
    err.status = 500;
    throw err;
  }
  return superAdmin._id;
}

async function recordSyncRow({
  metaLeadId,
  spreadsheetId,
  sheetName,
  rowNumber,
  leadId,
  status,
}) {
  try {
    await SheetSyncRow.create({
      metaLeadId,
      spreadsheetId,
      sheetName,
      rowNumber,
      leadId,
      status,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return { status: 'skipped', reason: 'already_ingested', metaLeadId };
    }
    throw err;
  }
  return null;
}

export async function ingestSheetLead(payload) {
  const metaLeadId = String(payload.metaLeadId || '').trim();
  if (!metaLeadId) {
    const err = new Error('metaLeadId is required');
    err.status = 400;
    throw err;
  }

  const existingSync = await SheetSyncRow.findOne({ metaLeadId }).select('_id status leadId');
  if (existingSync) {
    return {
      status: 'skipped',
      reason: 'already_ingested',
      metaLeadId,
      leadId: existingSync.leadId ?? null,
    };
  }

  const columns = payload.columns || {};
  const firstName = String(columns.first_name || '').trim();
  const lastName = String(columns.last_name || '').trim();
  const email = normalizeEmail(columns.email);
  const phone = normalizePhone(columns.phone_number);
  const stateCity = String(columns.state || '').trim();

  if (!firstName || !lastName) {
    const err = new Error('first_name and last_name are required');
    err.status = 400;
    throw err;
  }

  if (!email || !phone) {
    const err = new Error('email and phone_number are required');
    err.status = 400;
    throw err;
  }

  if (!validator.isEmail(email, { allow_utf8_local_part: false })) {
    const err = new Error('Invalid email format');
    err.status = 400;
    throw err;
  }

  const driverType = resolveDriverType(payload);
  const sheetName = String(payload.sheetName || '').trim();
  const presentation = resolveIngestPresentation(
    payload,
    sheetName,
    metaLeadId,
    payload.rowNumber
  );
  const { source } = presentation;
  await assertValidLeadSource(source);

  const duplicate = await findDuplicateLead(email, phone);
  if (duplicate) {
    const raceSkip = await recordSyncRow({
      metaLeadId,
      spreadsheetId: payload.spreadsheetId,
      sheetName: payload.sheetName,
      rowNumber: payload.rowNumber,
      leadId: duplicate._id,
      status: 'skipped_duplicate_contact',
    });
    if (raceSkip) {
      return raceSkip;
    }

    return {
      status: 'skipped',
      reason: 'duplicate_contact',
      metaLeadId,
      leadId: duplicate._id,
    };
  }

  const assignedRecruiter = await getRoundRobinAssignment(driverType);
  const recruiter = await User.findById(assignedRecruiter).select('name');
  const actorUserId = await getIngestActorUserId();
  const timestamp = parseCreatedTime(columns.created_time);

  let leadData = {
    firstName,
    lastName,
    phone,
    email,
    stateCity,
    status: DEFAULT_LEAD_STATUS,
    driverType,
    source,
    date: formatLeadDateIso(columns.created_time, timestamp),
    assignedRecruiter,
    importedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    extraFields: mapExtraFields(payload.extraFields),
    comments: [
      {
        text: presentation.commentText,
        author: actorUserId,
        authorLabel: presentation.authorLabel,
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };

  leadData = prependStatusCommentsToLeadData(leadData, {
    userId: actorUserId,
    oldStatus: null,
    newStatus: DEFAULT_LEAD_STATUS,
    timestamp,
  });

  leadData = prependReassignmentCommentToLeadData(leadData, {
    userId: actorUserId,
    newRecruiterName: recruiter?.name || 'Recruiter',
    sourceLabel: presentation.reassignmentSourceLabel,
    timestamp,
  });

  try {
    const lead = await Lead.create(leadData);

    const raceSkip = await recordSyncRow({
      metaLeadId,
      spreadsheetId: payload.spreadsheetId,
      sheetName,
      rowNumber: payload.rowNumber,
      leadId: lead._id,
      status: 'created',
    });
    if (raceSkip) {
      return raceSkip;
    }

    notifyNewLeadSlack(
      {
        firstName,
        lastName,
        phone,
        email,
        stateCity,
        status: DEFAULT_LEAD_STATUS,
        driverType,
        source,
        assignedRecruiter: { id: assignedRecruiter, name: recruiter?.name },
      },
      { sourceLabel: presentation.slackSourceLabel, recruiterName: recruiter?.name }
    );

    return {
      status: 'created',
      metaLeadId,
      leadId: lead._id,
    };
  } catch (err) {
    const duplicateErr = handleLeadDuplicateError(err);
    if (duplicateErr) {
      const existingLead = await findDuplicateLead(email, phone);
      await recordSyncRow({
        metaLeadId,
        spreadsheetId: payload.spreadsheetId,
        sheetName,
        rowNumber: payload.rowNumber,
        leadId: existingLead?._id ?? null,
        status: 'skipped_duplicate_contact',
      });

      return {
        status: 'skipped',
        reason: 'duplicate_contact',
        metaLeadId,
        leadId: existingLead?._id ?? null,
      };
    }
    throw err;
  }
}
