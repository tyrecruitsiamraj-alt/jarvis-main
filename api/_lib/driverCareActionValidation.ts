import { DomainError } from './domainErrors.js';
import { getString } from './body.js';
import { isValidYmd } from './businessDate.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTION_TYPES = new Set([
  'call',
  'meeting',
  'income_check',
  'site_check',
  'supervisor_escalation',
  'other',
]);

const ACTION_STATUSES = new Set(['pending', 'in_progress', 'closed']);

const CONTACT_STATUSES = new Set(['contacted', 'not_reached']);

const ISSUE_FOUND = new Set([
  'income_drop',
  'ot_drop',
  'leave_issue',
  'attendance_issue',
  'client_issue',
  'supervisor_issue',
  'personal_issue',
  'other',
  'none',
]);

const ACTION_RESULTS = new Set([
  'stay',
  'unsure',
  'confirmed_resign',
  'not_reached',
  'pending',
]);

const MAX_NOTE_LENGTH = 2000;

function requireUuid(value: string | undefined, field: string): string {
  const v = value?.trim();
  if (!v || !UUID_RE.test(v)) {
    throw new DomainError(400, 'Bad request', `${field} must be a valid UUID`);
  }
  return v;
}

function requireEnum(value: string | undefined, field: string, allowed: Set<string>): string {
  const v = value?.trim();
  if (!v || !allowed.has(v)) {
    throw new DomainError(400, 'Bad request', `${field} is invalid`);
  }
  return v;
}

function requireNote(value: string | undefined, field: string): string {
  const v = value?.trim();
  if (!v) {
    throw new DomainError(400, 'Bad request', `${field} is required`);
  }
  if (v.length > MAX_NOTE_LENGTH) {
    throw new DomainError(400, 'Bad request', `${field} must be at most ${MAX_NOTE_LENGTH} characters`);
  }
  return v;
}

function parseOptionalFollowUp(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const v = getString(value);
  if (!v) return null;
  if (!isValidYmd(v)) {
    throw new DomainError(400, 'Bad request', 'nextFollowUpDate must be YYYY-MM-DD');
  }
  return v;
}

export type ValidatedActionLogInput = {
  employeeId: string;
  riskScoreId: string | null;
  actionType: string;
  contactStatus: string;
  issueFound: string;
  actionTaken: string;
  result: string;
  status: string;
  nextFollowUpDate: string | null;
};

export function parseActionLogInput(raw: Record<string, unknown>): ValidatedActionLogInput {
  const employeeId = requireUuid(getString(raw.employeeId), 'employeeId');
  const riskScoreIdRaw = getString(raw.riskScoreId);
  const riskScoreId = riskScoreIdRaw ? requireUuid(riskScoreIdRaw, 'riskScoreId') : null;

  return {
    employeeId,
    riskScoreId,
    actionType: requireEnum(getString(raw.actionType), 'actionType', ACTION_TYPES),
    contactStatus: requireEnum(getString(raw.contactStatus) || 'contacted', 'contactStatus', CONTACT_STATUSES),
    issueFound: requireEnum(getString(raw.issueFound), 'issueFound', ISSUE_FOUND),
    actionTaken: requireNote(getString(raw.actionTaken), 'actionTaken'),
    result: requireEnum(getString(raw.result), 'result', ACTION_RESULTS),
    status: requireEnum(getString(raw.status) || 'pending', 'status', ACTION_STATUSES),
    nextFollowUpDate: parseOptionalFollowUp(raw.nextFollowUpDate),
  };
}

export type ValidatedActionUpdateInput = {
  id: string;
  status?: string;
  result?: string;
  actionTaken?: string;
  nextFollowUpDate?: string | null | undefined;
};

export function parseActionUpdateInput(raw: Record<string, unknown>): ValidatedActionUpdateInput {
  const id = requireUuid(getString(raw.id), 'id');
  const out: ValidatedActionUpdateInput = { id };

  if (raw.status !== undefined) {
    out.status = requireEnum(getString(raw.status), 'status', ACTION_STATUSES);
  }
  if (raw.result !== undefined) {
    out.result = requireEnum(getString(raw.result), 'result', ACTION_RESULTS);
  }
  if (raw.actionTaken !== undefined) {
    out.actionTaken = requireNote(getString(raw.actionTaken), 'actionTaken');
  }
  if (raw.nextFollowUpDate === null) {
    out.nextFollowUpDate = null;
  } else if (raw.nextFollowUpDate !== undefined) {
    out.nextFollowUpDate = parseOptionalFollowUp(raw.nextFollowUpDate);
  }

  if (out.status === undefined && out.result === undefined && out.actionTaken === undefined && out.nextFollowUpDate === undefined) {
    throw new DomainError(400, 'Bad request', 'At least one field to update is required');
  }

  return out;
}
