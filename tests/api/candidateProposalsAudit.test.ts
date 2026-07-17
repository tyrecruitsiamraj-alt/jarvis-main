import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn() }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (name: string) => name }));

import { dbQuery } from '../../api/_lib/postgres.js';
import { updateProposal, upsertProposal } from '../../api/_lib/candidateProposals.js';

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  job_id: 'JOB-1',
  request_no: 'REQ-1',
  source: 'board',
  candidate_ref: '99',
  candidate_name: 'ผู้สมัครทดสอบ',
  candidate_phone: '0800000000',
  candidate_position: 'ธุรการ',
  tier: 'green',
  reason: 'สกิลและพื้นที่ตรงกับใบขอ',
  status: 'reserved',
  proposed_by_user_id: null,
  proposed_by_name: 'สมหญิง ฝ่ายสรรหา',
  created_at: '2026-07-17T03:00:00.000Z',
  updated_at: '2026-07-17T03:00:00.000Z',
};

describe('candidate proposal operator audit', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('stores the selected operator and decision reason when reserving', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row] });

    const saved = await upsertProposal({
      jobId: 'JOB-1',
      requestNo: 'REQ-1',
      source: 'board',
      candidateRef: '99',
      candidateName: 'ผู้สมัครทดสอบ',
      tier: 'green',
      status: 'reserved',
      reason: 'สกิลและพื้นที่ตรงกับใบขอ',
      userName: 'สมหญิง ฝ่ายสรรหา',
    });

    const [, params] = vi.mocked(dbQuery).mock.calls[0];
    expect(params).toEqual(expect.arrayContaining(['สกิลและพื้นที่ตรงกับใบขอ', 'สมหญิง ฝ่ายสรรหา']));
    expect(saved.proposed_by_name).toBe('สมหญิง ฝ่ายสรรหา');
    expect(saved.reason).toBe('สกิลและพื้นที่ตรงกับใบขอ');
  });

  it('updates operator and reason when cancelling', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{ ...row, status: 'cancelled', reason: 'ผู้สมัครไม่สะดวกเริ่มงาน', proposed_by_name: 'วิชัย สรรหา' }],
    });

    const saved = await updateProposal(row.id, {
      status: 'cancelled',
      reason: 'ผู้สมัครไม่สะดวกเริ่มงาน',
      proposedByName: 'วิชัย สรรหา',
    });

    const [sql, params] = vi.mocked(dbQuery).mock.calls[0];
    expect(sql).toContain('proposed_by_name');
    expect(params).toEqual(['cancelled', 'ผู้สมัครไม่สะดวกเริ่มงาน', 'วิชัย สรรหา', row.id]);
    expect(saved).toMatchObject({ status: 'cancelled', proposed_by_name: 'วิชัย สรรหา' });
  });
});
