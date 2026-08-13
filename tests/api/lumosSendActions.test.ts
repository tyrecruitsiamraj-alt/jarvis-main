import { describe, expect, it } from 'vitest';
import {
  LUMOS_SEND_ACTION_KEYS,
  lumosSendActionStates,
  type LumosSendActionKey,
} from '../../src/lib/lumosSendActions';

function states(partial: Partial<Parameters<typeof lumosSendActionStates>[0]> = {}) {
  return lumosSendActionStates({
    allCount: 0,
    selectedCount: 0,
    sending: false,
    creatingBatch: false,
    holdingSelf: false,
    ...partial,
  });
}

const SELECTION_KEYS: LumosSendActionKey[] = ['sendSelected', 'queueSelected', 'holdSelf'];

describe('lumosSendActionStates — ปุ่มที่ใช้ไม่ได้ต้องบอกเหตุผท ห้ามหายไปเฉย ๆ', () => {
  it('invariant: disabled เมื่อไหร่ ต้องมี reason เสมอ (และกดได้เมื่อไหร่ ต้องไม่มี)', () => {
    const cases = [
      { allCount: 0, selectedCount: 0 },
      { allCount: 1, selectedCount: 1 },
      { allCount: 12, selectedCount: 0 },
      { allCount: 0, selectedCount: 3 },
      { allCount: 12, selectedCount: 3 },
      // ยอดใหญ่ต้องไม่ถูกปิดเงียบ ๆ ด้วยเพดานที่ไม่มีใครบอกผู้ใช้
      // (ข้อมูลจริง: คนเดียวอยู่ในผลแมทได้ถึง 113 ใบ ใบหนึ่งจึงมีคนส่งได้หลายร้อย)
      { allCount: 500, selectedCount: 300 },
      { allCount: 12, selectedCount: 3, sending: true },
      { allCount: 12, selectedCount: 3, creatingBatch: true },
      { allCount: 12, selectedCount: 3, holdingSelf: true },
    ];
    for (const c of cases) {
      const s = states(c);
      for (const key of LUMOS_SEND_ACTION_KEYS) {
        expect(s[key].disabled).toBe(s[key].reason !== null);
        if (s[key].disabled) expect(s[key].reason?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('เคสหัวใจ: มีคนแมท 12 คนแต่ยังไม่ติ๊กใคร → ส่งทั้งหมดกดได้ อีก 3 ปุ่มปิด', () => {
    const s = states({ allCount: 12, selectedCount: 0 });
    expect(s.sendAll.disabled).toBe(false);
    expect(s.sendAll.count).toBe(12);
    for (const key of SELECTION_KEYS) {
      expect(s[key].disabled).toBe(true);
      expect(s[key].reason).toContain('ติ๊กเลือก');
    }
  });

  it('ติ๊กแล้วแต่ทั้งใบไม่มีใครส่งได้ → 3 ปุ่มที่ใช้ยอดติ๊กยังกดได้ · ส่งทั้งหมดปิด', () => {
    const s = states({ allCount: 0, selectedCount: 2 });
    expect(s.sendAll.disabled).toBe(true);
    expect(s.sendAll.reason).toContain('ยังไม่มีคนที่ส่งได้');
    for (const key of SELECTION_KEYS) {
      expect(s[key].disabled).toBe(false);
      expect(s[key].count).toBe(2);
    }
  });

  it('ยอดของ sendAll ไม่ผูกกับการติ๊ก และอีก 3 ปุ่มไม่ผูกกับยอดทั้งใบ', () => {
    const s = states({ allCount: 12, selectedCount: 3 });
    expect(s.sendAll.count).toBe(12);
    for (const key of SELECTION_KEYS) expect(s[key].count).toBe(3);
  });

  it('กำลังทำงานอยู่ = ปิดทุกปุ่มพร้อมกัน กันยิงซ้อน (ปุ่มพวกนี้โทรหาคนจริง)', () => {
    for (const busy of ['sending', 'creatingBatch', 'holdingSelf'] as const) {
      const s = states({ allCount: 12, selectedCount: 3, [busy]: true });
      for (const key of LUMOS_SEND_ACTION_KEYS) {
        expect(s[key].disabled).toBe(true);
        expect(s[key].reason).toContain('กำลัง');
      }
    }
  });

  it('ยอดติดลบที่หลุดมาไม่โชว์เป็นเลขลบบนปุ่ม', () => {
    const s = states({ allCount: -5, selectedCount: -1 });
    expect(s.sendAll.count).toBe(0);
    expect(s.sendSelected.count).toBe(0);
    expect(s.sendAll.disabled).toBe(true);
  });
});
