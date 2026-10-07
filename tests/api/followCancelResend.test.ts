// @vitest-environment node
/**
 * 🔴 ส่งคำสั่งยกเลิกซ้ำให้ Lumos (เจ้าของ 7 ต.ค. 2569 · ปัญหา Lumos ข้อ 1 "ทศพร ยกเลิกแล้วยังโดนโทร" · Choice "ส่งคำสั่งยกเลิกซ้ำ")
 * วัดจริง 14 วัน: 13 สายที่ยกเลิกฝั่งเราแล้ว Lumos ยังโทร
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const cancel = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({ getLumosPushConfig: () => ({ url: 'x' }) }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({ cancelPushedReminderIgnoringMissing: (...a: unknown[]) => cancel(...a) }));

const mod = await import('../../api/_lib/followCancelResend');

beforeEach(() => {
  dbQuery.mockReset();
  cancel.mockReset();
});

describe('หาแผนที่ต้องส่งยกเลิกซ้ำ', () => {
  it('แถวยกเลิก · ยังไม่ถึงเวลา · ยังไม่เคยส่งซ้ำ · 🔴 แผนนั้นไม่มีสายที่ยังรอโทร', () => {
    const sql = mod.cancelResendSql();
    expect(sql).toContain('e.cancelled_at is not null');
    expect(sql).toContain('e.scheduled_at > now()');
    expect(sql).toContain("x.status = 'cancelled'");
    expect(sql).toContain(`<> '${mod.CANCEL_RESENT_STATE}'`);
    expect(sql).toContain("y.status = 'pending'");
  });
});

describe('ส่งแล้วจด ไม่ส่งซ้ำ · ล้ม = ลองรอบหน้า', () => {
  it('ส่งสำเร็จ = จด push_state · ตัวที่ล้มไม่จด', async () => {
    dbQuery.mockImplementation(async (sql: string) =>
      sql.includes('select distinct') ? { rows: [{ ref: 'follow-a' }, { ref: 'follow-b' }] } : { rows: [] },
    );
    cancel.mockImplementation(async (ref: string) => {
      if (ref === 'follow-b') throw new Error('500');
    });
    const r = await mod.resendFollowCancels();
    expect(r).toEqual({ sent: 1, failed: 1 });
    const marks = dbQuery.mock.calls.filter((c) => String(c[0]).includes('set push_state'));
    expect(marks.map((c) => c[1])).toEqual([['follow-a', mod.CANCEL_RESENT_STATE]]);
  });
  it('ผูกกับตัวส่งซ้ำงานติดตาม', () => {
    expect(readFileSync(new URL('../../api/_lib/followPushRetryWorker.ts', import.meta.url), 'utf8')).toContain('await resendFollowCancels();');
  });
});
