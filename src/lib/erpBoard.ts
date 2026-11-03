/**
 * ═══ บอร์ดรายชื่อรอลงงานของ ERP — ฝั่งหน้าเว็บ (ช่วง 1 อ่านอย่างเดียว · เจ้าของ 2 พ.ย. 2569) ═══
 * ชนิดข้อมูลตรงกับ `api/_lib/erpBoardSql.ts` · ตัวกรอง/จัดกลุ่มเป็นฟังก์ชันล้วน (มีเทสต์)
 * 3 พ.ย. 2569 ปุ่มบนบอร์ดกดได้แล้ว — จดฝั่ง Jarvis (ERP อ่านอย่างเดียว) · ชนกัน = อันที่เปลี่ยนล่าสุดชนะ
 */
import type { ToneKey } from '@/lib/designTokens';
import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage } from '@/lib/api';

/** ปุ่มที่ยังกดไม่ได้ (นำเข้าจากผู้สมัคร) */
export const ERP_BOARD_READONLY_HINT = 'ช่วงนี้ทำใน ERP';

export type ErpBoardColumn = { id: number; key: string | null; label: string; seq: number; isDone: boolean; requiresLink: boolean };
export type ErpBoardDay = { itemId: number; date: string; label: string; cards: number };
export type ErpBoardStep = { id: number; seq: number; label: string; hasDate: boolean; dateLabel: string | null };
export type ErpBoardOutcome = { id: number; stepId: number; label: string; reject: boolean; toColumnIds: number[] };
export type ErpBoardTag = { id: number; label: string };
export type ErpBoardOverview = {
  boardId: number;
  boardName: string | null;
  total: number;
  columns: ErpBoardColumn[];
  days: ErpBoardDay[];
  steps: ErpBoardStep[];
  outcomes: ErpBoardOutcome[];
  tags: ErpBoardTag[];
  checklist: { itemId: number; group: string; item: string }[];
  staff: { id: string; name: string }[];
};
/** การ์ดหลังรวม ERP + การกดบน Jarvis (api/_lib/erpBoardMerge.ts) */
export type ErpBoardCard = {
  cardId: number;
  columnId: number;
  itemId: number | null;
  title: string;
  position: string | null;
  jobType: string | null;
  site: string | null;
  mobile: string | null;
  tags: string[];
  tagIds: number[];
  stepId: number | null;
  step: string | null;
  outcome: string | null;
  scheduledAt: string | null;
  checklistDone: number;
  checkedItemIds: number[];
  requestNos: string[];
  comments: number;
  lastComment: string | null;
  calls: number;
  assignees: string[];
  assigneeIds: string[];
  createdAt: string | null;
  lastActivityAt: string | null;
};
export type ErpBoardCardDetail = {
  card: ErpBoardCard;
  comments: { id: string; who: string | null; text: string; at: string | null; mine: boolean }[];
  checklist: { itemId: number; group: string; item: string; checked: boolean }[];
  activity: { type: string; message: string | null; actor: string | null; at: string | null }[];
  track: { requestNo: string | null; step: string; outcome: string | null; scheduledAt: string | null; at: string | null; by: string | null; remark: string | null }[];
};

export type ErpBoardActionBody =
  | { action: 'move'; columnId: number }
  | { action: 'step'; stepId: number; outcomeId?: number | null; scheduledAt?: string | null; requestNo?: string | null; toColumnId?: number | null; remark?: string | null }
  | { action: 'link' | 'unlink'; requestNo: string }
  | { action: 'check' | 'uncheck'; itemId: number }
  | { action: 'assign' | 'unassign'; staffId: string }
  | { action: 'tag' | 'untag'; tagId: number }
  | { action: 'call' }
  | { action: 'comment'; body: string }
  | { action: 'comment_delete'; commentId: number };

/** กดปุ่มบนบอร์ด → ได้ป๊อปการ์ดชุดใหม่ (ไม่ผ่าน = โยนข้อความจากเซิร์ฟเวอร์) */
export async function postErpBoardAction(cardId: number, body: ErpBoardActionBody): Promise<ErpBoardCardDetail> {
  const r = await apiFetch('/api/matching/board', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, ...body }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกไม่สำเร็จ'));
  return (await r.json()) as ErpBoardCardDetail;
}

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export type ErpBoardMonth = { key: string; label: string; from: string; to: string; cards: number; days: ErpBoardDay[] };

/** แถบซ้ายแบบ ERP: เดือน → วัน (ใหม่ก่อน) · เลขเดือน = ผลรวมวันในเดือน */
export function groupDaysByMonth(days: readonly ErpBoardDay[]): ErpBoardMonth[] {
  const map = new Map<string, ErpBoardMonth>();
  for (const d of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue;
    const key = d.date.slice(0, 7);
    let m = map.get(key);
    if (!m) {
      const [y, mo] = key.split('-').map(Number);
      const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      m = { key, label: `${TH_MONTHS[mo - 1]} ${y + 543}`, from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}`, cards: 0, days: [] };
      map.set(key, m);
    }
    m.cards += d.cards;
    m.days.push(d);
  }
  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((m) => ({ ...m, days: [...m.days].sort((a, b) => b.date.localeCompare(a.date)) }));
}

export type ErpBoardLinkFilter = 'all' | 'linked' | 'unlinked';
export type ErpBoardFilters = { q: string; tag: string | null; assignee: string | null; step: string | null; link: ErpBoardLinkFilter };
export const EMPTY_ERP_BOARD_FILTERS: ErpBoardFilters = { q: '', tag: null, assignee: null, step: null, link: 'all' };
/** ค่าในตัวกรองขั้นตอนสำหรับการ์ดที่ยังไม่มีขั้น */
export const NO_STEP = '__none__';
export const NO_ASSIGNEE = '__none__';

const blob = (c: ErpBoardCard) =>
  [c.title, c.mobile, c.position, c.jobType, c.site, ...c.requestNos].filter(Boolean).join(' ').toLowerCase().replace(/-/g, '');

export function filterErpBoardCards(cards: readonly ErpBoardCard[], f: ErpBoardFilters): ErpBoardCard[] {
  const terms = f.q.trim().toLowerCase().replace(/-/g, '').split(/\s+/).filter(Boolean);
  return cards.filter((c) => {
    if (terms.length && !terms.every((t) => blob(c).includes(t))) return false;
    if (f.tag && !c.tags.includes(f.tag)) return false;
    if (f.assignee === NO_ASSIGNEE ? c.assignees.length > 0 : f.assignee && !c.assignees.includes(f.assignee)) return false;
    if (f.step === NO_STEP ? c.step != null : f.step && c.step !== f.step) return false;
    if (f.link === 'linked' && c.requestNos.length === 0) return false;
    if (f.link === 'unlinked' && c.requestNos.length > 0) return false;
    return true;
  });
}

export const erpBoardFilterCount = (f: ErpBoardFilters) =>
  [f.tag, f.assignee, f.step, f.link !== 'all' ? f.link : null].filter(Boolean).length;

/** ทุกช่องของบอร์ดอยู่เสมอ ว่าง = 0 (กติกา "ว่างแล้วห้ามหาย") */
export function cardsByColumn(columns: readonly ErpBoardColumn[], cards: readonly ErpBoardCard[]) {
  return columns.map((col) => ({ column: col, cards: cards.filter((c) => c.columnId === col.id) }));
}

/** ผู้ดูแลที่มีในการ์ดชุดนี้ (เรียงตามจำนวน) — ตัวเลือกในตัวกรอง */
export function assigneeOptions(cards: readonly ErpBoardCard[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const c of cards) for (const a of c.assignees) m.set(a, (m.get(a) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
}

/** นับตามกลุ่ม — ใช้ในแท็บ Dashboard · ค่าว่างนับเป็น `emptyLabel` */
export function countBy(cards: readonly ErpBoardCard[], keyOf: (c: ErpBoardCard) => string[] | string | null, emptyLabel: string) {
  const m = new Map<string, number>();
  for (const c of cards) {
    const k = keyOf(c);
    const keys = Array.isArray(k) ? (k.length ? k : [emptyLabel]) : [k ?? emptyLabel];
    for (const x of keys) m.set(x, (m.get(x) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** ตำแหน่งแบบ ERP: งานหลัก(งานย่อย) */
export const erpCardPosition = (c: Pick<ErpBoardCard, 'position' | 'jobType'>) =>
  c.position ? (c.jobType ? `${c.position}(${c.jobType})` : c.position) : (c.jobType ?? 'ไม่ระบุ');

/** วันที่แบบไทย "2 พ.ย. 2569" · มีเวลา = "2 พ.ย. 2569 23:48" */
export function thDate(iso: string | null, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const bkk = new Date(d.getTime() + 7 * 3600 * 1000);
  const base = `${bkk.getUTCDate()} ${TH_MONTHS_SHORT[bkk.getUTCMonth()]} ${bkk.getUTCFullYear() + 543}`;
  if (!withTime) return base;
  return `${base} ${String(bkk.getUTCHours()).padStart(2, '0')}:${String(bkk.getUTCMinutes()).padStart(2, '0')}`;
}

/** สีป้ายแท็ก — ERP เก็บ hex เองแต่ระบบนี้ห้ามใช้ hex ⇒ จับคู่ชื่อแท็กกับโทนกลาง (ชื่อเดิม = สีเดิมทุกครั้ง) */
const TAG_TONES: readonly ToneKey[] = ['warn', 'danger', 'info', 'teal', 'violet', 'orange', 'success', 'primary'];
export function tagTone(label: string): ToneKey {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_TONES[h % TAG_TONES.length];
}

const ACTIVITY_LABEL: Record<string, string> = {
  card_imported: 'นำเข้าขึ้นบอร์ด',
  card_moved: 'ย้ายช่อง',
  card_assigned: 'มอบหมาย',
  card_unassigned: 'เอาผู้ดูแลออก',
  card_called: 'โทรหาผู้สมัคร',
  card_step: 'ลงขั้นตอน',
  card_linked: 'ผูกใบขอ',
  card_unlinked: 'เอาใบขอออก',
  card_checked: 'ติ๊กข้อตรวจ',
  card_unchecked: 'เอาติ๊กออก',
  card_tagged: 'ติดแท็ก',
  card_untagged: 'เอาแท็กออก',
  card_commented: 'เขียนความคิดเห็น',
  card_comment_deleted: 'ลบความคิดเห็น',
};
export const erpActivityLabel = (type: string) => ACTIVITY_LABEL[type] ?? type;
