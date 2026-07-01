// @vitest-environment node
/**
 * Database integration tests — run only when DATABASE_URL is set.
 * Without a DB: these tests are skipped; see PRODUCTION_READINESS_CHECKLIST.md for manual UAT.
 */
import { describe, it, expect } from 'vitest';
import { dbQuery } from '../../api/_lib/postgres.js';
import { createJobAssignment, parseCreateAssignmentInput } from '../../api/_lib/jobAssignmentService.js';
import { createWorkCalendarEntry, parseCreateWorkCalendarInput } from '../../api/_lib/workCalendarService.js';
import { DomainError } from '../../api/_lib/domainErrors.js';

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const skipReason =
  'DATABASE_URL not set — run: copy .env.example → .env.local, npm run db:migrate, npm run db:seed';

const ACTOR = {
  userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  userName: 'integration@test',
  role: 'supervisor' as const,
};

describe.skipIf(!hasDb)(`PostgreSQL connectivity (${skipReason})`, () => {
  it('executes select 1', async () => {
    const { rows } = await dbQuery<{ ok: number }>('select 1 as ok');
    expect(rows[0]?.ok).toBe(1);
  });
});

describe.skipIf(!hasDb)('Assignment workflow (requires seeded job + candidate)', () => {
  const JOB_ID = process.env.UAT_JOB_ID?.trim();
  const CANDIDATE_ID = process.env.UAT_CANDIDATE_ID?.trim();

  it.skipIf(!JOB_ID || !CANDIDATE_ID)(
    'duplicate active assignment returns 409 Conflict',
    async () => {
      const input = parseCreateAssignmentInput({
        job_id: JOB_ID,
        candidate_id: CANDIDATE_ID,
        candidate_name: 'UAT Candidate',
        assignment_type: 'trial',
        start_date: '2026-06-01',
        status: 'sent',
      });

      await createJobAssignment(input, ACTOR);
      await expect(createJobAssignment(input, ACTOR)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('already actively assigned'),
      } satisfies Partial<DomainError>);
    },
    30_000,
  );

  it.skipIf(!JOB_ID)(
    'missing job returns 404 Not Found',
    async () => {
      const input = parseCreateAssignmentInput({
        job_id: '00000000-0000-4000-8000-000000000099',
        candidate_id: CANDIDATE_ID || '00000000-0000-4000-8000-000000000088',
        candidate_name: 'Ghost',
        assignment_type: 'trial',
        start_date: '2026-06-01',
        status: 'sent',
      });
      await expect(createJobAssignment(input, ACTOR)).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Job not found'),
      } satisfies Partial<DomainError>);
    },
    15_000,
  );
});

describe.skipIf(!hasDb)('Work calendar workflow (requires seeded employee)', () => {
  const EMPLOYEE_ID = process.env.UAT_EMPLOYEE_ID?.trim();

  it.skipIf(!EMPLOYEE_ID)(
    'duplicate employee/date create returns 409 Conflict',
    async () => {
      const workDate = '2099-01-15';
      const input = parseCreateWorkCalendarInput({
        employee_id: EMPLOYEE_ID,
        work_date: workDate,
        status: 'normal_work',
      });

      try {
        await createWorkCalendarEntry(input, ACTOR);
      } catch (e) {
        if (!(e instanceof DomainError && e.statusCode === 409)) throw e;
      }

      await expect(createWorkCalendarEntry(input, ACTOR)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('already exists'),
      } satisfies Partial<DomainError>);
    },
    30_000,
  );
});

describe('Database integration — blocked state documentation', () => {
  it.skipIf(hasDb)('documents why DB tests are skipped locally', () => {
    expect(hasDb).toBe(false);
    expect(skipReason).toContain('DATABASE_URL');
  });
});
