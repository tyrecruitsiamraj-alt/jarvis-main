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
