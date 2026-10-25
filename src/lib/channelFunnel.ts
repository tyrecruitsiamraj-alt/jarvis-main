/**
 * ═══ ช่องทาง → แจ้งเข้า (เจ้าของ 19 ต.ค. 2569 — หน้าภาพรวมงานสรรหา ทีม Online) ═══
 *
 * เจ้าของ: *"บอกไปด้วยว่ามาจากช่องทางไหน เช่น facebook ad 200 สนใจ 100 คนโทรต่อสนใจ 50 นัดได้ 25 มา 10"*
 * + *"จับได้ถึงแจ้งเข้านู่นอะ"*
 *
 * - แถว = ช่องทาง · คอลัมน์ = ขั้นของ `buildRecruitJourney` (ตัวเดียวกับการ์ด "รายชื่อที่กรอกมา" ⇒ แถวรวมเลขตรงกัน)
 * - แจ้งเข้า = เบอร์นี้มีใบแจ้งเข้า ERP ที่ไม่ยกเลิก **ตั้งแต่วันกรอกใบ** (นับทุกรายชื่อของช่องทาง ไม่ต้องผ่านนัด
 *   เพราะผลมา/ไม่มายังลงไม่ครบ) · `informed` null = อ่าน ERP ไม่ได้ ⇒ ขึ้น "—" ห้ามขึ้น 0
 * - ใบที่ดึงมาจาก iRecruit ไม่มีช่องทางในใบเรา ⇒ ใช้ช่องทางที่ลงทะเบียนใน iRecruit (`sourceChannel`)
 * ไฟล์นี้ pure — เทสต์ `tests/api/channelFunnel2569-10-19.test.ts`
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { mainChannelOf } from '@/lib/channelPlacement';
import { buildRecruitJourney, isFromIrecruit } from '@/lib/recruitJourney';
import { REFERRAL_SOURCE_LABEL, type ApplicationReferralSource } from '@/lib/publicApplicationsApi';

export const IRECRUIT_UNKNOWN_CHANNEL = 'iRecruit ไม่รู้ช่องทาง';

/** ช่องทางของใบ — ชื่อชุดเดียวกับ "ช่องทางที่ได้คนลงงาน" (`mainChannelOf`) */
export function funnelChannelOf(f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource' | 'sourceChannel'>): string {
  if (isFromIrecruit(f)) {
    if (f.sourceChannel) return f.sourceChannel;
    // "iRecruit · Line" = ช่องทางที่ติดมากับใบ
    const tail = (f.channelLabel ?? '').split('·')[1]?.trim();
    return tail ? mainChannelOf(tail, null) : IRECRUIT_UNKNOWN_CHANNEL;
  }
  const label = f.channelLabel?.trim();
  if (label) return mainChannelOf(label, null);
  const src = f.referralSource as ApplicationReferralSource | null;
  return (src && REFERRAL_SOURCE_LABEL[src]) || 'ไม่ระบุ';
}

export type FunnelCellKey = 'names' | 'aiYes' | 'staffOk' | 'booked' | 'showed' | 'informed';
export type FunnelCell = { value: number | null; ids: string[] };
export type ChannelFunnelRow = { channel: string } & Record<FunnelCellKey, FunnelCell>;

export const FUNNEL_COLUMNS: ReadonlyArray<{ key: FunnelCellKey; label: string }> = [
  { key: 'names', label: 'รายชื่อ' },
  { key: 'aiYes', label: 'AI สนใจ' },
  { key: 'staffOk', label: 'คนโทรต่อสำเร็จ' },
  { key: 'booked', label: 'นัดได้' },
  { key: 'showed', label: 'มา' },
  { key: 'informed', label: 'แจ้งเข้า' },
];

const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id).filter((v): v is string => Boolean(v));

function rowOf(channel: string, list: readonly RecruitAppFact[]): ChannelFunnelRow {
  const steps = buildRecruitJourney(list);
  const partOf = (step: string, key: string): FunnelCell => {
    const p = steps.find((s) => s.key === step)?.parts.find((x) => x.key === key);
    return { value: p?.value ?? 0, ids: p?.ids ?? [] };
  };
  const unknownInform = list.some((f) => f.informed === null || f.informed === undefined);
  const informed = list.filter((f) => f.informed === true);
  return {
    channel,
    names: { value: list.length, ids: idsOf(list) },
    aiYes: partOf('ai', 'yes'),
    staffOk: partOf('staff', 'ok'),
    booked: partOf('appointment', 'booked'),
    showed: partOf('attendance', 'showed'),
    informed: unknownInform && informed.length === 0 ? { value: null, ids: [] } : { value: informed.length, ids: idsOf(informed) },
  };
}

/** แถวต่อช่องทาง (รายชื่อมากก่อน) + แถวรวม · ไม่มีรายชื่อ = แถวรวม 0 (ตารางไม่หาย) */
export function buildChannelFunnel(cohort: readonly RecruitAppFact[]): { rows: ChannelFunnelRow[]; total: ChannelFunnelRow } {
  const by = new Map<string, RecruitAppFact[]>();
  for (const f of cohort) {
    const k = funnelChannelOf(f);
    const list = by.get(k) ?? [];
    list.push(f);
    by.set(k, list);
  }
  const rows = [...by.entries()]
    .map(([k, list]) => rowOf(k, list))
    .sort((a, b) => (b.names.value ?? 0) - (a.names.value ?? 0) || a.channel.localeCompare(b.channel, 'th'));
  return { rows, total: rowOf('รวม', cohort) };
}

/**
 * ═══ ช่องทาง 3 ชั้น กดลงไปเรื่อย ๆ (เจ้าของ 25 ต.ค. 2569) ═══
 * > *"แบ่งง่าย ๆ ก่อน 4 ช่องทาง facebook · Tiktok · Webjob · Offline แล้วบอกยอดรวมก่อน · กดไปค่อยเจอ facebook Group เท่าไหร่
 * > facebook ads เท่าไหร่ · กด facebook group ค่อยขึ้นชื่อกลุ่ม"* + *"ช่องทางที่น้อยอาจติดต่อสำเร็จมากกว่า"* (% เทียบรายชื่อของช่องทาง)
 * Choice: LINE → Webjob · พนักงานแนะนำ/พนักงานเก่า → Offline · ไม่รู้ช่องทาง/อื่น ๆ → แถวท้าย (ผลรวมทุกชั้นเท่ายอดทั้งหมด)
 */
export type FunnelGroupKey = 'facebook' | 'tiktok' | 'webjob' | 'offline' | 'unknown';
export const FUNNEL_GROUP_LABEL: Record<FunnelGroupKey, string> = {
  facebook: 'Facebook',
  tiktok: 'TikTok',
  webjob: 'Webjob',
  offline: 'Offline',
  unknown: 'อื่น ๆ · ไม่รู้ช่องทาง',
};
const GROUP_ORDER: FunnelGroupKey[] = ['facebook', 'tiktok', 'webjob', 'offline', 'unknown'];
const OFFLINE_CH = /ป้าย|ใบปลิว|แนะนำ|เพื่อน|ญาติ|ผู้ประสานงาน|จนท\.|เจ้าหน้าที่|พนักงานเก่า|โอนมา|สำนักงานใหญ่|walk\s*in|call\s*in/i;
const WEBJOB_CH = /jobthai|jobbkk|jobsdb|job\s*db|internet|google|เว็บ|^line\b|line\s*oa|line\s*ai/i;

export function funnelGroupOf(channel: string): FunnelGroupKey {
  const ch = channel.trim();
  if (!ch || ch === IRECRUIT_UNKNOWN_CHANNEL || /^ไม่ระบุ$|ไม่รู้ช่องทาง/.test(ch)) return 'unknown';
  if (/^facebook/i.test(ch)) return 'facebook';
  if (/^tiktok/i.test(ch)) return 'tiktok';
  if (WEBJOB_CH.test(ch)) return 'webjob';
  if (OFFLINE_CH.test(ch)) return 'offline';
  return 'unknown';
}

export const NO_SUB = 'ไม่ระบุชื่อ';
/** ชื่อกลุ่ม/เพจย่อย — ลิงก์ของเรา "Facebook Group · ชื่อกลุ่ม" · ใบจาก iRecruit ใช้กลุ่มย่อยที่ลงทะเบียน · ไม่มี = ไม่ระบุชื่อ */
export function funnelSubOf(f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource' | 'sourceSub'>): string {
  if (isFromIrecruit(f)) return f.sourceSub?.trim() || NO_SUB;
  const tail = (f.channelLabel ?? '').split('·').slice(1).join('·').trim();
  return tail || NO_SUB;
}

export type FunnelNode = ChannelFunnelRow & { key: string; children?: FunnelNode[] };
const byNames = (a: FunnelNode, b: FunnelNode) => (b.names.value ?? 0) - (a.names.value ?? 0) || a.channel.localeCompare(b.channel, 'th');

/** ต้นไม้ 3 ชั้น: กลุ่ม (4 + ไม่รู้) → ช่องทาง → ชื่อกลุ่ม/เพจ · ทุกชั้นบวกกันเท่ารวม · กลุ่มว่างยังอยู่ (เลข 0) */
export function buildChannelFunnelTree(cohort: readonly RecruitAppFact[]): { groups: FunnelNode[]; total: ChannelFunnelRow } {
  const groups = new Map<FunnelGroupKey, Map<string, Map<string, RecruitAppFact[]>>>();
  for (const g of GROUP_ORDER) groups.set(g, new Map());
  for (const f of cohort) {
    const ch = funnelChannelOf(f);
    const chans = groups.get(funnelGroupOf(ch))!;
    const subs = chans.get(ch) ?? new Map<string, RecruitAppFact[]>();
    const sub = funnelSubOf(f);
    subs.set(sub, [...(subs.get(sub) ?? []), f]);
    chans.set(ch, subs);
  }
  const out: FunnelNode[] = GROUP_ORDER.map((g) => {
    const chans = groups.get(g)!;
    const chanNodes: FunnelNode[] = [...chans.entries()]
      .map(([ch, subs]) => {
        const all = [...subs.values()].flat();
        const subNodes = [...subs.entries()].map(([name, list]) => ({ ...rowOf(name, list), key: `${ch}|${name}` })).sort(byNames);
        // ชั้นชื่อกลุ่มมีแค่ "ไม่ระบุชื่อ" แถวเดียว = ไม่มีอะไรให้กดลง
        const useful = subNodes.length > 1 || (subNodes[0] && subNodes[0].channel !== NO_SUB);
        return { ...rowOf(ch, all), key: ch, ...(useful ? { children: subNodes } : {}) };
      })
      .sort(byNames);
    const all = chanNodes.flatMap((c) => [...(chans.get(c.key)?.values() ?? [])].flat());
    return { ...rowOf(FUNNEL_GROUP_LABEL[g], all), key: g, children: chanNodes };
  });
  // "อื่น ๆ · ไม่รู้ช่องทาง" อยู่ท้ายเสมอ · 4 กลุ่มหลักเรียงตามที่เจ้าของบอก
  return { groups: out, total: rowOf('รวม', cohort) };
}
