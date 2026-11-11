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
  // ป้ายจากช่อง "ทราบข่าวจาก" ผ่านตัวตั้งชื่อเดียวกัน — ชื่อตรงกับช่องทางหลัก/รอง ("TikTok" → "Tiktok" · 30 ต.ค. 2569)
  const picked = src ? REFERRAL_SOURCE_LABEL[src] : null;
  return picked ? mainChannelOf(picked, null) : 'ไม่ระบุ';
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

/** แถวเลข 0 ทุกช่อง — กลุ่มที่มีคนคลิกแต่ไม่มีคนกรอกในช่วง (ตารางช่องทาง · 11 พ.ย. 2569) */
export const emptyFunnelRow = (channel: string): ChannelFunnelRow => rowOf(channel, []);

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
  tiktok: 'Tiktok',
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
/** ส่วนของป้ายที่เป็นชื่อช่องทาง ไม่ใช่ชื่อกลุ่ม/เพจ ("Facebook · Facebook Group" · "Webjob · JOBBKK" — ทุกส่วนเป็นช่องทาง) */
const isChannelPart = (p: string) => /^(facebook|tiktok|line|irecruit|webjob|offline)\b/i.test(p) || mainChannelOf(p, null) !== p;
/**
 * ชื่อกลุ่ม/เพจย่อย — ลิงก์ของเรา "Facebook Group · ชื่อกลุ่ม" · ใบจาก iRecruit ใช้กลุ่มย่อยที่ลงทะเบียน · ไม่มี = ไม่ระบุชื่อ
 * 29–30 ต.ค. 2569: ข้ามส่วนที่เป็นชื่อช่องทาง (หลัก/รอง) — เดิม "Facebook · Facebook Group" ได้ชื่อกลุ่มเป็น "Facebook Group"
 */
export function funnelSubOf(f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource' | 'sourceSub' | 'sourceChannel'>): string {
  if (isFromIrecruit(f)) return f.sourceSub?.trim() || NO_SUB;
  const channel = funnelChannelOf(f);
  const parts = (f.channelLabel ?? '').split('·').map((p) => p.trim()).filter(Boolean);
  let i = 0;
  while (i < parts.length && (isChannelPart(parts[i]) || parts[i].toLowerCase() === channel.toLowerCase())) i += 1;
  return parts.slice(i).join(' · ') || NO_SUB;
}

/** Facebook ที่ไม่รู้ว่ากลุ่ม/เพจ/Ads (คนกรอกเลือก "Facebook" เอง ไม่ได้มาจากลิงก์) — เจ้าของ 29 ต.ค. 2569 Choice "ขึ้นเป็น ไม่ระบุ" */
export const FACEBOOK_UNKNOWN = 'Facebook ไม่ระบุ';
/**
 * ช่องทางรองของตารางแยกช่องทาง (ใต้ช่องทางหลัก) — `funnelChannelOf` แต่ Facebook เปล่าเป็น "Facebook ไม่ระบุ"
 * ใต้ Facebook จึงมีแค่ กลุ่ม · เพจ · Ads · ไม่ระบุ ("ควรมีแค่ facebook Group Facebook page facebook ads")
 */
export function funnelSubChannelOf(f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource' | 'sourceChannel'>): string {
  const ch = funnelChannelOf(f);
  return /^facebook$/i.test(ch) ? FACEBOOK_UNKNOWN : ch;
}

const MAIN_GROUP: Record<string, FunnelGroupKey> = { facebook: 'facebook', tiktok: 'tiktok', webjob: 'webjob', offline: 'offline' };
/**
 * ช่องทางหลัก + รองของใบ (ตารางแยกช่องทางทุกตัวใช้ตัวนี้ที่เดียว) — ป้าย "หลัก · รอง" จากตั้งค่าช่องทาง ใช้หลักตามตั้งค่า
 * (เจ้าของ 30 ต.ค. 2569 "เอาชื่อเดียวกันกับช่องทางพวก ช่องทางหลัก ช่องทางรอง") · ป้ายเก่า/ไม่มีหลัก = เดาจากชื่อ (`funnelGroupOf`)
 */
export function funnelPlaceOf(f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource' | 'sourceChannel'>): { group: FunnelGroupKey; channel: string } {
  const channel = funnelSubChannelOf(f);
  const parts = (f.channelLabel ?? '').split('·').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const head = parts[0] === 'irecruit' ? '' : (parts[0] ?? '');
  return { group: (parts.length > 1 && MAIN_GROUP[head]) || funnelGroupOf(channel), channel };
}

export type FunnelNode = ChannelFunnelRow & { key: string; children?: FunnelNode[] };
const byNames = (a: FunnelNode, b: FunnelNode) => (b.names.value ?? 0) - (a.names.value ?? 0) || a.channel.localeCompare(b.channel, 'th');

/** ชั้นใต้ชื่อกลุ่ม: มาจาก Autopost หรือโพสต์เอง (เจ้าของ 9 พ.ย. 2569) — ตัวเดียวของตารางช่องทางทุกตัว */
export const POST_SOURCE_LABEL = { autopost: 'Autopost', manual: 'โพสต์เอง', none: 'ไม่ได้มาจากลิงก์' } as const;
export type PostSourceKey = keyof typeof POST_SOURCE_LABEL;
export const postSourceKeyOf = (f: Pick<RecruitAppFact, 'postSource'>): PostSourceKey => f.postSource ?? 'none';
/** แยกรายชื่อตามทางที่มา · ไม่มีใครมาจากลิงก์ Autopost/โพสต์เอง = null (ไม่มีอะไรให้กดลง) */
export function splitByPostSource<T extends Pick<RecruitAppFact, 'postSource'>>(list: readonly T[]): Array<[PostSourceKey, T[]]> | null {
  if (!list.some((f) => f.postSource)) return null;
  const by = new Map<PostSourceKey, T[]>();
  for (const f of list) by.set(postSourceKeyOf(f), [...(by.get(postSourceKeyOf(f)) ?? []), f]);
  return (['autopost', 'manual', 'none'] as const).filter((k) => by.has(k)).map((k) => [k, by.get(k)!]);
}

/** ต้นไม้: กลุ่ม (4 + ไม่รู้) → ช่องทาง → ชื่อกลุ่ม/เพจ → Autopost/โพสต์เอง · ทุกชั้นบวกกันเท่ารวม · กลุ่มว่างยังอยู่ (เลข 0) */
export function buildChannelFunnelTree(cohort: readonly RecruitAppFact[]): { groups: FunnelNode[]; total: ChannelFunnelRow } {
  const groups = new Map<FunnelGroupKey, Map<string, Map<string, RecruitAppFact[]>>>();
  for (const g of GROUP_ORDER) groups.set(g, new Map());
  for (const f of cohort) {
    const { group, channel: ch } = funnelPlaceOf(f);
    const chans = groups.get(group)!;
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
        const subNodes = [...subs.entries()]
          .map(([name, list]) => {
            const split = splitByPostSource(list);
            return {
              ...rowOf(name, list),
              key: `${ch}|${name}`,
              ...(split ? { children: split.map(([k, l]) => ({ ...rowOf(POST_SOURCE_LABEL[k], l), key: `${ch}|${name}|${k}` })) } : {}),
            };
          })
          .sort(byNames);
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

/* ═══ ใครหารายชื่อเข้ามา (เจ้าของ 9 พ.ย. 2569) ═══
 * > *"คิวโพสต์เอง ก็บอกว่าคนเข้ามาเป็นของคิวนะไม่ใช่พวกทีม ออนไลน์ … ใครทำก็คนนั้นได้จะได้วัดผลว่าใครมีรายชื่อเข้ามาเยอะ"*
 * คน (`bringer`) → วิธี (Autopost · โพสต์เอง · เพิ่มเอง/นำเข้า) → ช่องทาง/กลุ่ม · คอลัมน์ชุดเดียวกับตารางช่องทาง · ทุกชั้นบวกกันเท่ารวม */
export const NO_BRINGER_WEB = 'สมัครเองที่หน้าเว็บ';
export const NO_BRINGER_LINK = 'ลิงก์ไม่รู้ว่าใครสร้าง';
const IRECRUIT_BRINGER = /^irecruit$/i;
export function bringerOf(f: Pick<RecruitAppFact, 'bringer' | 'postSource'>): string {
  const b = (f.bringer ?? '').trim();
  if (b) return IRECRUIT_BRINGER.test(b) ? 'ดึงจาก iRecruit' : b;
  return f.postSource ? NO_BRINGER_LINK : NO_BRINGER_WEB;
}
export function bringMethodOf(f: Pick<RecruitAppFact, 'bringer' | 'postSource'>): string {
  if (f.postSource === 'autopost') return POST_SOURCE_LABEL.autopost;
  if (f.postSource === 'manual') return POST_SOURCE_LABEL.manual;
  if (IRECRUIT_BRINGER.test((f.bringer ?? '').trim())) return 'ดึงจาก iRecruit';
  return f.bringer ? 'เพิ่มเอง / นำเข้า' : NO_BRINGER_WEB;
}
/** ชั้นสุดท้าย: ชื่อกลุ่ม/เพจถ้ามี ไม่งั้นช่องทาง */
const placeNameOf = (f: RecruitAppFact): string => {
  const sub = funnelSubOf(f);
  return sub !== NO_SUB ? sub : funnelPlaceOf(f).channel;
};
export function buildBringerFunnelTree(cohort: readonly RecruitAppFact[]): { groups: FunnelNode[]; total: ChannelFunnelRow } {
  const by = new Map<string, Map<string, Map<string, RecruitAppFact[]>>>();
  for (const f of cohort) {
    const who = bringerOf(f);
    const how = bringMethodOf(f);
    const where = placeNameOf(f);
    const hows = by.get(who) ?? new Map<string, Map<string, RecruitAppFact[]>>();
    const wheres = hows.get(how) ?? new Map<string, RecruitAppFact[]>();
    wheres.set(where, [...(wheres.get(where) ?? []), f]);
    hows.set(how, wheres);
    by.set(who, hows);
  }
  const groups: FunnelNode[] = [...by.entries()]
    .map(([who, hows]) => {
      const howNodes: FunnelNode[] = [...hows.entries()]
        .map(([how, wheres]) => ({
          ...rowOf(how, [...wheres.values()].flat()),
          key: `${who}|${how}`,
          children: [...wheres.entries()].map(([where, l]) => ({ ...rowOf(where, l), key: `${who}|${how}|${where}` })).sort(byNames),
        }))
        .sort(byNames);
      return { ...rowOf(who, [...hows.values()].flatMap((w) => [...w.values()].flat())), key: who, children: howNodes };
    })
    .sort(byNames);
  return { groups, total: rowOf('รวม', cohort) };
}
