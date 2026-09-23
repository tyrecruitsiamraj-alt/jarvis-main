import { describe, it, expect } from 'vitest';
import { unitRequestNoteKey, isPrequestKey } from '../../src/lib/siamrajUnitRequestsApi';
import type { JobRequest } from '../../src/types';

/**
 * 🔴 **ใบขอล่วงหน้าต้องมีคีย์ของตัวเอง** (เจ้าของแจ้ง 23 ก.ย. 2569:
 * *"ใบขอที่เลขเหมือนกันทำไมแก้แล้วมันดันซ้ำกัน แก้ใบไหนก็ควรขึ้นแค่ของใบนั้นสิ"*)
 *
 * วัดจาก ERP จริง 23 ก.ย.: ใบล่วงหน้า 42 ใบ **ชนเลขกับใบขอจริง 27 ใบ (64%)**
 * ⇒ คีย์ด้วยเลขเปล่า = สองใบใช้แถวเดียวกัน แก้ใบหนึ่งขึ้นอีกใบ
 */
const job = (over: Partial<JobRequest>): JobRequest => ({ id: '', ...over }) as JobRequest;

describe('unitRequestNoteKey', () => {
  it('ใบขอล่วงหน้า = ใช้ id เต็มเป็นคีย์ (ไม่ใช่เลขที่ใบ)', () => {
    expect(
      unitRequestNoteKey(job({ id: 'siamraj-pre:OPL6909001', request_no: 'OPL6909001', externalId: 'OPL6909001' })),
    ).toBe('siamraj-pre:OPL6909001');
  });

  it('ใบขอจริงที่เลขเดียวกัน = ยังใช้เลขเปล่าเหมือนเดิม (ของเก่า 1,990+ แถวต้องไม่หาย)', () => {
    expect(
      unitRequestNoteKey(job({ id: 'siamraj-sql:OPL6909001', request_no: 'OPL6909001', externalId: 'OPL6909001' })),
    ).toBe('OPL6909001');
  });

  it('สองใบที่เลขซ้ำกันต้องได้คนละคีย์ — นี่คือแกนของบั๊ก', () => {
    const real = unitRequestNoteKey(job({ id: 'siamraj-sql:OPL6909001', request_no: 'OPL6909001' }));
    const pre = unitRequestNoteKey(job({ id: 'siamraj-pre:OPL6909001', request_no: 'OPL6909001' }));
    expect(real).not.toBe(pre);
  });

  it('request_no มาก่อน externalId เสมอ (กติกา 22 ก.ย. — เขียนคีย์หนึ่งอ่านอีกคีย์ = บันทึกแล้วหาย)', () => {
    expect(unitRequestNoteKey(job({ id: 'siamraj-sql:6907001', request_no: 'SQ6907001', externalId: '6907001' }))).toBe(
      'SQ6907001',
    );
  });

  it('ไม่มี request_no/externalId = ตกไปใช้ id', () => {
    expect(unitRequestNoteKey(job({ id: 'siamraj-sql:X1' }))).toBe('siamraj-sql:X1');
  });
});

describe('isPrequestKey', () => {
  it('รู้จักคีย์ของใบล่วงหน้า', () => {
    expect(isPrequestKey('siamraj-pre:OPL6909001')).toBe(true);
    expect(isPrequestKey('OPL6909001')).toBe(false);
    expect(isPrequestKey('siamraj-sql:OPL6909001')).toBe(false);
    expect(isPrequestKey('')).toBe(false);
  });
});
