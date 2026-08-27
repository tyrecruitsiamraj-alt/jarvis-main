/**
 * ถังตามเวลานัดของหน้าติดตาม — ต้องตอบเท่ากับ `FOLLOW_SQL` ใน office-floor
 * (เลขชุดนี้คือเลขที่หน้าแรกใช้พาดหัวส่งคนมาหน้า Follow — เพี้ยนเมื่อไหร่คนกดมาแล้วหาของไม่เจอ)
 */
import { describe, expect, it } from 'vitest';
import { followScheduleCounts } from '@/lib/followSchedule';
import type { FollowEntry } from '@/lib/followApi';

const NOW = new Date('2569-08-26T14:00:00+07:00'.replace('2569', '2026'));

/** แถวจำลองแบบย่อ — ใส่เฉพาะช่องที่ตรรกะนี้อ่านจริง */
function entry(over: Partial<FollowEntry>): FollowEntry {
  return {
    id: 'x',
    recipient_name: 'ทดสอบ',
    recipient_phone: '+66900000000',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: null,
    created_by_name: null,
    created_at: null,
    cancelled: false,
    call_status: null,
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...over,
  } as FollowEntry;
}

const at = (iso: string) => new Date(iso).toISOString();

describe('followScheduleCounts', () => {
  it('นัดวันนี้นับทั้งที่ผ่านเวลาแล้วและที่ยังไม่ถึงเวลา', () => {
    const c = followScheduleCounts(
      [
        entry({ scheduled_at: at('2026-08-26T09:00:00+07:00') }), // เช้าวันนี้ (เลยเวลาแล้ว)
        entry({ scheduled_at: at('2026-08-26T18:00:00+07:00') }), // เย็นวันนี้ (ยังไม่ถึง)
      ],
      NOW,
    );
    expect(c.today).toBe(2);
  });

  it('เลยเวลานัด = ผ่านเวลาแล้วและยังไม่มีผลกลับ — มีผลแล้วต้องหลุดออกจากถัง', () => {
    const c = followScheduleCounts(
      [
        entry({ scheduled_at: at('2026-08-26T09:00:00+07:00') }),
        entry({ scheduled_at: at('2026-08-25T09:00:00+07:00') }),
        entry({ scheduled_at: at('2026-08-25T09:00:00+07:00'), call_outcome: 'confirmed' }),
      ],
      NOW,
    );
    expect(c.pastDue).toBe(2);
  });

  it('ยกเลิกแล้วไม่นับสักถัง — กติกาแม่: ห้ามนับที่ถูกยกเลิก', () => {
    const c = followScheduleCounts(
      [
        entry({ scheduled_at: at('2026-08-26T09:00:00+07:00'), cancelled: true }),
        entry({ scheduled_at: at('2026-08-27T09:00:00+07:00'), cancelled: true }),
      ],
      NOW,
    );
    expect(c).toEqual({ today: 0, pastDue: 0, upcoming: 0 });
  });

  it('ไม่ได้ตั้งเวลานัด = ไม่ตกถังไหนเลย ห้ามเดาว่าเป็นวันนี้', () => {
    const c = followScheduleCounts([entry({ scheduled_at: null })], NOW);
    expect(c).toEqual({ today: 0, pastDue: 0, upcoming: 0 });
  });

  it('นัดล่วงหน้า = เวลานัดเป็นอนาคต (วันพรุ่งนี้ไม่นับเป็นนัดวันนี้)', () => {
    const c = followScheduleCounts(
      [entry({ scheduled_at: at('2026-08-27T09:00:00+07:00') })],
      NOW,
    );
    expect(c).toEqual({ today: 0, pastDue: 0, upcoming: 1 });
  });

  it('นัดเช้าวันนี้ที่เลยเวลาแล้ว ถูกนับทั้ง today และ pastDue โดยตั้งใจ (ตรงกับ SQL เดิม)', () => {
    const c = followScheduleCounts(
      [entry({ scheduled_at: at('2026-08-26T09:00:00+07:00') })],
      NOW,
    );
    expect(c.today).toBe(1);
    expect(c.pastDue).toBe(1);
  });

  it('วันที่พังไม่ทำให้ทั้งก้อนล้ม — แถวนั้นตกไปเฉย ๆ', () => {
    const c = followScheduleCounts(
      [
        entry({ scheduled_at: 'ไม่ใช่วันที่' }),
        entry({ scheduled_at: at('2026-08-27T09:00:00+07:00') }),
      ],
      NOW,
    );
    expect(c.upcoming).toBe(1);
  });
});
