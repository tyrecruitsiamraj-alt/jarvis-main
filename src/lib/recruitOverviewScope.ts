/**
 * ═══ การ์ดที่นับฝั่งเซิร์ฟเวอร์ ตามตัวกรองบนสุด (เจ้าของ 4 พ.ย. 2569 "ให้การ์ดที่เหลือเปลี่ยนตามตัวกรองด้วย") ═══
 * เซิร์ฟเวอร์ส่งยอดแยกต่อใบขอ (`backlogByJob` · `staffByJob` · `aiByJob`) → ที่นี่รวมเฉพาะใบที่ผ่าน `jobFilterOf`
 * ใบสมัครหนึ่งใบอยู่ใบขอเดียว ⇒ บวกข้ามใบได้ตรง ๆ (รวมทุกใบ = ยอดรวมเดิม · มีเทสต์)
 */
import type { RecruitAiRow, RecruitBacklog, RecruitStaffRow } from './recruitOverviewTypes';

type Tree = number | null | undefined | { [k: string]: Tree };

/** บวกตัวเลขทุกช่องของสองก้อนที่หน้าตาเดียวกัน · null + null = null (ตารางผลนัดยังไม่พร้อม) */
function addTree(a: Tree, b: Tree): Tree {
  if (typeof a === 'number' || typeof b === 'number') return (typeof a === 'number' ? a : 0) + (typeof b === 'number' ? b : 0);
  if (a == null) return b == null ? (a ?? b) : addTree(zeroOf(b), b);
  if (b == null) return addTree(a, zeroOf(a));
  const out: { [k: string]: Tree } = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = addTree(a[k], b[k]);
  return out;
}
function zeroOf(t: Tree): Tree {
  if (typeof t === 'number') return 0;
  if (t == null) return t;
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, zeroOf(v)]));
}

export function backlogOfJobs(
  byJob: Readonly<Record<string, RecruitBacklog>>,
  ok: (jobId: string | null) => boolean,
  template: RecruitBacklog,
): RecruitBacklog {
  let acc = zeroOf(template as unknown as Tree);
  for (const [k, b] of Object.entries(byJob)) if (ok(k || null)) acc = addTree(acc, b as unknown as Tree);
  return acc as unknown as RecruitBacklog;
}

/** ผลงานรายคน — ต่อชื่อบวกข้ามใบ · เรียงแบบเดียวกับเซิร์ฟเวอร์ (`toStaffRows`) */
export function staffOfJobs(byJob: Readonly<Record<string, readonly RecruitStaffRow[]>>, ok: (jobId: string | null) => boolean): RecruitStaffRow[] {
  const by = new Map<string, RecruitStaffRow>();
  for (const [k, rows] of Object.entries(byJob)) {
    if (!ok(k || null)) continue;
    for (const r of rows) {
      const cur = by.get(r.name) ?? { name: r.name, claimed: 0, called: 0, reached: 0, appointed: 0, showed: 0 };
      cur.claimed += r.claimed;
      cur.called += r.called;
      cur.reached += r.reached;
      cur.appointed += r.appointed;
      cur.showed += r.showed;
      by.set(r.name, cur);
    }
  }
  return [...by.values()].sort(
    (x, y) => y.appointed - x.appointed || y.called - x.called || y.claimed - x.claimed || x.name.localeCompare(y.name, 'th'),
  );
}

export function aiOfJobs(byJob: Readonly<Record<string, RecruitAiRow>>, ok: (jobId: string | null) => boolean): RecruitAiRow {
  const out: RecruitAiRow = { called: 0, reached: 0, saidYes: 0 };
  for (const [k, r] of Object.entries(byJob)) {
    if (!ok(k || null)) continue;
    out.called += r.called;
    out.reached += r.reached;
    out.saidYes += r.saidYes;
  }
  return out;
}
