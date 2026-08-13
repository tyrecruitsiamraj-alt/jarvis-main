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

describe('ติ๊กได้ทุกคนที่มีเบอร์ — ปุ่มค่อยแยกว่าใครทำอะไรได้ (เจ้าของทัก 13 ส.ค. 2569)', () => {
  const base = { sending: false, creatingBatch: false, holdingSelf: false };

  it('ติ๊ก 3 คน · ส่ง AI ได้ 1 (อีก 2 ส่งไปแล้ว) → ปุ่มส่งขึ้น 1 · ปุ่มเก็บยังเป็น 3', () => {
    const a = lumosSendActionStates({
      ...base,
      allCount: 5,
      selectedCount: 3,
      selectedSendable: 1,
      selectedHoldable: 3,
    });
    expect(a.sendSelected.count).toBe(1);
    expect(a.sendSelected.disabled).toBe(false);
    expect(a.queueSelected.count).toBe(1);
    expect(a.holdSelf.count).toBe(3);
    expect(a.holdSelf.disabled).toBe(false);
  });

  it('**ติ๊กคนที่ส่ง AI ไปแล้วล้วน → เก็บไปโทรเองยังกดได้** (เคสที่เจ้าของเจอ)', () => {
    const a = lumosSendActionStates({
      ...base,
      allCount: 0,
      selectedCount: 2,
      selectedSendable: 0,
      selectedHoldable: 2,
    });
    expect(a.sendSelected.disabled).toBe(true);
    expect(a.sendSelected.reason).toContain('ส่งเข้าคิว AI ไปแล้ว');
    expect(a.holdSelf.disabled).toBe(false);
    expect(a.holdSelf.count).toBe(2);
  });

  it('ติ๊กคนที่มีเจ้าหน้าที่ถืออยู่ล้วน → เก็บไปโทรเองปิด พร้อมเหตุผลที่ตรง', () => {
    const a = lumosSendActionStates({
      ...base,
      allCount: 3,
      selectedCount: 2,
      selectedSendable: 2,
      selectedHoldable: 0,
    });
    expect(a.holdSelf.disabled).toBe(true);
    expect(a.holdSelf.reason).toContain('เจ้าหน้าที่ถืออยู่');
    expect(a.sendSelected.disabled).toBe(false);
  });

  it('⚠️ ยังไม่ติ๊กใคร ต้องบอกให้ไปติ๊ก ไม่ใช่บอกว่า "ส่งไปแล้วทั้งหมด"', () => {
    const a = lumosSendActionStates({
      ...base,
      allCount: 4,
      selectedCount: 0,
      selectedSendable: 0,
      selectedHoldable: 0,
    });
    expect(a.sendSelected.reason).toContain('ติ๊กเลือก');
    expect(a.holdSelf.reason).toContain('ติ๊กเลือก');
  });

  it('ไม่ส่งยอดแยกมา = พฤติกรรมเดิมทุกอย่าง (ไม่ทำของเก่าพัง)', () => {
    const a = lumosSendActionStates({ ...base, allCount: 4, selectedCount: 2 });
    expect(a.sendSelected.count).toBe(2);
    expect(a.holdSelf.count).toBe(2);
    expect(a.sendSelected.disabled).toBe(false);
  });

  it('invariant เดิมยังอยู่: disabled === (reason !== null) ทุกปุ่มทุกเคส', () => {
    for (const sendable of [0, 1, 3]) {
      for (const holdable of [0, 2]) {
        const a = lumosSendActionStates({
          ...base,
          allCount: 3,
          selectedCount: 3,
          selectedSendable: sendable,
          selectedHoldable: holdable,
        });
        for (const k of LUMOS_SEND_ACTION_KEYS) {
          expect(a[k].disabled).toBe(a[k].reason !== null);
        }
      }
    }
  });
});
