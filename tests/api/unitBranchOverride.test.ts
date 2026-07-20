import { describe, expect, it } from 'vitest';
import { cleanFieldOverrides } from '../../api/_lib/siamrajUnitNotes.js';

describe('unit branch override', () => {
  it('keeps editable address and confirmed coordinates for each branch', () => {
    const result = cleanFieldOverrides({
      branches: [
        {
          branch_id: 'branch-1',
          branch_name_clean: 'ถ.สามเสน เขตดุสิต',
          address_raw: 'ถ.สามเสน เขตดุสิต กรุงเทพฯ',
          road: 'สามเสน',
          subdistrict: 'ถนนนครไชยศรี',
          district_hint: 'ดุสิต',
          province_hint: 'กรุงเทพมหานคร',
          postal_code: '10300',
          requested_qty: 2,
          lat: 13.781,
          lng: 100.516,
          geocode_status: 'confirmed',
        },
      ],
    });

    expect(result?.branches?.[0]).toMatchObject({
      branch_id: 'branch-1',
      road: 'สามเสน',
      district_hint: 'ดุสิต',
      requested_qty: 2,
      lat: 13.781,
      lng: 100.516,
      geocode_status: 'confirmed',
    });
  });

  it('marks unsupported geocode status as unverified', () => {
    const result = cleanFieldOverrides({
      branches: [
        {
          branch_name_clean: 'สิงห์คอมเพล็กซ์ เขตห้วยขวาง',
          requested_qty: 1,
          geocode_status: 'trusted-without-review',
        },
      ],
    });

    expect(result?.branches?.[0].geocode_status).toBe('unverified');
  });
});
