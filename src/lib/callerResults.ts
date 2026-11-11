/**
 * ═══ ข้อ 2 "ทำแล้วเป็นไง" (เจ้าของ 11 พ.ย. 2569 · Choice "ผลต่อคน" · "คนที่เก็บรายชื่อไปโทร") ═══
 * > *"บอกหมดเลยทั้งที่ทำไปแล้ว ยังไม่ทำ จะได้รู้ไงทำไปแล้วเท่านี้ผลเป็นไง ยังไม่ทำเท่านี้เปิดมาก็จะได้ไปทำต่อเลย"*
 * แถว = คนที่เก็บรายชื่อไปโทร (`claimedBy`) · ทุกขั้นแบ่ง ทำแล้ว / ยังไม่ทำ แล้วบวกกันเท่าขั้นก่อนหน้า:
 *   เก็บไป = ยังไม่ทำ + ติดต่อไม่ได้ + ติดต่อได้ · ติดต่อได้ = ยังไม่นัด + นัดได้ · นัดได้ = ยังไม่ลงผล + ไม่มา + มา · มา = ยังไม่แจ้ง + แจ้งแล้ว
 * แถว AI = รายชื่อที่ยังไม่มีใครเก็บ: ส่งให้ AI = ยังไม่โทร + ติดต่อไม่ได้ + ติดต่อได้ (สนใจ = ยังไม่มีคนเก็บไปนัด)
 * ทุกช่องเก็บ id ไว้กดดูชื่อ · pure — เทสต์ `tests/api/recruitOverviewFourQuestions2569-11-11.test.ts`
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

export type CallerCellKey =
  | 'kept'
  | 'notLogged'
  | 'notOk'
  | 'ok'
  | 'notBooked'
  | 'booked'
  | 'attPending'
  | 'noShow'
  | 'showed'
  | 'notInformed'
  | 'informed';
export type CallerResultRow = { who: string } & Record<CallerCellKey, string[]>;

/** ช่องที่เป็น "ยังไม่ทำ" — จอทำตัวแดง กดแล้วไปทำต่อ */
export const CALLER_TODO_KEYS: ReadonlySet<CallerCellKey> = new Set(['notLogged', 'notBooked', 'attPending', 'notInformed']);

export const CALLER_GROUPS: ReadonlyArray<{ label: string; cells: ReadonlyArray<{ key: CallerCellKey; label: string }> }> = [
  { label: 'โทร', cells: [{ key: 'notLogged', label: 'ยังไม่ทำ' }, { key: 'notOk', label: 'ติดต่อไม่ได้' }, { key: 'ok', label: 'ติดต่อได้' }] },
  { label: 'นัด (จากติดต่อได้)', cells: [{ key: 'notBooked', label: 'ยังไม่นัด' }, { key: 'booked', label: 'นัดได้' }] },
  { label: 'ผลนัด (จากนัดได้)', cells: [{ key: 'attPending', label: 'ยังไม่ลงผล' }, { key: 'noShow', label: 'ไม่มา' }, { key: 'showed', label: 'มา' }] },
  { label: 'แจ้งเข้า (จากมา)', cells: [{ key: 'notInformed', label: 'ยังไม่แจ้ง' }, { key: 'informed', label: 'แจ้งแล้ว' }] },
];

const emptyRow = (who: string): CallerResultRow => ({
  who,
  kept: [],
  notLogged: [],
  notOk: [],
  ok: [],
  notBooked: [],
  booked: [],
  attPending: [],
  noShow: [],
  showed: [],
  notInformed: [],
  informed: [],
});

function place(row: CallerResultRow, f: RecruitAppFact, id: string) {
  row.kept.push(id);
  if (f.logOk === true) {
    row.ok.push(id);
    if (!f.appointmentAt) {
      row.notBooked.push(id);
      return;
    }
    row.booked.push(id);
    if (f.attendance === 'showed') {
      row.showed.push(id);
      (f.informed ? row.informed : row.notInformed).push(id);
    } else if (f.attendance === 'no_show') row.noShow.push(id);
    else row.attPending.push(id);
  } else if (f.logOk === false) row.notOk.push(id);
  else row.notLogged.push(id);
}

export type AiResultRow = { sent: string[]; notCalled: string[]; unreachable: string[]; reached: string[]; notInterested: string[]; interested: string[] };
const AI_REACHED = new Set(['said_yes', 'said_no', 'not_yet', 'talked_unclear']);

export function buildCallerResults(cohort: readonly RecruitAppFact[]): { rows: CallerResultRow[]; total: CallerResultRow; ai: AiResultRow } {
  const by = new Map<string, CallerResultRow>();
  const total = emptyRow('รวมคนโทร');
  const ai: AiResultRow = { sent: [], notCalled: [], unreachable: [], reached: [], notInterested: [], interested: [] };
  for (const f of cohort) {
    if (!f.id) continue;
    const who = (f.claimedBy ?? '').trim();
    if (!who) {
      ai.sent.push(f.id);
      if (!f.calledByAi) ai.notCalled.push(f.id);
      else if (f.aiAnswer && AI_REACHED.has(f.aiAnswer)) {
        ai.reached.push(f.id);
        (f.aiAnswer === 'said_yes' ? ai.interested : ai.notInterested).push(f.id);
      } else ai.unreachable.push(f.id);
      continue;
    }
    const row = by.get(who) ?? emptyRow(who);
    place(row, f, f.id);
    place(total, f, f.id);
    by.set(who, row);
  }
  const rows = [...by.values()].sort((a, b) => b.kept.length - a.kept.length || a.who.localeCompare(b.who, 'th'));
  return { rows, total, ai };
}
