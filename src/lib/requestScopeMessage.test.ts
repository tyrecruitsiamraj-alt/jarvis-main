import { describe, expect, it } from 'vitest';
import { requestScopeDenyMessage } from '@/lib/requestScopeMessage';

describe('requestScopeDenyMessage', () => {
  it('🔴 ไม่พบใบ ต้องไม่พูดเรื่องแผนก (เคสที่ทำให้ไล่ปัญหาผิดจุด)', () => {
    const msg = requestScopeDenyMessage({ reason: 'not_found' });
    expect(msg).toContain('ไม่พบใบขอ');
    expect(msg).not.toContain('แผนกอื่น');
    expect(msg).not.toContain('BU');
  });

  it('🔴 อยู่ BU อื่นจริง ต้องบอกทั้ง BU ของใบและของผู้ใช้', () => {
    const msg = requestScopeDenyMessage({
      reason: 'other_bu',
      requestBu: 'LBA',
      userBu: 'LBD',
      requestNo: 'LAO6907002',
    });
    expect(msg).toContain('LBA');
    expect(msg).toContain('LBD');
  });

  it('🔴 เตือนว่าเลขนำหน้าไม่ใช่ BU (ต้นเหตุที่คนเข้าใจผิดประจำ)', () => {
    const msg = requestScopeDenyMessage({
      reason: 'other_bu',
      requestBu: 'LBA',
      userBu: 'LBD',
      requestNo: 'LAO6907002',
    });
    expect(msg).toContain('LAO');
    expect(msg).toContain('ไม่ใช่ BU');
  });

  it('ไม่มีเลขที่ใบก็ยังบอก BU ได้ ไม่พัง', () => {
    const msg = requestScopeDenyMessage({ reason: 'other_bu', requestBu: 'DS', userBu: 'LM' });
    expect(msg).toContain('DS');
    expect(msg).toContain('LM');
    expect(msg).not.toContain('undefined');
  });

  it('BU ที่ไม่รู้ค่า ต้องขึ้น "ไม่ทราบ" ไม่ใช่ค่าว่าง/undefined', () => {
    const msg = requestScopeDenyMessage({ reason: 'other_bu', requestBu: null, userBu: '  ' });
    expect(msg).toContain('ไม่ทราบ');
    expect(msg).not.toContain('null');
    expect(msg).not.toContain('undefined');
  });

  it('บัญชียังไม่ได้ตั้งแผนก = บอกให้ไปหา admin', () => {
    const msg = requestScopeDenyMessage({ reason: 'no_department' });
    expect(msg).toContain('ยังไม่ได้ตั้งแผนก');
  });
});
