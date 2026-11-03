/**
 * บอร์ดรายชื่อรอลงงาน: กดบน Jarvis (เจ้าของ 3 พ.ย. 2569 Choice "ทุกปุ่มบนบอร์ด")
 * รวมกับ ERP แบบ "อันที่เปลี่ยนล่าสุดชนะ" · กติกาปุ่มตาม ERP · เวลา ERP เป็นเวลาไทย
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkErpBoardAction,
  erpTime,
  mergeErpBoardCard,
  mergeErpBoardDetail,
  parseErpBoardAction,
  type ErpBoardMeta,
  type ErpRawCard,
  type JarvisBoardEvent,
} from '../../api/_lib/erpBoardMerge';
import { staffOptions } from '../../api/_lib/erpBoardSql';

const meta: ErpBoardMeta = {
  boardId: 1,
  boardName: 'รายชื่อผู้สมัครงาน ปี 2569',
  columns: [
    { id: 1, key: 'checklist', label: 'Checklist', seq: 1, isDone: false, requiresLink: false },
    { id: 2, key: 'todo', label: 'To do', seq: 2, isDone: false, requiresLink: false },
    { id: 6, key: 'reuse', label: 'Re Use', seq: 4, isDone: false, requiresLink: false },
    { id: 3, key: 'in_process', label: 'In process', seq: 5, isDone: false, requiresLink: true },
    { id: 4, key: 'done', label: 'Done', seq: 6, isDone: true, requiresLink: true },
    { id: 5, key: 'drop', label: 'Drop', seq: 7, isDone: false, requiresLink: false },
  ],
  steps: [
    { id: 1, seq: 1, label: 'ส่งประวัติพนักงาน', hasDate: true, dateLabel: 'วันที่ส่งประวัติพนักงาน' },
    { id: 4, seq: 4, label: 'นัดสัมภาษณ์', hasDate: true, dateLabel: 'วันนัดสัมภาษณ์' },
    { id: 5, seq: 5, label: 'สัมภาษณ์', hasDate: false, dateLabel: null },
    { id: 7, seq: 7, label: 'ทำงาน', hasDate: true, dateLabel: 'วันที่เริ่มงาน' },
  ],
  outcomes: [
    { id: 7, stepId: 4, label: 'นัดสัมภาษณ์สำเร็จ', reject: false, toColumnIds: [] },
    { id: 8, stepId: 4, label: 'นัดสัมภาษณ์ไม่สำเร็จ', reject: true, toColumnIds: [5, 6] },
    { id: 9, stepId: 5, label: 'สัมภาษณ์สำเร็จ', reject: false, toColumnIds: [] },
    { id: 13, stepId: 7, label: 'ไปทำงาน', reject: false, toColumnIds: [4] },
  ],
  tags: [
    { id: 1, label: 'Valet' },
    { id: 3, label: 'รถตู้' },
    { id: 7, label: 'Online' },
  ],
  checklist: [
    { itemId: 1, group: 'การทดสอบรถยนต์', item: 'ภาคทฤษฎี' },
    { itemId: 2, group: 'การทดสอบรถยนต์', item: 'ภาคปฏิบัติ' },
  ],
  staff: [
    { id: '1460500229184', name: 'น้ำหวาน' },
    { id: '1119901907770', name: 'ตี้' },
  ],
};

const raw = (p: Partial<ErpRawCard> = {}): ErpRawCard => ({
  cardId: 3156,
  columnId: 3,
  itemId: 153,
  title: 'ธนวัฒน์ คณะปัญญา',
  position: 'ขับรถ',
  jobType: 'ส่วนกลาง',
  site: 'ไอคอนสยาม',
  mobile: '0983323436',
  createdAt: '2026-10-20T01:20:14.000Z',
  lastActivityAt: '2026-11-02T09:00:28.000Z',
  movedAt: '2026-11-02T09:00:28.000Z',
  tagIds: [1, 3],
  lastStep: { stepId: 5, outcomeId: 9, at: '2026-11-02T08:59:44.000Z', requestNo: 'OPL6910080' },
  lastSchedule: { scheduledAt: '2026-11-01T17:00:00.000Z', at: '2026-11-01T05:00:00.000Z' },
  links: [{ requestNo: 'OPL6910080', at: '2026-11-02T08:58:18.000Z' }],
  assignees: [{ staffId: '1460500229184', name: 'น้ำหวาน', at: '2026-10-20T02:47:47.000Z' }],
  checks: [{ itemId: 1, at: '2026-10-20T01:21:30.000Z' }],
  comments: 2,
  lastComment: { text: 'แทนงาน รอประเมิน 1/11/2569', at: '2026-11-01T03:00:00.000Z' },
  calls: 1,
  ...p,
});

let seq = 0;
const ev = (p: Partial<JarvisBoardEvent> & Pick<JarvisBoardEvent, 'kind' | 'createdAt'>): JarvisBoardEvent => ({
  id: ++seq,
  cardId: 3156,
  columnId: null,
  fromColumnId: null,
  stepId: null,
  outcomeId: null,
  scheduledAt: null,
  requestNo: null,
  itemId: null,
  staffId: null,
  staffName: null,
  tagId: null,
  body: null,
  refEventId: null,
  actorUserId: '11111111-1111-4111-8111-111111111111',
  actorName: 'มาย',
  ...p,
});

describe('เวลา ERP = เวลาไทย', () => {
  it('Date จากไดรเวอร์ (ติดป้าย UTC) ลบ 7 ชม. · ข้อความไม่มีเขตเวลา = เวลาไทย', () => {
    expect(erpTime(new Date('2026-11-03T08:43:49.080Z'))).toBe('2026-11-03T01:43:49.080Z');
    expect(erpTime('2026-11-03T08:43:49')).toBe('2026-11-03T01:43:49.000Z');
    expect(erpTime('')).toBeNull();
    expect(erpTime(null)).toBeNull();
  });
});

describe('รวม ERP + Jarvis: อันที่เปลี่ยนล่าสุดชนะ', () => {
  it('ไม่มีการกดบน Jarvis = เหมือน ERP ทุกอย่าง', () => {
    const c = mergeErpBoardCard(raw(), [], meta);
    expect(c.columnId).toBe(3);
    expect(c.step).toBe('สัมภาษณ์');
    expect(c.outcome).toBe('สัมภาษณ์สำเร็จ');
    expect(c.tags).toEqual(['Valet', 'รถตู้']);
    expect(c.checklistDone).toBe(1);
    expect(c.requestNos).toEqual(['OPL6910080']);
    expect(c.assignees).toEqual(['น้ำหวาน']);
  });
  it('ย้ายช่องบน Jarvis หลัง ERP = ใช้ของ Jarvis · ERP ย้ายทีหลัง = ERP ชนะ', () => {
    const moved = ev({ kind: 'move', columnId: 5, fromColumnId: 3, createdAt: '2026-11-03T02:00:00.000Z' });
    expect(mergeErpBoardCard(raw(), [moved], meta).columnId).toBe(5);
    expect(mergeErpBoardCard(raw({ columnId: 4, movedAt: '2026-11-03T03:00:00.000Z' }), [moved], meta).columnId).toBe(4);
  });
  it('ลงขั้นบน Jarvis = ขั้นล่าสุด + วันนัดใหม่ · ประวัติขั้นรวมสองฝั่ง', () => {
    const s = ev({ kind: 'step', stepId: 4, outcomeId: 7, scheduledAt: '2026-11-05T03:00:00.000Z', requestNo: 'OPL6910080', createdAt: '2026-11-03T02:00:00.000Z' });
    const c = mergeErpBoardCard(raw(), [s], meta);
    expect([c.step, c.outcome, c.scheduledAt]).toEqual(['นัดสัมภาษณ์', 'นัดสัมภาษณ์สำเร็จ', '2026-11-05T03:00:00.000Z']);
    const d = mergeErpBoardDetail(
      raw(),
      { comments: [], activity: [], track: [{ stepId: 5, outcomeId: 9, requestNo: 'OPL6910080', scheduledAt: null, at: '2026-11-02T08:59:44.000Z', by: 'มาย', remark: null }] },
      [s],
      meta,
      null,
    );
    expect(d.track.map((t) => t.step)).toEqual(['นัดสัมภาษณ์', 'สัมภาษณ์']);
  });
  it('ใบขอ / ผู้ดูแล / ข้อตรวจ เทียบทีละตัว', () => {
    const c = mergeErpBoardCard(
      raw(),
      [
        ev({ kind: 'link', requestNo: 'OPL6910099', createdAt: '2026-11-03T02:00:00.000Z' }),
        ev({ kind: 'unlink', requestNo: 'OPL6910080', createdAt: '2026-11-03T02:01:00.000Z' }),
        ev({ kind: 'assign', staffId: '1119901907770', staffName: 'ตี้', createdAt: '2026-11-03T02:02:00.000Z' }),
        ev({ kind: 'check', itemId: 2, createdAt: '2026-11-03T02:03:00.000Z' }),
        ev({ kind: 'uncheck', itemId: 1, createdAt: '2026-11-03T02:04:00.000Z' }),
      ],
      meta,
    );
    expect(c.requestNos).toEqual(['OPL6910099']);
    expect(c.assignees).toEqual(['น้ำหวาน', 'ตี้']);
    expect(c.checkedItemIds).toEqual([2]);
  });
  it('เอาใบขอออกบน Jarvis ก่อน ERP ผูกใหม่ = ERP ชนะ', () => {
    const c = mergeErpBoardCard(raw({ links: [{ requestNo: 'OPL6910080', at: '2026-11-03T05:00:00.000Z' }] }), [ev({ kind: 'unlink', requestNo: 'OPL6910080', createdAt: '2026-11-03T02:00:00.000Z' })], meta);
    expect(c.requestNos).toEqual(['OPL6910080']);
  });
  it('แท็ก ERP ไม่มีเวลา ⇒ เคยกดบน Jarvis = ใช้ของ Jarvis', () => {
    const c = mergeErpBoardCard(raw(), [ev({ kind: 'untag', tagId: 1, createdAt: '2026-11-03T02:00:00.000Z' }), ev({ kind: 'tag', tagId: 7, createdAt: '2026-11-03T02:01:00.000Z' })], meta);
    expect(c.tags).toEqual(['รถตู้', 'Online']);
  });
  it('โทร/ความคิดเห็นนับรวม · ลบความคิดเห็นแล้วหาย', () => {
    const cm = ev({ kind: 'comment', body: 'นัดมาสัมภาษณ์ 5/11', createdAt: '2026-11-03T02:00:00.000Z' });
    const c1 = mergeErpBoardCard(raw(), [ev({ kind: 'call', createdAt: '2026-11-03T01:00:00.000Z' }), cm], meta);
    expect([c1.calls, c1.comments, c1.lastComment]).toEqual([2, 3, 'นัดมาสัมภาษณ์ 5/11']);
    const c2 = mergeErpBoardCard(raw(), [cm, ev({ kind: 'comment_delete', refEventId: cm.id, createdAt: '2026-11-03T02:05:00.000Z' })], meta);
    expect([c2.comments, c2.lastComment]).toEqual([2, 'แทนงาน รอประเมิน 1/11/2569']);
  });
  it('ป๊อป: ความคิดเห็นของตัวเองลบได้ · กิจกรรมของ Jarvis ใช้คำแบบ ERP', () => {
    const cm = ev({ kind: 'comment', body: 'โทรแล้วไม่รับ', createdAt: '2026-11-03T02:00:00.000Z' });
    const mv = ev({ kind: 'move', columnId: 5, fromColumnId: 3, createdAt: '2026-11-03T02:01:00.000Z' });
    const d = mergeErpBoardDetail(raw(), { comments: [{ id: 99, who: 'เมย์', text: 'ส่งต่อให้น้ำหวาน', at: '2026-11-02T00:00:00.000Z' }], activity: [], track: [] }, [cm, mv], meta, cm.actorUserId);
    expect(d.comments.map((c) => [c.id, c.mine])).toEqual([[`j:${cm.id}`, true], ['erp:99', false]]);
    expect(d.activity[0].message).toBe('เปลี่ยนสถานะจาก In process เป็น Drop');
  });
});

describe('กติกาปุ่มตาม ERP', () => {
  const card = mergeErpBoardCard(raw(), [], meta);
  const unlinked = mergeErpBoardCard(raw({ links: [], columnId: 2 }), [], meta);
  it('In process / Done ต้องผูกใบขอ · ย้ายไปช่องเดิมไม่ได้', () => {
    expect(checkErpBoardAction({ action: 'move', columnId: 3 }, unlinked, meta, new Set())).toEqual({ ok: false, message: 'ผูกใบขอก่อนย้ายไป In process' });
    expect(checkErpBoardAction({ action: 'move', columnId: 3 }, card, meta, new Set()).ok).toBe(false);
    expect(checkErpBoardAction({ action: 'move', columnId: 5 }, card, meta, new Set())).toEqual({ ok: true, events: [{ kind: 'move', columnId: 5, fromColumnId: 3 }] });
  });
  it('ลงขั้นต้องมีใบขอ · ผลไม่สำเร็จต้องเลือก Drop/Re Use · ไปทำงาน = ย้ายไป Done', () => {
    expect(checkErpBoardAction({ action: 'step', stepId: 4, outcomeId: 7 }, unlinked, meta, new Set())).toEqual({ ok: false, message: 'ผูกใบขอก่อนลงขั้นตอน' });
    expect(checkErpBoardAction({ action: 'step', stepId: 4, outcomeId: 8 }, card, meta, new Set())).toEqual({ ok: false, message: 'เลือกว่าจะย้ายไป Drop หรือ Re Use' });
    const rej = checkErpBoardAction({ action: 'step', stepId: 4, outcomeId: 8, toColumnId: 6 }, card, meta, new Set());
    expect(rej.ok && rej.events.map((e) => e.kind)).toEqual(['step', 'move']);
    const go = checkErpBoardAction({ action: 'step', stepId: 7, outcomeId: 13, scheduledAt: '2026-11-10T00:00:00.000Z' }, card, meta, new Set());
    expect(go.ok && go.events[1]).toEqual({ kind: 'move', columnId: 4, fromColumnId: 3 });
    expect(checkErpBoardAction({ action: 'step', stepId: 5, scheduledAt: '2026-11-10T00:00:00.000Z' }, card, meta, new Set()).ok).toBe(false);
    expect(checkErpBoardAction({ action: 'step', stepId: 5, outcomeId: 7 }, card, meta, new Set())).toEqual({ ok: false, message: 'ผลนี้ไม่ใช่ของขั้นนี้' });
  });
  it('เอาใบขอใบสุดท้ายออกตอนอยู่ In process ไม่ได้ · เลขใบขอผิดรูปไม่รับ', () => {
    expect(checkErpBoardAction({ action: 'unlink', requestNo: 'OPL6910080' }, card, meta, new Set()).ok).toBe(false);
    expect(checkErpBoardAction({ action: 'link', requestNo: 'opl6910099' }, card, meta, new Set())).toEqual({ ok: true, events: [{ kind: 'link', requestNo: 'OPL6910099' }] });
    expect(checkErpBoardAction({ action: 'link', requestNo: '12' }, card, meta, new Set()).ok).toBe(false);
  });
  it('กดซ้ำสถานะเดิม = ไม่จดอะไร · ลบได้เฉพาะความคิดเห็นของตัวเอง', () => {
    expect(checkErpBoardAction({ action: 'check', itemId: 1 }, card, meta, new Set())).toEqual({ ok: true, events: [] });
    expect(checkErpBoardAction({ action: 'assign', staffId: '1460500229184' }, card, meta, new Set())).toEqual({ ok: true, events: [] });
    expect(checkErpBoardAction({ action: 'assign', staffId: 'x' }, card, meta, new Set()).ok).toBe(false);
    expect(checkErpBoardAction({ action: 'comment_delete', commentId: 5 }, card, meta, new Set()).ok).toBe(false);
    expect(checkErpBoardAction({ action: 'comment_delete', commentId: 5 }, card, meta, new Set([5])).ok).toBe(true);
    expect(checkErpBoardAction({ action: 'comment', body: '   ' }, card, meta, new Set()).ok).toBe(false);
  });
  it('อ่าน body: ผิดรูป = null', () => {
    expect(parseErpBoardAction({ action: 'move', columnId: '3' })).toBeNull();
    expect(parseErpBoardAction({ action: 'drop_table' })).toBeNull();
    expect(parseErpBoardAction({ action: 'tag', tagId: 3 })).toEqual({ action: 'tag', tagId: 3 });
  });
});

describe('รายชื่อผู้ดูแล', () => {
  it('คนเดียวสองรหัส = เหลือรหัสที่มอบหมายล่าสุด', () => {
    expect(
      staffOptions([
        { staff_id: 'old', name: 'เมย์', fname: 'เมธินี', lname: 'สว่างสุข', last_at: '2026-01-01T00:00:00Z' },
        { staff_id: 'new', name: 'เมย์', fname: 'เมธินี', lname: 'สว่างสุข', last_at: '2026-11-02T00:00:00Z' },
      ]),
    ).toEqual([{ id: 'new', name: 'เมย์' }]);
  });
  it('ชื่อเล่นซ้ำคนละคน = ต่อชื่อ-นามสกุลในวงเล็บ (ชื่อจริงซ้ำได้)', () => {
    expect(
      staffOptions([
        { staff_id: '1', name: 'เมย์', fname: 'เมธินี ', lname: 'สว่างสุข' },
        { staff_id: '2', name: 'เมย์', fname: 'เมธินี', lname: 'สิงห์โต' },
        { staff_id: '3', name: 'ตี้', fname: 'ธนพร', lname: 'ใจดี' },
      ]).map((s) => s.name),
    ).toEqual(['ตี้', 'เมย์ (เมธินี สว่างสุข)', 'เมย์ (เมธินี สิงห์โต)']);
  });
});

describe('ERP ยังอ่านอย่างเดียว · ปีเก่าไม่ดึง', () => {
  it('ไฟล์อ่าน ERP ไม่มีคำสั่งเขียน · ตัดวันก่อน 1 ม.ค. 2568', () => {
    const sql = readFileSync('api/_lib/erpBoardSql.ts', 'utf8');
    expect(sql).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+dbo|DELETE\s+FROM|MERGE\s+dbo)\b/i);
    expect(sql).toContain("export const ERP_BOARD_MIN_DATE = '2025-01-01'");
    expect(sql).toMatch(/item_id IN \(\$\{MIN_ITEMS\}\)/);
  });
  it('การกดจดที่ erp_board_events (migration 172 เพิ่มอย่างเดียว)', () => {
    const m = readFileSync('migrations/172_erp_board_events.sql', 'utf8');
    expect(m).toContain('create table if not exists erp_board_events');
    expect(m).not.toMatch(/\b(drop|delete|update)\b/i);
  });
});
