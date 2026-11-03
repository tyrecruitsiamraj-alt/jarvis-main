/**
 * รายชื่อรอลงงาน = บอร์ดของ ERP ช่วง 1 (เจ้าของ 2 พ.ย. 2569 "เอาแบบนี้ เริ่มช่วง 1 เลย")
 * อ่านอย่างเดียว · แถบซ้ายเดือน → วัน · ตัวกรอง · ช่องว่างไม่หาย · หน้ารายชื่อเดิมเป็นทางถอย
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_ERP_BOARD_FILTERS,
  NO_ASSIGNEE,
  NO_STEP,
  assigneeOptions,
  cardsByColumn,
  erpCardPosition,
  filterErpBoardCards,
  groupDaysByMonth,
  tagTone,
  thDate,
  type ErpBoardCard,
} from '@/lib/erpBoard';

const card = (p: Partial<ErpBoardCard>): ErpBoardCard => ({
  cardId: 3320,
  columnId: 3,
  itemId: 162,
  title: 'ธนวัฒน์ คณะปัญญา',
  position: 'ขับรถ',
  jobType: 'รถผู้บริหารคนไทย',
  site: 'งานคุณปุ๊ก ฐาน18000',
  mobile: '081-234-5678',
  tags: ['นายไทย', 'รถตู้'],
  tagIds: [2, 3],
  stepId: 1,
  step: 'ส่งประวัติพนักงาน',
  outcome: null,
  scheduledAt: null,
  checklistDone: 8,
  checkedItemIds: [1, 2, 3, 4, 5, 6, 7, 8],
  requestNos: ['OPL6909092'],
  comments: 2,
  lastComment: 'ยิมจ๊อป',
  calls: 1,
  assignees: ['น้ำหวาน'],
  assigneeIds: ['1460500229184'],
  createdAt: '2026-11-02T13:13:00Z',
  lastActivityAt: '2026-11-02T16:48:00Z',
  ...p,
});

describe('แถบซ้ายแบบ ERP เดือน → วัน', () => {
  const days = [
    { itemId: 150, date: '2026-10-30', label: '30-10-2569', cards: 10 },
    { itemId: 162, date: '2026-11-02', label: '02-11-2569', cards: 29 },
    { itemId: 151, date: '2026-10-31', label: '31-10-2569', cards: 5 },
  ];
  it('เดือนใหม่ก่อน · วันใหม่ก่อน · เลขเดือน = ผลรวมวัน · ช่วงวันครบเดือน', () => {
    const m = groupDaysByMonth(days);
    expect(m.map((x) => x.label)).toEqual(['พฤศจิกายน 2569', 'ตุลาคม 2569']);
    expect(m[1].cards).toBe(15);
    expect(m[1].days.map((d) => d.itemId)).toEqual([151, 150]);
    expect([m[1].from, m[1].to]).toEqual(['2026-10-01', '2026-10-31']);
    expect(groupDaysByMonth([{ itemId: 1, date: '2028-02-03', label: '', cards: 1 }])[0].to).toBe('2028-02-29');
  });
});

describe('ตัวกรอง', () => {
  const a = card({});
  const b = card({ cardId: 2, title: 'สมชาย ใจดี', mobile: '0899999999', tags: ['Online'], step: null, requestNos: [], assignees: [] });
  const all = [a, b];
  it('ค้นชื่อ / เบอร์ (มีขีดก็เจอ) / เลขใบขอ', () => {
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, q: 'สมชาย' })).toEqual([b]);
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, q: '0812345678' })).toEqual([a]);
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, q: 'opl6909092' })).toEqual([a]);
  });
  it('แท็ก · ผู้ดูแล (รวมยังไม่มี) · ขั้นตอน (รวมยังไม่มีสถานะ) · ผูกใบขอ', () => {
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, tag: 'Online' })).toEqual([b]);
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, assignee: 'น้ำหวาน' })).toEqual([a]);
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, assignee: NO_ASSIGNEE })).toEqual([b]);
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, step: NO_STEP })).toEqual([b]);
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, step: 'ส่งประวัติพนักงาน' })).toEqual([a]);
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, link: 'unlinked' })).toEqual([b]);
    expect(filterErpBoardCards(all, { ...EMPTY_ERP_BOARD_FILTERS, link: 'linked' })).toEqual([a]);
  });
  it('ผู้ดูแลในตัวเลือก เรียงตามจำนวน', () => {
    expect(assigneeOptions([a, card({ cardId: 3, assignees: ['เมย์'] }), card({ cardId: 4, assignees: ['เมย์'] })])).toEqual([
      { name: 'เมย์', count: 2 },
      { name: 'น้ำหวาน', count: 1 },
    ]);
  });
});

describe('ช่องว่างไม่หาย · ตำแหน่งแบบ ERP · วันไทย · สีแท็กคงที่', () => {
  it('ทุกช่องอยู่ครบแม้ไม่มีการ์ด', () => {
    const cols = [
      { id: 1, key: null, label: 'Checklist', seq: 1, isDone: false, requiresLink: false },
      { id: 3, key: null, label: 'In process', seq: 5, isDone: false, requiresLink: true },
    ];
    const r = cardsByColumn(cols, [card({})]);
    expect(r.map((x) => [x.column.label, x.cards.length])).toEqual([
      ['Checklist', 0],
      ['In process', 1],
    ]);
  });
  it('ตำแหน่ง = งานหลัก(งานย่อย)', () => {
    expect(erpCardPosition({ position: 'ขับรถ', jobType: 'รถผู้บริหารคนไทย' })).toBe('ขับรถ(รถผู้บริหารคนไทย)');
    expect(erpCardPosition({ position: null, jobType: null })).toBe('ไม่ระบุ');
  });
  it('วันที่เวลาไทย', () => {
    expect(thDate('2026-11-02T16:48:00Z', true)).toBe('2 พ.ย. 2569 23:48');
    expect(thDate(null)).toBe('—');
  });
  it('แท็กเดิม = สีเดิม', () => {
    expect(tagTone('นายไทย')).toBe(tagTone('นายไทย'));
  });
});

describe('ERP อ่านอย่างเดียว · ปุ่มจดฝั่ง Jarvis (3 พ.ย. 2569)', () => {
  const sql = readFileSync('api/_lib/erpBoardSql.ts', 'utf8');
  const handler = readFileSync('api/_handlers/matching-board.ts', 'utf8');
  it('ไม่มีคำสั่งเขียน ERP · POST จดผ่าน erp_board_events · staff เท่านั้น', () => {
    expect(sql).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+dbo|DELETE\s+FROM|MERGE\s+dbo)\b/i);
    expect(handler).toContain('insertErpBoardEvents');
    expect(handler).toContain('checkErpBoardAction');
    expect(readFileSync('api/_lib/rbac.ts', 'utf8')).toMatch(/case 'matching-board':[\s\S]*?return 'staff'/);
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/matching/board': matchingBoardHandler");
  });
  it('ห้าม RTRIM citizen_id ฝั่ง hr_recruitment (index ไม่ทำงาน 62 วินาที)', () => {
    expect(sql).not.toMatch(/RTRIM\(\w+\.citizen_id\)/);
  });
  it('หน้าเดิมเป็นทางถอย ?view=list / ?bucket=', () => {
    const route = readFileSync('src/pages/matching/CandidatesBoardRoute.tsx', 'utf8');
    expect(route).toContain("sp.get('view') === 'list' || sp.has('bucket')");
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('import("@/pages/matching/CandidatesBoardRoute")');
  });
  it('ปุ่มบนการ์ด/ป๊อปกดได้ · เหลือปิดแค่นำเข้าจากผู้สมัคร', () => {
    const page = readFileSync('src/pages/matching/ErpBoardPage.tsx', 'utf8') + readFileSync('src/components/matching/ErpBoardCardDialog.tsx', 'utf8');
    const stillOff = page.match(/<Button[^>]*title=\{ERP_BOARD_READONLY_HINT\}/g) ?? [];
    expect(stillOff).toHaveLength(1);
    for (const a of ["action: 'call'", "action: on ? 'unassign' : 'assign'", "action: on ? 'untag' : 'tag'", "action: 'move'", "action: 'link'", "action: 'unlink'", "action: 'step'", "action: 'comment'", "action: 'comment_delete'"]) {
      expect(page).toContain(a);
    }
  });
});
