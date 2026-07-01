// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  candidateStatusAfterAssignment,
  isTerminalCandidateStatus,
  parseCreateAssignmentInput,
} from '../../api/_lib/jobAssignmentService';
import {
  assertAllowedStatusTransition,
  assertIssueReasonForStatus,
  parseCreateWorkCalendarInput,
  parseUpdateWorkCalendarInput,
  requiresIssueReason,
} from '../../api/_lib/workCalendarService';
import { DomainError } from '../../api/_lib/domainErrors';

describe('JobAssignmentService rules', () => {
  it('blocks terminal candidate statuses', () => {
    expect(isTerminalCandidateStatus('drop')).toBe(true);
    expect(isTerminalCandidateStatus('done')).toBe(true);
    expect(isTerminalCandidateStatus('inprocess')).toBe(false);
  });

  it('maps candidate status on assignment', () => {
    expect(candidateStatusAfterAssignment('inprocess', 'sent')).toBe('waiting_interview');
    expect(candidateStatusAfterAssignment('drop', 'sent')).toBeNull();
    expect(candidateStatusAfterAssignment('waiting_interview', 'started')).toBe('waiting_to_start');
  });

  it('parses valid assignment input', () => {
    const input = parseCreateAssignmentInput({
      job_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      candidate_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      candidate_name: 'Test User',
      assignment_type: 'trial',
      start_date: '2026-06-01',
      status: 'sent',
      trial_days: 3,
    });
    expect(input.assignment_type).toBe('trial');
    expect(input.trial_days).toBe(3);
  });

  it('rejects invalid assignment input', () => {
    expect(() =>
      parseCreateAssignmentInput({ job_id: 'x', candidate_id: 'y', candidate_name: '' }),
    ).toThrow(DomainError);
  });

  it('defines active assignment statuses for duplicate detection', () => {
    expect(ACTIVE_ASSIGNMENT_STATUSES).toContain('sent');
    expect(ACTIVE_ASSIGNMENT_STATUSES).not.toContain('cancelled');
  });
});

describe('WorkCalendarService rules', () => {
  it('requires issue_reason for problem statuses', () => {
    expect(requiresIssueReason('late')).toBe(true);
    expect(requiresIssueReason('normal_work')).toBe(false);
    expect(() => assertIssueReasonForStatus('no_show', null)).toThrow(DomainError);
    expect(() => assertIssueReasonForStatus('no_show', 'มาสาย')).not.toThrow();
  });

  it('parses create input with defaults', () => {
    const input = parseCreateWorkCalendarInput({
      employee_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      work_date: '2026-06-08',
      status: 'normal_work',
    });
    expect(input.status).toBe('normal_work');
  });

  it('rejects create without issue_reason when required', () => {
    expect(() =>
      parseCreateWorkCalendarInput({
        employee_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        work_date: '2026-06-08',
        status: 'late',
      }),
    ).toThrow(DomainError);
  });

  it('allows predictable status transitions', () => {
    expect(() => assertAllowedStatusTransition('normal_work', 'late')).not.toThrow();
    expect(() => assertAllowedStatusTransition('day_off', 'no_show')).toThrow(DomainError);
  });

  it('duplicate assignment conflict uses HTTP 409', () => {
    const err = new DomainError(409, 'Conflict', 'Candidate is already actively assigned to this job');
    expect(err.statusCode).toBe(409);
  });

  it('parseUpdateWorkCalendarInput accepts PATCH payload', () => {
    const patch = parseUpdateWorkCalendarInput({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'late',
      issue_reason: 'มาสาย',
    });
    expect(patch.status).toBe('late');
    expect(patch.issue_reason).toBe('มาสาย');
  });

  it('duplicate calendar create conflict uses HTTP 409 message', () => {
    const err = new DomainError(
      409,
      'Conflict',
      'A calendar entry already exists for this employee on this date — use PATCH to update',
    );
    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('use PATCH');
  });
});
