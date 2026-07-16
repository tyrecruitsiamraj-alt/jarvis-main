import { describe, it, expect } from 'vitest';
import {
  DRIVING_POSITION_LABEL,
  isDrivingJobPosition,
  isDrivingPositionPreset,
  jobMatchesPositionFilter,
  resolveApplyPositionPreset,
} from '../../src/lib/jobBoardPositionPreset';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest>): JobRequest {
  return {
    id: '1',
    job_type: 'central',
    job_category: 'private',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    location_address: 'Bangkok',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-07-01',
    required_date: '2026-07-10',
    created_at: '2026-07-01',
    unit_name: 'Test',
    ...partial,
  };
}

describe('jobBoardPositionPreset', () => {
  it('resolves driving aliases to locked งานขับรถ', () => {
    expect(isDrivingPositionPreset('ขับรถ')).toBe(true);
    expect(isDrivingPositionPreset('งานขับรถ')).toBe(true);
    expect(isDrivingPositionPreset('พขร')).toBe(true);
    const preset = resolveApplyPositionPreset('ขับรถ');
    expect(preset).toEqual({
      positionFilter: DRIVING_POSITION_LABEL,
      locked: true,
      isDrivingGroup: true,
    });
  });

  it('matches พขร / valet labels as driving jobs', () => {
    expect(isDrivingJobPosition(job({ job_description_code_1: 'พขร. (ปตน.)' }))).toBe(true);
    expect(isDrivingJobPosition(job({ job_description_code_1: 'พขร. (Valet Parking)' }))).toBe(true);
    expect(isDrivingJobPosition(job({ job_description_code_1: 'พนักงานธุรการ' }))).toBe(false);
    expect(
      jobMatchesPositionFilter(job({ job_description_code_1: 'พขร. (ส่วนกลาง)' }), DRIVING_POSITION_LABEL, {
        isDrivingGroup: true,
      }),
    ).toBe(true);
  });
});
