// @vitest-environment node
/**
 * ═══ หน้าติดตามโฉมใหม่ "วันนี้ต้องตามใครบ้าง" (21 ก.ย. 2569) ═══
 *
 * เจ้าของส่งแบบ UI มาแล้วกำชับว่า *"ฉันกลัวนายทำ Function ต่าง ๆ หาย"*
 * เทสต์ชุดนี้จึงคุม **ของที่ห้ามหาย** ไม่ใช่แค่ว่าโค้ดรันผ่าน
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. หนึ่งแถว = หนึ่งคน (ไม่ใช่หนึ่งรอบ)
 * 2. สายที่ **ส่งไม่ออก** ต้องเด่นที่สุด — ดังกว่าผลโทรและกว่าของเลยเวลา
 * 3. สามช่องแรกบวกกันได้ยอด "งานที่ยังไม่จบ" เป๊ะ
 * 4. ปิดงานแล้วต้องไม่ปนอยู่ในคิวงานวันนี้ แต่ต้องยังเปิดดูได้
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '../../src/lib/followApi.js';
import {
  buildWorkbenchRows,
  countWorkbenchLanes,
  countWorkbenchOwners,
  filterWorkbenchRows,
} from '../../src/lib/followWorkbench.js';

const NOW = new Date('2026-09-21T10:00:00+07:00');
const at = (h: number, m = 0) =>
  new Date(`2026-09-21T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`).toISOString();

let seq = 0;
function entry(over: Partial<FollowEntry> = {}): FollowEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    recipient_name: 'สมชาย ใจดี',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: at(9),
    created_by_name: 'คุณเมย์',
    created_at: '2026-09-20T10:00:00+07:00',
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    call_reply: null,
    dispatch_state: 'queued',
    ...over,
  } as FollowEntry;
}

describe('หนึ่งแถว = หนึ่งคน', () => {
  it('คนเดียวสามรอบ ⇒ แถวเดียว', () => {
    const rows = buildWorkbenchRows(
      [entry({ scheduled_at: at(9) }), entry({ scheduled_at: at(11) }), entry({ scheduled_at: at(13) })],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].group.rounds).toHaveLength(3);
  });

  it('คนละเบอร์ ⇒ คนละแถว', () => {
    const rows = buildWorkbenchRows(
      [entry({ recipient_phone: '0811111111' }), entry({ recipient_phone: '0822222222' })],
      NOW,
    );
    expect(rows).toHaveLength(2);
  });
});

describe('🔴 สายที่ส่งไม่ออกต้องเด่นที่สุด', () => {
  it('เบอร์อยู่ในบัญชีห้ามโทร ⇒ ด่วน + บอกเหตุตรง ๆ ไม่ใช่ "รอ AI โทร"', () => {
    const [row] = buildWorkbenchRows(
      [entry({ scheduled_at: at(15), dispatch_state: 'suppressed', call_status: null })],
      NOW,
    );
    expect(row.lane).toBe('urgent');
    expect(row.dispatchIssue?.label).toContain('บัญชีห้ามโทร');
    expect(row.action.needsHuman).toBe(true);
  });

  it('ส่งไม่ถึง Lumos ⇒ ด่วน แม้เวลานัดยังไม่ถึง', () => {
    const [row] = buildWorkbenchRows(
      [entry({ scheduled_at: at(23), dispatch_state: 'push_failed', call_status: 'pending' })],
      NOW,
    );
    expect(row.lane).toBe('urgent');
  });

  it('ตั้งใจให้คนโทรเอง ⇒ **ไม่ใช่** ปัญหา (ห้ามขึ้นเตือนแดง)', () => {
    const [row] = buildWorkbenchRows(
      [entry({ scheduled_at: at(15), dispatch_state: 'manual', call_status: null, call_mode: 'manual' })],
      NOW,
    );
    expect(row.dispatchIssue).toBeNull();
    expect(row.ownerKind).toBe('staff');
  });
});

describe('ช่องของแต่ละแถว', () => {
  it('เลยเวลานัดแล้วยังไม่มีผล ⇒ ด่วน + บอกว่าค้างกี่นาที', () => {
    const [row] = buildWorkbenchRows([entry({ scheduled_at: at(9, 42) })], NOW);
    expect(row.lane).toBe('urgent');
    expect(row.lateMinutes).toBe(18);
  });

  it('ตอบว่าไป ⇒ ยืนยันแล้ว (ยังไม่ปิดงาน)', () => {
    const [row] = buildWorkbenchRows(
      [
        entry({
          scheduled_at: at(9),
          call_status: 'completed',
          call_outcome: 'acknowledged',
          call_summary: 'ผู้รับสายยืนยันว่าเตรียมตัวเรียบร้อยแล้ว',
        }),
      ],
      NOW,
    );
    expect(row.result).toBe('said_yes');
    expect(row.lane).toBe('confirmed');
    expect(row.action.needsHuman).toBe(false);
  });

  it('ตอบว่าไม่ไป ⇒ ด่วน + สั่งให้หาคนแทน', () => {
    const [row] = buildWorkbenchRows(
      [
        entry({
          scheduled_at: at(9),
          call_status: 'completed',
          call_outcome: 'acknowledged',
          call_summary: 'แจ้งว่ายังไม่ได้ไปที่หน่วยงาน',
        }),
      ],
      NOW,
    );
    expect(row.lane).toBe('urgent');
    expect(row.action.text).toContain('หาคนแทน');
  });

  it('ยังไม่ถึงเวลานัด ⇒ รอผล', () => {
    const [row] = buildWorkbenchRows([entry({ scheduled_at: at(16) })], NOW);
    expect(row.lane).toBe('waiting');
  });

  it('ปิดงานแล้ว ⇒ ออกจากคิวงานวันนี้', () => {
    const [row] = buildWorkbenchRows(
      [entry({ completed_at: '2026-09-21T09:30:00+07:00', outcome_code: 'arrived' })],
      NOW,
    );
    expect(row.lane).toBe('closed');
  });

  it('ยกเลิกทุกรอบ ⇒ ออกจากคิวงานวันนี้เช่นกัน', () => {
    const [row] = buildWorkbenchRows([entry({ cancelled: true })], NOW);
    expect(row.lane).toBe('closed');
  });
});

describe('ตัวเลขต้องบวกกันได้', () => {
  const rows = buildWorkbenchRows(
    [
      entry({ recipient_phone: '0811111111', scheduled_at: at(9) }), // เลยเวลา → ด่วน
      entry({ recipient_phone: '0822222222', scheduled_at: at(16) }), // รอผล
      entry({
        recipient_phone: '0833333333',
        call_status: 'completed',
        call_outcome: 'acknowledged',
        call_summary: 'ยืนยันว่าเตรียมตัวเรียบร้อยแล้ว',
      }), // ยืนยันแล้ว
      entry({ recipient_phone: '0844444444', completed_at: 'x', outcome_code: 'arrived' }), // ปิดแล้ว
    ],
    NOW,
  );

  it('🔴 ด่วน + รอผล + ยืนยันแล้ว = งานที่ยังไม่จบ เป๊ะ', () => {
    const c = countWorkbenchLanes(rows);
    expect(c.urgent + c.waiting + c.confirmed).toBe(c.open);
    expect(c).toMatchObject({ urgent: 1, waiting: 1, confirmed: 1, closed: 1, open: 3 });
  });

  it('ตัวกรองเจ้าของนับเฉพาะงานที่ยังเปิดอยู่ และบวกกันได้ยอดรวม', () => {
    const o = countWorkbenchOwners(rows);
    expect(o.ai + o.staff + o.none).toBe(o.all);
    expect(o.all).toBe(3);
  });
});

describe('ตัวกรอง + ค้นหา', () => {
  const rows = buildWorkbenchRows(
    [
      entry({ recipient_phone: '0811111111', recipient_name: 'สมชาย ใจดี', unit_name: 'บางชัน' }),
      entry({ recipient_phone: '0822222222', recipient_name: 'วิชัย แสงทอง', unit_name: 'ลาดกระบัง' }),
      entry({ recipient_phone: '0833333333', completed_at: 'x', outcome_code: 'arrived' }),
    ],
    NOW,
  );

  it('มุมมอง "ยังไม่จบ" ต้องไม่มีของที่ปิดแล้วปน', () => {
    const out = filterWorkbenchRows(rows, { lane: 'open', owner: 'all', q: '' });
    expect(out.every((r) => r.lane !== 'closed')).toBe(true);
    expect(out).toHaveLength(2);
  });

  it('ค้นด้วยเบอร์ที่มีขีดคั่นก็ต้องเจอ', () => {
    const out = filterWorkbenchRows(rows, { lane: 'open', owner: 'all', q: '082-222-2222' });
    expect(out).toHaveLength(1);
    expect(out[0].group.name).toBe('วิชัย แสงทอง');
  });

  it('ค้นด้วยหน่วยงานก็ต้องเจอ', () => {
    const out = filterWorkbenchRows(rows, { lane: 'open', owner: 'all', q: 'ลาดกระบัง' });
    expect(out).toHaveLength(1);
  });
});

describe('การเรียง', () => {
  it('🔴 ด่วนขึ้นก่อนเสมอ และค้างนานสุดอยู่บนสุด', () => {
    const rows = buildWorkbenchRows(
      [
        entry({ recipient_phone: '0811111111', scheduled_at: at(16) }), // รอผล
        entry({ recipient_phone: '0822222222', scheduled_at: at(9, 50) }), // ค้าง 10 นาที
        entry({ recipient_phone: '0833333333', scheduled_at: at(8) }), // ค้าง 120 นาที
      ],
      NOW,
    );
    expect(rows.map((r) => r.group.phone)).toEqual(['0833333333', '0822222222', '0811111111']);
  });
});
