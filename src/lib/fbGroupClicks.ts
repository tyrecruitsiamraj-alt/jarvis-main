/**
 * ═══ กลุ่ม Facebook: คลิก → กรอก → AI สนใจ → นัดได้ → มา (เจ้าของ 10 พ.ย. 2569) ═══
 * > *"Tracking link หน่อยว่าคนคลิกเข้ามาเท่าไหร่ จะได้รู้ด้วยกลุ่มไหนคนเข้ามาดูงานเราเยอะ ต่อไปเวลาเลือกกลุ่ม Auto post ได้เลือกกลุ่มถูก"*
 *
 * - กลุ่ม = ชื่อกลุ่มในป้ายลิงก์ (`funnelSubOf`) ของช่องทาง Facebook Group — ตัวแยกเดียวกับตาราง "รายชื่อมาจากไหน ไปถึงไหน"
 *   ⇒ เลขกรอก/สนใจ/นัด/มา ของกลุ่ม = แถวกลุ่มเดียวกันในตารางนั้นพอดี
 * - คลิก = เปิดลิงก์ของกลุ่มในช่วง (`linkClicks`) · null = นับไม่ได้ ("—" ไม่ใช่ 0) · กลุ่มที่มีคลิกแต่ไม่มีคนกรอกก็ขึ้น (กรอก 0)
 * - เรียงคลิกมากก่อน แล้วกรอกมากก่อน · pure — เทสต์ `tests/api/fbGroupClicks2569-11-10.test.ts`
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { funnelChannelOf, funnelRowOf, funnelSubOf, NO_SUB, type ChannelFunnelRow } from '@/lib/channelFunnel';

export const FB_GROUP_CHANNEL = 'Facebook Group';

export type FbGroupClickRow = ChannelFunnelRow & { clicks: number | null };

const labelFact = (label: string) => ({ channelLabel: label, referralSource: null, sourceChannel: null, sourceSub: null }) as unknown as RecruitAppFact;

export function buildFbGroupClickRows(
  cohort: readonly RecruitAppFact[],
  linkClicks: ReadonlyArray<{ label: string; clicks: number }> | null | undefined,
): { rows: FbGroupClickRow[]; totalClicks: number | null } {
  const byGroup = new Map<string, RecruitAppFact[]>();
  for (const f of cohort) {
    if (funnelChannelOf(f) !== FB_GROUP_CHANNEL) continue;
    const g = funnelSubOf(f);
    byGroup.set(g, [...(byGroup.get(g) ?? []), f]);
  }
  const clicks = new Map<string, number>();
  for (const c of linkClicks ?? []) {
    const f = labelFact(c.label);
    if (funnelChannelOf(f) !== FB_GROUP_CHANNEL) continue;
    const g = funnelSubOf(f);
    clicks.set(g, (clicks.get(g) ?? 0) + c.clicks);
    if (!byGroup.has(g)) byGroup.set(g, []);
  }
  const known = linkClicks != null;
  const rows: FbGroupClickRow[] = [...byGroup.entries()]
    .map(([g, list]) => ({ ...funnelRowOf(g, list), clicks: known ? (clicks.get(g) ?? 0) : null }))
    // "ไม่ระบุชื่อ" (ลิงก์ Facebook Group เก่าที่ไม่ได้เลือกกลุ่ม) อยู่ท้ายเสมอ
    .sort((a, b) => Number(a.channel === NO_SUB) - Number(b.channel === NO_SUB) || (b.clicks ?? 0) - (a.clicks ?? 0) || (b.names.value ?? 0) - (a.names.value ?? 0));
  const totalClicks = known ? [...clicks.values()].reduce((s, n) => s + n, 0) : null;
  return { rows, totalClicks };
}
