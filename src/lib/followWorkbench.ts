/**
 * ═══ "วันนี้ต้องตามใครบ้าง" — ตรรกะของหน้าติดตามโฉมใหม่ (21 ก.ย. 2569) ═══
 *
 * เจ้าของส่งแบบมาแล้วสั่ง *"ฉันอยากได้ประมาณนี้อะสำหรับ UI"* พร้อมกำชับว่า
 * *"ฉันกลัวนายทำ Function ต่าง ๆ หาย"*
 *
 * ไฟล์นี้คือ **ชั้นตรรกะล้วน** ของจอใหม่ — ไม่มี JSX ไม่มีสี ไม่มีคำบนปุ่ม
 * เพื่อให้เปลี่ยนหน้าตาได้โดยไม่แตะกติกา และเทสต์จับได้ว่าเลขตรงไหม
 *
 * 🔴 กติกาที่ยึด:
 * 1. **หนึ่งแถว = หนึ่งคน** (ไม่ใช่หนึ่งรอบ) — ใช้คีย์กลุ่มชุดเดียวกับที่อื่นทั้งระบบ
 * 2. **ทุกแถวต้องมี "แล้วไงต่อ"** — คำสั่งมาจาก `todayAction.ts` ที่เดียว ห้ามเขียนใหม่
 * 3. **ของค้างต้องเด่นกว่าของที่ยังไม่ถึงเวลา** — เรียงตามความเร่งด่วน ไม่ใช่ตามเวลาสร้าง
 * 4. **"ไม่ได้ส่งให้ AI" ต้องดังกว่าทุกอย่าง** — สายที่ไม่มีวันออกคือความเสียหายที่เงียบที่สุด
 */
import type { FollowEntry } from '@/lib/followApi';
import { groupFollowEntries, type FollowGroup } from '@/lib/followGrouping';
import { followLifecycleTab } from '@/lib/followListFilter';
import {
  followDispatchLabel,
  isFollowDispatchState,
  FOLLOW_DISPATCH_META,
  type FollowDispatchMeta,
} from '@/lib/followDispatchState';
import { actionForPending, actionForResult, type TodayAction } from '@/lib/todayAction';
import {
  classifyCallMicro,
  FOLLOW_VOCAB,
  type CallMicroOutcome,
} from '@/lib/callMicroOutcome';

/**
 * ช่องที่แถวหนึ่งจะไปตกอยู่ — **สี่ช่องนี้ไม่ซ้อนกัน** หนึ่งคนอยู่ช่องเดียวเสมอ
 * (ของเดิมมีตัวเลขซ้อนกันหลายชุดจนบวกไม่ได้ · เจ้าของสั่งให้เลขสอดคล้องกัน)
 */
export type WorkbenchLane =
  /** เลยเวลา · ตอบว่าไม่ไป · ไม่ได้ส่งให้ AI — ต้องมีคนลงมือวันนี้ */
  | 'urgent'
  /** ส่งไปแล้ว/ตั้งไว้แล้ว ยังไม่รู้ผล */
  | 'waiting'
  /** ได้คำตอบว่าไปแล้ว แต่ยังไม่ปิดงาน */
  | 'confirmed'
  /** ปิดงาน/ยกเลิกแล้ว — ไม่อยู่ในคิวงานวันนี้ แต่ต้องเปิดดูได้ */
  | 'closed';

export const WORKBENCH_LANES: readonly WorkbenchLane[] = [
  'urgent',
  'waiting',
  'confirmed',
  'closed',
];

/** ใครถือสายนี้อยู่ — ใช้เป็นตัวกรอง "งานฉัน / AI ดูแล / ยังไม่มีเจ้าของ" */
export type WorkbenchOwnerKind =
  /** AI รับไปโทรแล้ว (อยู่ในคิว) */
  | 'ai'
  /** คนโทรเอง — ตั้งใจไว้แต่แรก (`call_mode = manual`) */
  | 'staff'
  /**
   * **ไม่มีใครถืออยู่** — ไม่ได้ส่งให้ AI และไม่ได้ตั้งว่าจะโทรเอง
   * 🔴 ช่องนี้คือของที่หล่นหายเงียบ ๆ ในระบบเดิม ต้องมีที่ยืนของตัวเอง
   */
  | 'none';

export type WorkbenchRow = {
  group: FollowGroup;
  lane: WorkbenchLane;
  /** รอบที่เป็นตัวแทนของแถวนี้ — ของค้าง > รอบถัดไป > รอบล่าสุด */
  round: FollowEntry | null;
  /** สิ่งที่คนต้องทำต่อ (คำมาจาก `todayAction.ts`) */
  action: TodayAction;
  ownerKind: WorkbenchOwnerKind;
  /** ชื่อคนที่คีย์รายการนี้ — ระบบยังไม่มีแนวคิด "เจ้าของงาน" ที่แท้จริง */
  keyedBy: string | null;
  /** เลยเวลานัดมากี่นาที — `null` = ยังไม่เลย/ไม่มีเวลานัด */
  lateMinutes: number | null;
  /** เวลานัดของรอบตัวแทน */
  dueIso: string | null;
  /** ผลที่อ่านจากคำพูดจริงในสาย — `null` = ยังไม่มีผล */
  result: CallMicroOutcome | null;
  /** คำที่ผู้รับสายพูดเอง (ดิบ ไม่ตัด — จอเป็นคนตัด) */
  said: string | null;
  /**
   * ปัญหาการส่งที่ต้องให้คนเห็น — `null` = ไม่มีปัญหา
   * (เบอร์ห้ามโทร · ส่งไม่ถึง Lumos · ไม่มีเบอร์ · ปิดส่งอัตโนมัติ)
   */
  dispatchIssue: FollowDispatchMeta | null;
};

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/** รอบที่เอามาเป็นหน้าตาของแถว — ของค้างมาก่อนเสมอ */
function pickRound(g: FollowGroup): FollowEntry | null {
  if (g.overdueRound) return g.overdueRound;
  if (g.nextRound) return g.nextRound;
  const live = g.rounds.filter((r) => !r.cancelled);
  return live[live.length - 1] ?? g.rounds[g.rounds.length - 1] ?? null;
}

/** ผลของรอบ — อ่านจากคำพูดจริง ไม่ใช่รหัสของ Lumos (รหัสปนไปและไม่ไป) */
function resultOf(round: FollowEntry | null): CallMicroOutcome | null {
  if (!round?.call_outcome) return null;
  return classifyCallMicro(
    { outcome: round.call_outcome, summary: round.call_summary, reply: round.call_reply },
    FOLLOW_VOCAB,
  );
}

/** ปัญหาการส่งที่ต้องเตือน — เอาเฉพาะที่ **ต้องมีคนลงมือ** ไม่ใช่ทุกสถานะ */
function dispatchIssueOf(round: FollowEntry | null): FollowDispatchMeta | null {
  if (!round) return null;
  const meta = followDispatchLabel({
    state: round.dispatch_state,
    callStatus: round.call_status,
  });
  return meta.needsAction ? meta : null;
}

function ownerKindOf(round: FollowEntry | null): WorkbenchOwnerKind {
  if (!round) return 'none';
  if (round.call_mode === 'manual') return 'staff';
  const state = round.dispatch_state;
  // อยู่ในคิวจริง (หรือคิวเดินต่อไปแล้ว) = AI ถืออยู่
  if (round.call_status || state === 'queued') return 'ai';
  if (isFollowDispatchState(state) && FOLLOW_DISPATCH_META[state].needsAction) return 'none';
  return state ? 'ai' : 'none';
}

/**
 * แถวนี้อยู่ช่องไหน
 *
 * ⚠️ ลำดับสำคัญ: ปิดงานแล้วมาก่อน (ไม่ใช่งานวันนี้) → ต้องลงมือ → ได้คำตอบว่าไป → รอผล
 */
function laneOf(input: {
  group: FollowGroup;
  round: FollowEntry | null;
  result: CallMicroOutcome | null;
  action: TodayAction;
}): WorkbenchLane {
  const openRounds = input.group.rounds.filter(
    (r) => followLifecycleTab(r) === 'active',
  );
  if (openRounds.length === 0) return 'closed';
  if (input.action.level === 'high') return 'urgent';
  if (input.result === 'said_yes') return 'confirmed';
  return 'waiting';
}

export function buildWorkbenchRows(
  entries: readonly FollowEntry[],
  now: Date = new Date(),
): WorkbenchRow[] {
  const nowMs = now.getTime();
  const rows: WorkbenchRow[] = [];

  for (const group of groupFollowEntries([...entries], now)) {
    const round = pickRound(group);
    const result = resultOf(round);
    const dispatchIssue = dispatchIssueOf(round);
    const dueIso = round?.scheduled_at ?? null;
    const dueMs = ms(dueIso);
    const late = dueMs != null && dueMs < nowMs && !result;

    /**
     * 🔴 ลำดับการตัดสิน "แล้วไงต่อ":
     * ส่งไม่ออก > มีผลแล้ว > เลยเวลา > ยังไม่ถึงเวลา
     * (ส่งไม่ออกมาก่อนผล เพราะแถวที่ส่งไม่ออกจะไม่มีวันมีผล)
     */
    let action: TodayAction;
    if (dispatchIssue) {
      action = { text: dispatchIssue.label, needsHuman: true, level: 'high' };
    } else if (result) {
      action = actionForResult(result);
    } else if (late) {
      action = actionForPending('overdue');
    } else if (round) {
      action = actionForPending(round.call_status ? 'waiting' : 'not_sent');
    } else {
      action = actionForPending('not_sent');
    }

    rows.push({
      group,
      round,
      action,
      lane: laneOf({ group, round, result, action }),
      ownerKind: ownerKindOf(round),
      keyedBy: group.createdByName,
      lateMinutes: late && dueMs != null ? Math.floor((nowMs - dueMs) / 60_000) : null,
      dueIso,
      result,
      said: round?.call_reply ?? null,
      dispatchIssue,
    });
  }

  return sortWorkbenchRows(rows);
}

/**
 * เรียง: **ของที่ต้องลงมือขึ้นก่อน** · ในระดับเดียวกันเรียงตามเวลานัด
 * (ค้างนานสุดอยู่บนสุดของกลุ่มด่วน — คนรออยู่ปลายสายนานที่สุด)
 */
export function sortWorkbenchRows(rows: WorkbenchRow[]): WorkbenchRow[] {
  const laneRank: Record<WorkbenchLane, number> = {
    urgent: 0,
    waiting: 1,
    confirmed: 2,
    closed: 3,
  };
  return [...rows].sort((a, b) => {
    if (laneRank[a.lane] !== laneRank[b.lane]) return laneRank[a.lane] - laneRank[b.lane];
    if (a.lane === 'urgent') {
      // ค้างนานกว่าอยู่บน — ไม่มีเวลาค้างถือว่าค้าง 0 นาที
      const la = a.lateMinutes ?? 0;
      const lb = b.lateMinutes ?? 0;
      if (la !== lb) return lb - la;
    }
    const da = ms(a.dueIso);
    const db = ms(b.dueIso);
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  });
}

export type WorkbenchCounts = Record<WorkbenchLane, number> & {
  /** งานที่ยังไม่จบทั้งหมด = urgent + waiting + confirmed */
  open: number;
};

/** 🔴 สามช่องแรกต้องบวกกันได้ `open` เป๊ะ — จอเอาไปโชว์คู่กัน */
export function countWorkbenchLanes(rows: readonly WorkbenchRow[]): WorkbenchCounts {
  const out: WorkbenchCounts = { urgent: 0, waiting: 0, confirmed: 0, closed: 0, open: 0 };
  for (const r of rows) out[r.lane] += 1;
  out.open = out.urgent + out.waiting + out.confirmed;
  return out;
}

export function countWorkbenchOwners(
  rows: readonly WorkbenchRow[],
): Record<WorkbenchOwnerKind | 'all', number> {
  const out = { all: 0, ai: 0, staff: 0, none: 0 };
  for (const r of rows) {
    if (r.lane === 'closed') continue; // ตัวกรองเจ้าของใช้กับงานที่ยังเปิดอยู่เท่านั้น
    out.all += 1;
    out[r.ownerKind] += 1;
  }
  return out;
}

export type WorkbenchFilter = {
  lane: WorkbenchLane | 'open';
  owner: WorkbenchOwnerKind | 'all';
  /** คำค้น — ชื่อ · เบอร์ · หน่วยงาน · เรื่อง */
  q: string;
};

/** ค้นหาแบบไม่สนช่องว่าง/ขีด — เบอร์ที่คนพิมพ์มีทั้ง 081-234-5678 และ +6681… */
const norm = (v: string): string => v.toLowerCase().replace(/[\s-()]/g, '');

export function filterWorkbenchRows(
  rows: readonly WorkbenchRow[],
  f: WorkbenchFilter,
): WorkbenchRow[] {
  const q = norm(f.q.trim());
  return rows.filter((r) => {
    if (f.lane === 'open' ? r.lane === 'closed' : r.lane !== f.lane) return false;
    if (f.owner !== 'all' && r.ownerKind !== f.owner) return false;
    if (q) {
      const hay = norm(
        [r.group.name, r.group.phone, r.group.unitName ?? '', r.group.topic].join(' '),
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
