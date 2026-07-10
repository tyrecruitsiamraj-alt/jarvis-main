import { describe, it, expect } from 'vitest';
import {
  extractRequestNoDigitSuffix,
  normalizeSiamrajRequestNoForDisplay,
  pickBestRequestNoCandidate,
  requestNoMatchesLookup,
} from '../../api/_lib/siamrajRequestNo.js';

describe('siamrajRequestNo lookup', () => {
  it('extracts digit suffix from request numbers', () => {
    expect(extractRequestNoDigitSuffix('LBM6905015')).toBe('6905015');
    expect(extractRequestNoDigitSuffix('lm6905015')).toBe('6905015');
  });

  it('matches abbreviated prefixes with the same digit suffix', () => {
    expect(requestNoMatchesLookup('lm6905015', 'LBM6905015')).toBe(true);
    expect(requestNoMatchesLookup('lbm6905015', 'LBM6905015')).toBe(true);
    expect(requestNoMatchesLookup('lm6905016', 'LBM6905015')).toBe(false);
  });

  it('prefers open partial requests when suffix matches multiple rows', () => {
    const best = pickBestRequestNoCandidate(
      [
        {
          request_no: 'DSO6905015',
          status: 'A',
          is_stop: 'N',
          stop_no: null,
          is_inform_all: 'Y',
          request_qty: 1,
          inform_qty: 1,
          effective_inform_qty: 1,
        },
        {
          request_no: 'LBM6905015',
          status: 'A',
          is_stop: 'N',
          stop_no: null,
          is_inform_all: 'P',
          request_qty: 4,
          inform_qty: 3,
          effective_inform_qty: 3,
        },
      ],
      'lm6905015',
    );
    expect(best?.request_no).toBe('LBM6905015');
  });

  it('normalizes digit-only request numbers using site_code prefix', () => {
    expect(
      normalizeSiamrajRequestNoForDisplay('6907001', {
        siteCode: '67LBDL0324',
        departmentCode: 'LBD',
      }),
    ).toBe('LBD6907001');
    expect(normalizeSiamrajRequestNoForDisplay('OPL6907001', { siteCode: '67LBDL0230' })).toBe(
      'OPL6907001',
    );
  });

  it('falls back to department code when site_code has no prefix', () => {
    expect(
      normalizeSiamrajRequestNoForDisplay('6907001', { departmentCode: 'LBA' }),
    ).toBe('LBA6907001');
  });
});
