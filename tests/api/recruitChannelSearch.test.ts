// @vitest-environment node
/**
 * ค้นหา / แบ่งหน้าช่องทางรับสมัคร
 *
 * ทำไมต้องมี: ช่องทางที่ยกมาจาก iRecruit มี **4,390 ช่อง** (หลัก 43 · ย่อย 4,347)
 * และพ่อชื่อ "Facebook Group" ตัวเดียวมีลูก 4,187 — ของเดิมส่งทรีเต็มทุกครั้งที่เปิด dialog
 * เทสต์ชุดนี้คุมว่า "ไม่มีทางไหนที่หลุดไปดึงทั้งก้อน"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUniqueViolation: () => false }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (name: string) => name }));

import { dbQuery } from '../../api/_lib/postgres.js';
import {
  RECRUIT_CHANNEL_PAGE_MAX,
  listRecruitChannelChildren,
  listRecruitChannelRoots,
  searchRecruitChannels,
} from '../../api/_lib/recruitPostings.js';

const PARENT = '11111111-1111-4111-8111-111111111111';

function sqlOf(i: number): string {
  return String(vi.mocked(dbQuery).mock.calls[i]?.[0] ?? '');
}
function paramsOf(i: number): unknown[] {
  return (vi.mocked(dbQuery).mock.calls[i]?.[1] ?? []) as unknown[];
}

beforeEach(() => vi.mocked(dbQuery).mockReset());

describe('ค้นหาช่องทาง', () => {
  it('คำค้นว่าง = ไม่ยิงฐานเลย (กันเผลอดึงทั้งตาราง)', async () => {
    expect(await searchRecruitChannels('')).toEqual([]);
    expect(await searchRecruitChannels('   ')).toEqual([]);
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('ค้นทั้งชื่อช่องย่อยและชื่อช่องหลัก — พิมพ์ "Facebook" ต้องเจอกลุ่มที่อยู่ใต้ Facebook Group', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await searchRecruitChannels('Facebook');
    expect(sqlOf(0)).toContain(String.raw`c.name ILIKE $1 ESCAPE '\' OR p.name ILIKE $1 ESCAPE '\'`);
    expect(paramsOf(0)[0]).toBe('%Facebook%');
  });

  it("🔴 `_` กับ `%` ในคำค้นต้องถูก escape — ไม่งั้นพิมพ์ `__test__` ได้แถวที่มีแค่ 'test' ติดมา", async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await searchRecruitChannels('__test__');
    expect(paramsOf(0)[0]).toBe('%\\_\\_test\\_\\_%');
    expect(sqlOf(0)).toContain(String.raw`ESCAPE '\'`);

    vi.mocked(dbQuery).mockReset();
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await searchRecruitChannels('50%');
    expect(paramsOf(0)[0]).toBe('%50\\%%');
  });

  it('ไม่รวมช่องที่ปิดอยู่ตามค่าเริ่มต้น · ขอ all=1 ถึงจะรวม', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await searchRecruitChannels('line');
    expect(sqlOf(0)).toContain('c.is_active = true');

    vi.mocked(dbQuery).mockReset();
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await searchRecruitChannels('line', { includeInactive: true });
    expect(sqlOf(0)).not.toContain('c.is_active = true');
  });

  it('เพดานผลลัพธ์ — ขอเกินเพดานถูกหั่นลง · ค่าพิลึกถอยไปค่าเริ่มต้น', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await searchRecruitChannels('a', { limit: 99999 });
    expect(paramsOf(0)[1]).toBe(RECRUIT_CHANNEL_PAGE_MAX);

    vi.mocked(dbQuery).mockReset();
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await searchRecruitChannels('a', { limit: -5 });
    expect(paramsOf(0)[1]).toBe(50);
  });

  it('คืนชื่อพ่อมาด้วย — ช่องย่อยชื่อซ้ำข้ามพ่อได้ ป้ายจึงต้องมีพ่อกำกับ', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [
        {
          id: 'c1',
          parent_id: PARENT,
          name: 'หางานขับรถ',
          sort_order: 100,
          is_active: true,
          parent_name: 'Facebook Group',
        },
      ],
    });
    expect(await searchRecruitChannels('ขับรถ')).toEqual([
      {
        id: 'c1',
        name: 'หางานขับรถ',
        parentId: PARENT,
        parentName: 'Facebook Group',
        isActive: true,
      },
    ]);
  });
});

describe('ช่องทางหลัก + จำนวนลูก', () => {
  it('ดึงเฉพาะแถวที่ไม่มีพ่อ และนับลูกด้วย subquery (ไม่ใช่ดึงลูกมานับเอง)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [
        { id: PARENT, parent_id: null, name: 'Facebook Group', sort_order: 100, is_active: true, child_count: '4187' },
      ],
    });
    const roots = await listRecruitChannelRoots();
    expect(sqlOf(0)).toContain('c.parent_id IS NULL');
    expect(sqlOf(0)).toContain('SELECT count(*)');
    expect(roots[0].childCount).toBe(4187);
    expect(roots[0].children).toBeUndefined();
  });
});

describe('ช่องทางรองของพ่อหนึ่งตัว', () => {
  it('มี LIMIT/OFFSET เสมอ และคืน total มาด้วย', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ n: '4187' }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await listRecruitChannelChildren(PARENT, { limit: 50, offset: 100 });
    expect(sqlOf(1)).toContain('LIMIT');
    expect(sqlOf(1)).toContain('OFFSET');
    expect(paramsOf(1)).toEqual([PARENT, 50, 100]);
    expect(res.total).toBe(4187);
  });

  it('total นับหลังกรองคำค้น ไม่ใช่จำนวนลูกทั้งหมด (ไม่งั้นบอกผู้ใช้ผิดว่าเหลืออีกเยอะ)', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ n: '3' }] })
      .mockResolvedValueOnce({ rows: [] });
    await listRecruitChannelChildren(PARENT, { q: 'ขับรถ' });
    expect(sqlOf(0)).toContain('name ILIKE');
    expect(paramsOf(0)).toEqual([PARENT, '%ขับรถ%']);
  });

  it('offset ติดลบ/ไม่ใช่ตัวเลข = 0 (กัน OFFSET เพี้ยนจน SQL ล้ม)', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ n: '0' }] })
      .mockResolvedValueOnce({ rows: [] });
    await listRecruitChannelChildren(PARENT, { offset: -20 });
    expect(paramsOf(1)[2]).toBe(0);
  });
});
