/**
 * ═══ การ์ดกดลงลึกของหน้าภาพรวม — ทั้ง 4 แท็บ (เจ้าของ 21 ต.ค. 2569 · ไอเดียเพื่อนเจ้าของ) ═══
 * > *"ใบขอเข้ามาทั้งหมดเท่าไหร่ · กดเข้าไปค่อยโชว์ว่าประกาศแล้วเท่าไหร่ ยังไม่ประกาศเท่าไหร่ · กดที่ประกาศเห็นว่ามีคนกรอกมาเท่าไหร่
 * > ยังไม่กรอกเท่าไหร่ · กดที่มีคนกรอกโชว์ใบขอ … ก็เห็นว่ามีชื่ออะไรบ้าง"* · *"ทั้ง 4 tab ทำแบบนั้นเลย"*
 *
 * 🔴 ลูกของทุกชั้นรวมกันเท่าแม่เสมอ (มีเทสต์) — คนอ่านบวกลบได้เอง
 * ปลายทาง: ใบขอ = รายการใบขอ (กดใบที่มีคนกรอก = รายชื่อ) · ผู้สมัคร = รายชื่อ (id ใบสมัคร)
 * ตัวเลขชุดเดียวกับการ์ดเดิม (เงื่อนไขเดียวกับ `totalsOf`) — ตรรกะล้วน
 */
import type { ToneKey } from './designTokens';
import { isAiCalledReached, isAiSaidYes, isFollowedReached, isStaffFollowed } from './recruitOverview';
import type { RecruitAppFact, RecruitRequestItem } from './recruitOverviewTypes';
import type { OverviewTabId } from './recruitOverviewTabs';

export type DrillNode = {
  key: string;
  label: string;
  tone: ToneKey;
  unit: 'ใบ' | 'คน';
  count: number;
  /** ปลายทางผู้สมัคร — id ใบสมัคร */
  ids?: string[];
  /** ปลายทางใบขอ */
  requests?: RecruitRequestItem[];
  /** นับอย่างเดียว กดไม่ได้ — ใบที่จบแล้ว ("ถ้าปิดก็คือปิด" ห้ามโชว์รายการ) */
  countOnly?: boolean;
  children?: DrillNode[];
};

const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id).filter((x): x is string => !!x);

function people(key: string, label: string, tone: ToneKey, list: readonly RecruitAppFact[], children?: DrillNode[]): DrillNode {
  return { key, label, tone, unit: 'คน', count: list.length, ids: idsOf(list), ...(children ? { children } : {}) };
}

function reqs(key: string, label: string, tone: ToneKey, list: readonly RecruitRequestItem[], children?: DrillNode[]): DrillNode {
  return { key, label, tone, unit: 'ใบ', count: list.length, requests: [...list], ...(children ? { children } : {}) };
}

const split = <T,>(list: readonly T[], p: (x: T) => boolean): [T[], T[]] => {
  const a: T[] = [];
  const b: T[] = [];
  for (const x of list) (p(x) ? a : b).push(x);
  return [a, b];
};

/** ต้นไม้ของแท็บ — `cohort` = รายชื่อที่กรอกในช่วง (กรองวันในสัปดาห์แล้ว) · `requests` = ใบขอของช่วง */
export function drillTreeOf(tab: OverviewTabId, cohort: readonly RecruitAppFact[], requests: readonly RecruitRequestItem[] | null | undefined): DrillNode | null {
  switch (tab) {
    case 'requests': {
      if (!requests) return null;
      // ชุดเดียวกับทีม Online "ส่งไปประกาศ" (21 ต.ค. 2569 เจ้าของโหวตข้อ B): ประกาศแล้ว + ยังไม่ประกาศ (ใบยังเปิด) + ไม่ได้ประกาศ (จบไปแล้ว)
      const [released, notReleased] = split(requests, (r) => r.released);
      const [stillOpen, ended] = split(notReleased, (r) => r.open);
      const [withApps, noApps] = split(released, (r) => r.applications > 0);
      return reqs('total', 'ใบขอเข้ามา', 'neutral', requests, [
        reqs('released', 'ประกาศแล้ว', 'success', released, [
          reqs('withApps', 'มีคนกรอก', 'info', withApps),
          reqs('noApps', 'ยังไม่มีคนกรอก', 'danger', noApps),
        ]),
        reqs('notReleased', 'ยังไม่ประกาศ (ใบยังเปิด)', 'warn', stillOpen),
        { key: 'ended', label: 'ไม่ได้ประกาศ (จบไปแล้ว)', tone: 'neutral', unit: 'ใบ', count: ended.length, countOnly: true },
      ]);
    }
    case 'apps': {
      const [ai, noAi] = split(cohort, (f) => f.calledByAi);
      const [reached, notReached] = split(ai, isAiCalledReached);
      return people('names', 'กรอกเข้ามา', 'neutral', cohort, [
        people('ai', 'AI โทรแล้ว', 'info', ai, [
          people('reached', 'ติดต่อได้', 'success', reached),
          people('notReached', 'ติดต่อไม่ได้', 'danger', notReached),
        ]),
        people('noAi', 'AI ยังไม่โทร', 'neutral', noAi),
      ]);
    }
    case 'staff': {
      const yes = cohort.filter(isAiSaidYes);
      const [followed, waiting] = split(yes, isStaffFollowed);
      const [reached, notReached] = split(followed, isFollowedReached);
      return people('yes', 'ตอบ AI ว่าสนใจ', 'info', yes, [
        people('followed', 'คนโทรต่อแล้ว', 'success', followed, [
          people('reached', 'ติดต่อได้', 'success', reached),
          people('notReached', 'ยังติดต่อไม่ได้', 'danger', notReached),
        ]),
        people('waiting', 'ยังไม่มีคนโทรต่อ', 'warn', waiting),
      ]);
    }
    case 'appt': {
      const appt = cohort.filter((f) => !!f.appointmentAt);
      return people('appointed', 'นัดหมาย', 'info', appt, [
        people('showed', 'มา', 'success', appt.filter((f) => f.attendance === 'showed')),
        people('noShow', 'ไม่มา', 'danger', appt.filter((f) => f.attendance === 'no_show')),
        people('rescheduled', 'เลื่อนนัด', 'warn', appt.filter((f) => f.attendance === 'rescheduled')),
        people('pending', 'รอผล', 'neutral', appt.filter((f) => !f.attendance)),
      ]);
    }
  }
}

/** หาโหนดตามเส้นทาง key (ชั้นบนสุดไม่อยู่ในเส้นทาง) · เส้นทางผิด = ตัดที่ชั้นที่ยังเจอ */
export function nodeAt(root: DrillNode, path: readonly string[]): { node: DrillNode; trail: DrillNode[] } {
  const trail: DrillNode[] = [root];
  let node = root;
  for (const k of path) {
    const next = node.children?.find((c) => c.key === k);
    if (!next) break;
    trail.push(next);
    node = next;
  }
  return { node, trail };
}
