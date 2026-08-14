import { describe, it, expect } from 'vitest';
import { aiCallFlowCells } from '../../src/lib/aiCallFlowCells';
import { EMPTY_FUNNEL, type CallFunnel } from '../../src/lib/callFunnelApi';

const funnel = (over: Partial<CallFunnel>): CallFunnel => ({ ...EMPTY_FUNNEL, ...over });

describe('aiCallFlowCells — 2 แถวช่องเดียวกัน (AI · คน)', () => {
  it('ลำดับช่องคงที่ 8 ช่อง — ทั้งสองแถวใช้ key เดียวกัน (คอลัมน์ต้องตรงกัน)', () => {
    const cells = aiCallFlowCells(EMPTY_FUNNEL);
    expect(cells.map((c) => c.key)).toEqual([
      'total', 'calling', 'connected', 'confirmed',
      'declined', 'no_answer', 'reschedule', 'retry',
    ]);
    // ทุกช่องมีป้ายไม่ว่าง
    for (const c of cells) expect(c.label.trim().length).toBeGreaterThan(0);
  });

  it('AI: ทั้งหมด=queuedActive (ไม่ใช่ queued) · กำลังโทร=delivered · รับสาย=connected', () => {
    const cells = aiCallFlowCells(
      funnel({ queued: 100, queuedActive: 70, delivered: 20, connected: 15 }),
    );
    const byKey = Object.fromEntries(cells.map((c) => [c.key, c.ai]));
    expect(byKey.total).toBe(70); // ⚠️ ไม่นับแถวยกเลิก
    expect(byKey.calling).toBe(20);
    expect(byKey.connected).toBe(15);
  });

  it('AI "ไม่รับสาย" รวม busy/ไม่ตอบ/โทรไม่สำเร็จ · ฝั่งคนมีแค่ no_answer ตรง ๆ', () => {
    const cells = aiCallFlowCells(
      funnel({
        byOutcome: { no_answer: 3, busy: 2, unresponsive: 1, failed: 1 },
        human: {
          total: 5, holding: 1, withResult: 4, toAi: 0,
          byOutcome: { no_answer: 2 },
        },
      }),
    );
    const c = cells.find((x) => x.key === 'no_answer')!;
    expect(c.ai).toBe(7); // 3+2+1+1
    expect(c.human).toBe(2); // ฝั่งคนไม่มี busy/failed
  });

  it('AI "รอ AI โทรใหม่"=retryScheduledState · ฝั่งคน=toAi (คืนให้ AI)', () => {
    const cells = aiCallFlowCells(
      funnel({
        retryScheduledState: 8,
        human: { total: 3, holding: 0, withResult: 3, toAi: 2, byOutcome: {} },
      }),
    );
    const c = cells.find((x) => x.key === 'retry')!;
    expect(c.ai).toBe(8);
    expect(c.human).toBe(2);
  });

  it('⚠️ ไม่มี human block → ฝั่งคนทุกช่องเป็น null (ขึ้นขีด ไม่ใช่ 0)', () => {
    const cells = aiCallFlowCells(funnel({ queuedActive: 5, human: undefined }));
    for (const c of cells) expect(c.human).toBeNull();
    // ฝั่ง AI ยังมีเลขปกติ
    expect(cells.find((c) => c.key === 'total')!.ai).toBe(5);
  });

  it('มี human block ที่ค่าเป็น 0 → ต้องเป็น 0 ไม่ใช่ null (ต่างจาก "ไม่มีข้อมูล")', () => {
    const cells = aiCallFlowCells(
      funnel({ human: { total: 0, holding: 0, withResult: 0, toAi: 0, byOutcome: {} } }),
    );
    for (const c of cells) expect(c.human).toBe(0);
  });
});
