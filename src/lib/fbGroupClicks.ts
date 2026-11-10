/**
 * ═══ กลุ่ม Facebook: คนคลิกลิงก์แล้วกรอกเท่าไหร่ (เจ้าของ 10 พ.ย. 2569) ═══
 * > *"Tracking link หน่อยว่าคนคลิกเข้ามาเท่าไหร่ จะได้รู้ด้วยกลุ่มไหนคนเข้ามาดูงานเราเยอะ ต่อไปเวลาเลือกกลุ่ม Auto post ได้เลือกกลุ่มถูก"*
 * > *"คลิก 0 กรอก 8 ย้อนแย้งปะ"* ⇒ Choice "แบบ 1 ยอดทั้งหมด ใช้ได้เลย" — คลิกกับกรอกฐานเดียวกัน: ทั้งหมดตั้งแต่สร้างลิงก์ (ไม่ตามปฏิทิน)
 *
 * - กลุ่ม = ชื่อกลุ่มในป้ายลิงก์ (`funnelSubOf`) ตัวแยกเดียวกับตาราง "รายชื่อมาจากไหน ไปถึงไหน"
 * - คลิก = `hit_count` สะสม · กรอก = ใบสมัครที่มาจากลิงก์ (id ไว้กดดูชื่อ) · กรอกต่อคลิก = กรอก ÷ คลิก
 * - เรียงคลิกมากก่อน · "ไม่ระบุชื่อ" ท้าย · pure — เทสต์ `tests/api/fbGroupClicks2569-11-10.test.ts`
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { funnelChannelOf, funnelSubOf, NO_SUB } from '@/lib/channelFunnel';

export const FB_GROUP_CHANNEL = 'Facebook Group';

export type FbGroupClickRow = { group: string; clicks: number; appIds: string[]; ratePct: number | null };

const labelFact = (label: string) => ({ channelLabel: label, referralSource: null, sourceChannel: null, sourceSub: null }) as unknown as RecruitAppFact;

export function buildFbGroupClickRows(
  links: ReadonlyArray<{ label: string; clicks: number; appIds: readonly string[] }> | null | undefined,
): { rows: FbGroupClickRow[]; totalClicks: number; totalApps: number } | null {
  if (!links) return null;
  const by = new Map<string, { clicks: number; ids: Set<string> }>();
  for (const l of links) {
    const f = labelFact(l.label);
    if (funnelChannelOf(f) !== FB_GROUP_CHANNEL) continue;
    const g = funnelSubOf(f);
    const cur = by.get(g) ?? { clicks: 0, ids: new Set<string>() };
    cur.clicks += l.clicks;
    for (const id of l.appIds) cur.ids.add(id);
    by.set(g, cur);
  }
  const rows = [...by.entries()]
    .map(([group, v]) => ({ group, clicks: v.clicks, appIds: [...v.ids], ratePct: v.clicks > 0 ? Math.round((v.ids.size / v.clicks) * 100) : null }))
    .sort((a, b) => Number(a.group === NO_SUB) - Number(b.group === NO_SUB) || b.clicks - a.clicks || b.appIds.length - a.appIds.length);
  return { rows, totalClicks: rows.reduce((s, r) => s + r.clicks, 0), totalApps: rows.reduce((s, r) => s + r.appIds.length, 0) };
}
