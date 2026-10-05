/**
 * หน้าติดตาม 5 ต.ค. 2569:
 * - "ชื่อหน่วยงานหาย" บนมือถือ — คอลัมน์หน่วยงานเคยซ่อนต่ำกว่า lg · ตารางกลับเป็นแบบเดิมแล้ว ⇒ ต้องโชว์ทุกจอ
 * - ตัวกรอง "ใครเพิ่ม" (created_by_name) — "คนเพิ่มอยากดูแค่งานตัวเอง" · มีตัวเลือก "ของฉัน"
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FOLLOW_ADDER_NONE,
  filterFollowEntries,
  followAdderLabel,
  followAdderOptions,
  matchesFollowAdder,
} from '../../src/lib/followListFilter';
import type { FollowEntry } from '../../src/lib/followApi';

const e = (id: string, by: string | null) => ({ id, created_by_name: by, scheduled_at: '2026-10-05T01:00:00Z' }) as FollowEntry;

describe('ใครเพิ่ม', () => {
  const rows = [e('1', 'kunthida.b@siamraj.com'), e('2', 'kunthida.b@siamraj.com'), e('3', 'supaporn.s@siamraj.com'), e('4', null)];
  it('ตัวเลือก: ชื่อสั้น (ตัดโดเมน) + จำนวน · ไม่ระบุไว้ท้าย', () => {
    expect(followAdderOptions(rows)).toEqual([
      { value: 'kunthida.b@siamraj.com', label: 'kunthida.b', count: 2 },
      { value: 'supaporn.s@siamraj.com', label: 'supaporn.s', count: 1 },
      { value: FOLLOW_ADDER_NONE, label: 'ไม่ระบุคนเพิ่ม', count: 1 },
    ]);
    expect(followAdderLabel('x@y.com')).toBe('x');
  });
  it('กรองด้วยคนเพิ่ม · ไม่สนตัวพิมพ์ · ไม่ระบุ = แถวไม่มีชื่อ', () => {
    expect(filterFollowEntries(rows, { date: '', band: '', owner: 'KUNTHIDA.B@siamraj.com' }).map((r) => r.id)).toEqual(['1', '2']);
    expect(filterFollowEntries(rows, { date: '', band: '', owner: FOLLOW_ADDER_NONE }).map((r) => r.id)).toEqual(['4']);
    expect(matchesFollowAdder(e('5', 'a@b.com'), 'c@d.com')).toBe(false);
  });
  it('"ใครเพิ่ม" ยุบเข้า "เจ้าของงาน" = อีเมลคนเพิ่ม (5 ต.ค. 2569) + "ของฉัน" · ใช้กับตาราง/แผง/วันถัดไป', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/follow/FollowPage.tsx'), 'utf8');
    expect(src).not.toContain('ariaLabel="ใครเพิ่ม"');
    expect(src).toContain('ariaLabel="เจ้าของงาน"');
    expect(src).not.toContain('staffFilter');
    expect(src).toContain("{ value: 'me', label: `ของฉัน · ");
    expect(src.match(/owner: adderKey/g)?.length).toBe(2);
    expect(src).toContain('matchesFollowAdder(e, adderKey)');
  });
});

describe('หน่วยงานโชว์ทุกจอ', () => {
  it('คอลัมน์หน่วยงานของตารางรายวันไม่ซ่อนบนจอเล็ก', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/follow/FollowPlanningCalendar.tsx'), 'utf8');
    expect(src).toContain('<th className="min-w-[130px] px-3 py-2.5 text-[11px] font-medium">หน่วยงาน</th>');
    expect(src).not.toContain('font-medium lg:table-cell">หน่วยงาน');
  });
});

describe('เลขบนตัวกรองหน้าติดตาม = ชุดเดียวกับ "สายที่ · ทั้งหมด" (เจ้าของสั่ง 5 ต.ค. 2569)', () => {
  it('ใครโทร/เจ้าของงาน นับจากช่วงที่ปฏิทินดูอยู่ + เฉพาะสายที่มีเลขสาย ไม่ใช่ทั้งแท็บ', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/follow/FollowPage.tsx'), 'utf8');
    expect(src).toContain('countFollowCallers(panelByOwner.filter((e) => followRoundSlot(e) !== null))');
    expect(src).not.toContain('countFollowCallers(scopeItems)');
    expect(src).toContain('followAdderOptions(ownerBase)');
    expect(src).toContain("{ value: 'all', label: `ทุกคน · ${ownerBase.length.toLocaleString('th-TH')}` }");
  });
});
