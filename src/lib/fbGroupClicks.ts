/**
 * ═══ กลุ่ม Facebook: คนคลิกลิงก์แล้วกรอกเท่าไหร่ (เจ้าของ 10 พ.ย. 2569) ═══
 * > *"Tracking link หน่อยว่าคนคลิกเข้ามาเท่าไหร่ จะได้รู้ด้วยกลุ่มไหนคนเข้ามาดูงานเราเยอะ ต่อไปเวลาเลือกกลุ่ม Auto post ได้เลือกกลุ่มถูก"*
 * > *"คลิก 0 กรอก 8 ย้อนแย้งปะ"* ⇒ Choice "แบบ 1 ยอดทั้งหมด ใช้ได้เลย" — คลิกกับกรอกฐานเดียวกัน: ทั้งหมดตั้งแต่สร้างลิงก์ (ไม่ตามปฏิทิน)
 *
 * - กลุ่ม = ชื่อกลุ่มในป้ายลิงก์ (`funnelSubOf`) ตัวแยกเดียวกับตาราง "รายชื่อมาจากไหน ไปถึงไหน"
 * - คลิก = `hit_count` สะสม · กรอก = ใบสมัครที่มาจากลิงก์ (id ไว้กดดูชื่อ) · กรอกต่อคลิก = กรอก ÷ คลิก
 * - เรียงกรอกมากก่อน (เจ้าของ 10 พ.ย. 2569 "คนที่กรอกเยอะสุด ขึ้นได้ไหม") กรอกเท่ากันคลิกมากก่อน · "ไม่ระบุชื่อ" ท้าย · pure — เทสต์ `tests/api/fbGroupClicks2569-11-10.test.ts`
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { emptyFunnelRow, funnelChannelOf, funnelSubOf, NO_SUB, type ChannelFunnelRow, type FunnelNode } from '@/lib/channelFunnel';

export const FB_GROUP_CHANNEL = 'Facebook Group';

/** `applyPresses` / `repeatBlocked` นับตั้งแต่ 10 พ.ย. 2569 (`FUNNEL_SINCE` ฝั่ง API) — คนละฐานกับคลิก/กรอกที่เป็นยอดทั้งหมด */
export type FbGroupClickRow = { group: string; clicks: number; appIds: string[]; ratePct: number | null; applyPresses: number; repeatBlocked: number };

const labelFact = (label: string) => ({ channelLabel: label, referralSource: null, sourceChannel: null, sourceSub: null }) as unknown as RecruitAppFact;

export function buildFbGroupClickRows(
  links: ReadonlyArray<{ label: string; clicks: number; appIds: readonly string[]; applyPresses?: number; repeatBlocked?: number }> | null | undefined,
): { rows: FbGroupClickRow[]; totalClicks: number; totalApps: number; totalPresses: number; totalBlocked: number } | null {
  if (!links) return null;
  const by = new Map<string, { clicks: number; ids: Set<string>; presses: number; blocked: number }>();
  for (const l of links) {
    const f = labelFact(l.label);
    if (funnelChannelOf(f) !== FB_GROUP_CHANNEL) continue;
    const g = funnelSubOf(f);
    const cur = by.get(g) ?? { clicks: 0, ids: new Set<string>(), presses: 0, blocked: 0 };
    cur.clicks += l.clicks;
    cur.presses += l.applyPresses ?? 0;
    cur.blocked += l.repeatBlocked ?? 0;
    for (const id of l.appIds) cur.ids.add(id);
    by.set(g, cur);
  }
  const rows = [...by.entries()]
    .map(([group, v]) => ({
      group,
      clicks: v.clicks,
      appIds: [...v.ids],
      ratePct: v.clicks > 0 ? Math.round((v.ids.size / v.clicks) * 100) : null,
      applyPresses: v.presses,
      repeatBlocked: v.blocked,
    }))
    .sort((a, b) => Number(a.group === NO_SUB) - Number(b.group === NO_SUB) || b.appIds.length - a.appIds.length || b.clicks - a.clicks);
  return {
    rows,
    totalClicks: rows.reduce((s, r) => s + r.clicks, 0),
    totalApps: rows.reduce((s, r) => s + r.appIds.length, 0),
    totalPresses: rows.reduce((s, r) => s + r.applyPresses, 0),
    totalBlocked: rows.reduce((s, r) => s + r.repeatBlocked, 0),
  };
}

/**
 * ═══ คลิกเป็นไส้ในของตาราง "รายชื่อ แยกช่องทาง" (เจ้าของ 11 พ.ย. 2569 "รายชื่อ แยกช่องทาง มันต้องรวมกับ คลิกและกรอก แยกกลุ่ม
 * Facebook โดย คลิกและกรอก แยกกลุ่ม Facebook คือไส้ใน") ═══
 * - คีย์คลิก = คีย์แถวของต้นไม้ (`Facebook Group` · `Facebook Group|ชื่อกลุ่ม`) ตัวแยกกลุ่มเดียวกัน (`funnelSubOf`)
 * - กลุ่มที่มีคนคลิกแต่ไม่มีคนกรอกในช่วง = เติมแถว 0 ใต้ Facebook Group (ไม่งั้นกลุ่มคลิกเยอะแต่ไม่มีคนกรอกหายจากตาราง)
 * - คลิก/กดสมัคร/สมัครซ้ำ = ยอดทั้งหมดตั้งแต่สร้างลิงก์ (ฐานเดิมของการ์ดกลุ่ม) · รายชื่อ = ช่วงที่เลือก (ฐานเดิมของตาราง)
 */
export type FunnelClickCell = { clicks: number; presses: number; blocked: number };

export function mergeFbGroupClicks(
  tree: { groups: FunnelNode[]; total: ChannelFunnelRow },
  fb: ReturnType<typeof buildFbGroupClickRows>,
): { groups: FunnelNode[]; total: ChannelFunnelRow; clicks: Map<string, FunnelClickCell> } {
  const clicks = new Map<string, FunnelClickCell>();
  if (!fb) return { ...tree, clicks };
  clicks.set(FB_GROUP_CHANNEL, { clicks: fb.totalClicks, presses: fb.totalPresses, blocked: fb.totalBlocked });
  for (const r of fb.rows) clicks.set(`${FB_GROUP_CHANNEL}|${r.group}`, { clicks: r.clicks, presses: r.applyPresses, blocked: r.repeatBlocked });
  const groups = tree.groups.map((g) => {
    if (g.key !== 'facebook') return g;
    const chans = [...(g.children ?? [])];
    let at = chans.findIndex((c) => c.key === FB_GROUP_CHANNEL);
    if (at === -1) {
      chans.push({ ...emptyFunnelRow(FB_GROUP_CHANNEL), key: FB_GROUP_CHANNEL });
      at = chans.length - 1;
    }
    const node = chans[at];
    const kids = [...(node.children ?? [])];
    for (const r of fb.rows) {
      const key = `${FB_GROUP_CHANNEL}|${r.group}`;
      if (!kids.some((k) => k.key === key)) kids.push({ ...emptyFunnelRow(r.group), key });
    }
    chans[at] = { ...node, children: kids };
    return { ...g, children: chans };
  });
  return { groups, total: tree.total, clicks };
}
