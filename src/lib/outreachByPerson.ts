/**
 * ═══ การสั่งงานรายคน (เจ้าของ 19 พ.ย. 2569 "ข้อมูลแค่นี้แบบ Action ไม่ได้หนิว่า Autopost เท่าไหร่ โพสต์เองเท่าไหร่
 * แล้วโพสต์เองอะเป็น Genlink หรือ โพสต์" · Choice ในการสั่งงาน คนละแถว) ═══
 * Autopost / Scrap = งานรายคน (`staff-activity` · ครั้งที่สั่ง / ใบที่สั่ง) · โพสต์เอง = ลิงก์รายลิงก์ (`ManualLinkRow` ชุดเดียวกับแผงโพสต์เอง)
 * แยก Gen link (ยังไม่วางลิงก์โพสต์) / โพสต์แล้ว · คลิก · กรอก ของลิงก์โพสต์เอง · จับคู่คนด้วยชื่อที่ขึ้นบนจอ (ชื่อเล่น)
 */
import type { ManualLinkRow } from './jobPostActions';
import type { StaffActivityRow } from './staffActivity';
import type { RecruitAppFact } from './recruitOverviewTypes';
import { bringerOf } from './channelFunnel';
import { buildIntakeFlow } from './recruitIntakeFlow';

/**
 * รายชื่อของคนนั้นไปถึงไหน (เจ้าของ 19 พ.ย. 2569 "เจมส์รายชื่อทั้งหมดเท่าไหร่ ไปจนถึงนัดแล้วมาเนี่ยเท่าไหร่")
 * คน = ใครเอาเข้ามา (`bringerOf` ตัวเดียวกับเรื่องเล่ารายชื่อ) · ขั้น = กล่องของรายชื่อเข้ามาไปถึงไหน (`buildIntakeFlow`) — นิยามเดียวกัน
 */
export type PersonFunnel = { names: string[]; interested: string[]; booked: string[]; showed: string[] };
export const PERSON_FUNNEL_KEYS = ['names', 'interested', 'booked', 'showed'] as const;

/** contacts/appts = งานที่คนนี้ลงเอง (ลงผลติดต่อ · ลงนัด) จากงานรายคน · userId = มีบัญชีในระบบ (กดดูรายวันได้) — รวมตารางงานรายคนเข้ามา (เจ้าของ 19 พ.ย. 2569 Choice "รวมเป็นตารางเดียว") */
export type OutreachPerson = { name: string; userId: string | null; autopost: number; scrap: number; gen: number; posted: number; clicks: number; applicants: number; contacts: number; appts: number } & PersonFunnel;

function funnelOf(list: readonly RecruitAppFact[]): PersonFunnel {
  const boxes = buildIntakeFlow(list);
  const box = (k: string) => boxes.find((b) => b.key === k);
  return {
    names: box('apps')?.ids ?? [],
    interested: box('follow')?.ids ?? [],
    booked: box('booked')?.ids ?? [],
    showed: box('booked')?.rows.find((r) => r.key === 'showed')?.ids ?? [],
  };
}

export function outreachByPerson(staff: readonly StaffActivityRow[], links: readonly ManualLinkRow[], cohort: readonly RecruitAppFact[] = []): OutreachPerson[] {
  const m = new Map<string, OutreachPerson>();
  const at = (name: string) => {
    const k = name.trim() || 'ไม่รู้';
    let p = m.get(k);
    if (!p) m.set(k, (p = { name: k, userId: null, autopost: 0, scrap: 0, gen: 0, posted: 0, clicks: 0, applicants: 0, contacts: 0, appts: 0, names: [], interested: [], booked: [], showed: [] }));
    return p;
  };
  const byBringer = new Map<string, RecruitAppFact[]>();
  for (const f of cohort) byBringer.set(bringerOf(f), [...(byBringer.get(bringerOf(f)) ?? []), f]);
  for (const [name, list] of byBringer) Object.assign(at(name), funnelOf(list));
  for (const r of staff) {
    if (!r.autopost && !r.scrap && !r.contacts && !r.appts) continue;
    const p = at(r.name);
    p.userId = p.userId ?? r.userId;
    p.autopost += r.autopost;
    p.scrap += r.scrap;
    p.contacts += r.contacts;
    p.appts += r.appts;
  }
  for (const l of links) {
    const p = at(l.by);
    if (l.posted) p.posted += 1;
    else p.gen += 1;
    p.clicks += l.clicks;
    p.applicants += l.applicants;
  }
  const work = (p: OutreachPerson) => p.autopost + p.scrap + p.gen + p.posted + p.contacts + p.appts;
  return [...m.values()].sort((a, b) => b.names.length - a.names.length || work(b) - work(a) || a.name.localeCompare(b.name, 'th'));
}

export type OutreachNumbers = { autopost: number; scrap: number; gen: number; posted: number; clicks: number; applicants: number; contacts: number; appts: number };
export function outreachTotals(list: readonly OutreachPerson[]): OutreachNumbers & PersonFunnel {
  const t: OutreachNumbers & PersonFunnel = { autopost: 0, scrap: 0, gen: 0, posted: 0, clicks: 0, applicants: 0, contacts: 0, appts: 0, names: [], interested: [], booked: [], showed: [] };
  for (const p of list) {
    t.autopost += p.autopost;
    t.scrap += p.scrap;
    t.gen += p.gen;
    t.posted += p.posted;
    t.clicks += p.clicks;
    t.applicants += p.applicants;
    t.contacts += p.contacts;
    t.appts += p.appts;
    for (const k of PERSON_FUNNEL_KEYS) t[k] = [...t[k], ...p[k]];
  }
  return t;
}
