import { describe, expect, it } from 'vitest';
import { distributeIrecruitMatchesToBranches, proximityToBranch } from '../../src/lib/distributeIrecruitToBranches';
import type { IrecruitCandidateMatch } from '../../src/lib/irecruitMatchTypes';

function match(partial: Partial<IrecruitCandidateMatch> & Pick<IrecruitCandidateMatch, 'id' | 'full_name'>): IrecruitCandidateMatch {
  return {
    phone_number: null,
    line_id: null,
    position_name: 'พนักงานขับรถ',
    job_name_th: null,
    specific_name: null,
    location_label: null,
    province_name: null,
    district_name: null,
    driving_licenses: [],
    sex: null,
    age: null,
    weight: null,
    height: null,
    process_status_name: 'รอดำเนินการ',
    applied_at: '2026-01-01',
    tier: 'green',
    reason: 'ตรงตำแหน่ง',
    prescore: 5,
    ...partial,
  };
}

describe('distributeIrecruitMatchesToBranches (Option A)', () => {
  it('ranks district match higher than other province', () => {
    const near = match({
      id: 1,
      full_name: 'สมชาย มีนบุรี',
      district_name: 'มีนบุรี',
      province_name: 'กรุงเทพมหานคร',
      location_label: 'มีนบุรี, กรุงเทพมหานคร',
    });
    const far = match({
      id: 2,
      full_name: 'สมหญิง เชียงใหม่',
      district_name: 'เมือง',
      province_name: 'เชียงใหม่',
      location_label: 'เมือง, เชียงใหม่',
      tier: 'green',
      prescore: 99,
    });
    const proxNear = proximityToBranch(near, {
      branch_name_clean: 'Fashion Island (เขตมีนบุรี)',
      district_hint: 'มีนบุรี',
      province_hint: 'กรุงเทพมหานคร',
    });
    const proxFar = proximityToBranch(far, {
      branch_name_clean: 'Fashion Island (เขตมีนบุรี)',
      district_hint: 'มีนบุรี',
      province_hint: 'กรุงเทพมหานคร',
    });
    expect(proxNear.rank).toBe(0);
    expect(proxFar.rank).toBe(4);
  });

  it('puts district-matched candidates first per branch without extra AI', () => {
    const matches = [
      match({
        id: 1,
        full_name: 'คนดุสิต',
        district_name: 'ดุสิต',
        province_name: 'กรุงเทพมหานคร',
        location_label: 'ดุสิต, กรุงเทพมหานคร',
        tier: 'yellow',
        prescore: 1,
      }),
      match({
        id: 2,
        full_name: 'คนห้วยขวาง',
        district_name: 'ห้วยขวาง',
        province_name: 'กรุงเทพมหานคร',
        location_label: 'ห้วยขวาง, กรุงเทพมหานคร',
        tier: 'green',
        prescore: 2,
      }),
    ];
    const branches = [
      {
        branch_name_clean: 'จุดดุสิต',
        branch_name_raw: 'ดุสิต',
        requested_qty: 1,
        confidence: 80,
        district_hint: 'ดุสิต',
        province_hint: 'กรุงเทพมหานคร',
      },
      {
        branch_name_clean: 'จุดห้วยขวาง',
        branch_name_raw: 'ห้วยขวาง',
        requested_qty: 1,
        confidence: 80,
        district_hint: 'ห้วยขวาง',
        province_hint: 'กรุงเทพมหานคร',
      },
    ];
    const out = distributeIrecruitMatchesToBranches(matches, branches);
    expect(out[0].matches[0]?.full_name).toBe('คนดุสิต');
    expect(out[1].matches[0]?.full_name).toBe('คนห้วยขวาง');
    // คนที่อยู่สาขาอื่นชัดเจนถูกตัด/ดันลง
    expect(out[0].matches.find((m) => m.id === 2)).toBeUndefined();
  });
});
