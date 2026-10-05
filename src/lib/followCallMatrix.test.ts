/**
 * ตารางสายรวมก้อนเดียว (เจ้าของเคาะ 3 ต.ค. 2569)
 * 🔴 ด่าน: แต่ละแถว ไป + ไม่ไป + สรุปไม่ได้ + ยกเลิก = ทั้งหมด · แถวทุกสาย = สาย 1 + 2 + 3 ทุกคอลัมน์ ·
 *    ยกเลิกต้องโผล่ (เจ้าของ "ไม่งั้นจะงงว่าหายไปไหน 1") · ผลคนลงเอง/ผลปิดงานนับเหมือนการ์ดเดิม
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import {
  FOLLOW_MATRIX_COLS,
  FOLLOW_MATRIX_ROWS,
  buildFollowCallMatrix,
  followMatrixCol,
} from '@/lib/followCallMatrix';

let seq = 0;
const e = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: `m-${(seq += 1)}`,
    recipient_name: 'ทดสอบ',
    recipient_phone: '0890000001',
    topic: 'ติดตามเริ่มงาน',
    scheduled_at: '2026-10-04T08:00:00+07:00',
    cancelled: false,
    completed_at: null,
    outcome_code: null,
    call_status: 'pending',
    call_outcome: null,
    staff_call_outcome: null,
    call_of_day: 1,
    ...over,
  }) as FollowEntry;

const NOW = new Date('2026-10-04T06:00:00+07:00');

describe('followMatrixCol — สายหนึ่งสายตกช่องไหน', () => {
  it('ยืนยันว่าไป = ไป · ปฏิเสธ = ไม่ไป · ยังไม่โทร = รอโทร · ยกเลิก = ยกเลิก', () => {
    expect(followMatrixCol(e({ call_status: 'completed', call_outcome: 'confirmed' }), NOW)).toBe('went');
    expect(followMatrixCol(e({ call_status: 'completed', call_outcome: 'declined' }), NOW)).toBe('notWent');
    expect(followMatrixCol(e({}), NOW)).toBe('waiting');
    expect(followMatrixCol(e({ cancelled: true }), NOW)).toBe('cancelled');
  });

  /** เจ้าของ 4 ต.ค. 2569: "สรุปผลไม่ได้คือโทรไปแล้วแต่ไม่รู้ผลคือไปหรือไม่" — แยกจากรอโทร */
  it('🔴 สรุปไม่ได้ = โทรแล้วมีผลแต่ไม่รู้ว่าไปไหม · รอโทร = ยังไม่มีผลเลย', () => {
    // โทรแล้วไม่รับ = มีผล แต่ไม่รู้ว่าไป
    expect(followMatrixCol(e({ call_status: 'completed', call_outcome: 'no_answer' }), NOW)).toBe('unclear');
    // ปิดงานด้วย ลา / จำวันผิด = รู้ผลแต่ไม่ใช่ไป/ไม่ไป
    expect(followMatrixCol(e({ completed_at: '2026-10-04T09:00:00+07:00', outcome_code: 'leave' }), NOW)).toBe('unclear');
    // เลยเวลาแต่ผลยังไม่กลับ / ยังไม่ส่ง AI / คนยังไม่โทร = รอโทร
    expect(followMatrixCol(e({ scheduled_at: '2026-10-04T05:00:00+07:00' }), NOW)).toBe('waiting');
    expect(followMatrixCol(e({ call_status: null }), NOW)).toBe('waiting');
    expect(followMatrixCol(e({ call_status: null, call_mode: 'manual' }), NOW)).toBe('waiting');
  });

  it('ปิดงานแล้วนับตามผลปิดงาน · ผลที่คนลงเองก็นับ (ตัวเดียวกับการ์ดเดิม)', () => {
    expect(followMatrixCol(e({ completed_at: '2026-10-04T09:00:00+07:00', outcome_code: 'went' }), NOW)).toBe('went');
    // ยกเลิก = ถังยกเลิก · ไม่ไป = ถังไม่ไป (เจ้าของสั่ง 5 ต.ค. 2569)
    expect(followMatrixCol(e({ completed_at: '2026-10-04T09:00:00+07:00', outcome_code: 'cancelled' }), NOW)).toBe(
      'cancelled',
    );
    expect(followMatrixCol(e({ completed_at: '2026-10-04T09:00:00+07:00', outcome_code: 'no_show_start' }), NOW)).toBe(
      'notWent',
    );
    expect(followMatrixCol(e({ call_status: null, call_mode: 'manual', staff_call_outcome: 'confirmed' }), NOW)).toBe(
      'went',
    );
  });
});

describe('buildFollowCallMatrix', () => {
  const rows = [
    e({ call_of_day: 1, call_status: 'completed', call_outcome: 'confirmed' }),
    e({ call_of_day: 1 }),
    e({ call_of_day: 1, cancelled: true }),
    e({ call_of_day: 2, call_status: 'completed', call_outcome: 'declined' }),
    e({ call_of_day: 2 }),
    e({ call_of_day: 3 }),
  ];
  const m = buildFollowCallMatrix(rows, NOW);

  it('🔴 ทุกแถวบวกกันได้พอดี: ไป + ไม่ไป + สรุปไม่ได้ + รอโทร + ยกเลิก = ทั้งหมด', () => {
    for (const r of FOLLOW_MATRIX_ROWS) {
      const sum =
        m[r].went.length + m[r].notWent.length + m[r].unclear.length + m[r].waiting.length + m[r].cancelled.length;
      expect(sum, `แถว ${r}`).toBe(m[r].total.length);
    }
  });

  it('🔴 แถวทุกสาย = สาย 1 + สาย 2 + สาย 3 ทุกคอลัมน์', () => {
    for (const c of FOLLOW_MATRIX_COLS) {
      expect(m.all[c].length, `คอลัมน์ ${c}`).toBe(m[1][c].length + m[2][c].length + m[3][c].length);
    }
  });

  it('ตัวเลขจริงของชุดตัวอย่าง · ยกเลิกโผล่ ไม่หายไปเงียบ ๆ', () => {
    expect(m.all.total).toHaveLength(6);
    expect(m[1].total).toHaveLength(3);
    expect(m[1].went).toHaveLength(1);
    expect(m[1].cancelled).toHaveLength(1);
    expect(m[2].notWent).toHaveLength(1);
    expect(m[3].waiting).toHaveLength(1);
  });

  it('ว่าง = ทุกช่องเป็น 0 (ตารางไม่หาย)', () => {
    const empty = buildFollowCallMatrix([], NOW);
    for (const r of FOLLOW_MATRIX_ROWS) for (const c of FOLLOW_MATRIX_COLS) expect(empty[r][c]).toHaveLength(0);
  });
});

describe('คนกดจัดการแล้ว = ทุกสายของคนนั้นในวันนั้นย้ายไปถังที่กด (เจ้าของ Choice 5 ต.ค. 2569)', () => {
  it('AI ตอบว่าไม่ไป แต่คนกดว่าไปแล้ว ⇒ ทั้งสองสายของวันนั้นอยู่ถังไป · อีกวันไม่โดน · บวกกันยังลงตัว', () => {
    const rows = [
      e({ call_of_day: 1, call_status: 'completed', call_outcome: 'declined' }),
      e({ call_of_day: 2, completed_at: '2026-10-04T09:00:00+07:00', outcome_code: 'went' }),
      e({ call_of_day: 1, scheduled_at: '2026-10-05T08:00:00+07:00', call_status: 'completed', call_outcome: 'declined' }),
      // คนอื่นวันเดียวกัน ไม่โดนผลของคนแรก
      e({ recipient_phone: '0890000002', call_of_day: 1, call_status: 'completed', call_outcome: 'declined' }),
    ];
    const m = buildFollowCallMatrix(rows, NOW);
    expect(m.all.went).toHaveLength(2);
    expect(m.all.notWent).toHaveLength(2);
    const sum = (['went', 'notWent', 'unclear', 'waiting', 'cancelled'] as const).reduce((n, c) => n + m.all[c].length, 0);
    expect(sum).toBe(m.all.total.length);
  });

  it('กดยกเลิก ⇒ ถังยกเลิก · กดไม่ไป ⇒ ถังไม่ไป (ทั้งวัน)', () => {
    const cancelled = buildFollowCallMatrix(
      [
        e({ call_of_day: 1, call_status: 'completed', call_outcome: 'confirmed' }),
        e({ call_of_day: 2, completed_at: '2026-10-04T09:00:00+07:00', outcome_code: 'cancelled' }),
      ],
      NOW,
    );
    expect(cancelled.all.cancelled).toHaveLength(2);
    const notWent = buildFollowCallMatrix(
      [
        e({ call_of_day: 1, call_status: 'completed', call_outcome: 'confirmed' }),
        e({ call_of_day: 2, completed_at: '2026-10-04T09:00:00+07:00', outcome_code: 'no_show_start' }),
      ],
      NOW,
    );
    expect(notWent.all.notWent).toHaveLength(2);
  });
});
