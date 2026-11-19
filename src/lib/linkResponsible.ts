/**
 * ═══ ผู้รับผิดชอบของลิงก์ตอน Gen link (เจ้าของ 19 พ.ย. 2569) ═══
 * *"พวกนี้มีเจ้าหน้าที่สรรหารับผิดชอบนะ ตอน gen link เพิ่มให้สามารถเลือกคนรับผิดชอบด้วยเลย"*
 * ตอบต่อ: *"หมายถึงให้มีชื่อเจ้าหน้าที่สรรหาด้วย"* ⇒ รายชื่อ = ทีม Online เดิม + สายสรรหา
 *
 * ค่าเริ่ม: กล่องลอย = ผู้รับผิดชอบของกล่อง (ถ้าตรงกับคนในรายชื่อ) › คนกด · ใบขอ = คนกด
 * API ตรวจซ้ำด้วยกติกาเดียวกัน (`resolveLinkResponsible`) — รายชื่อนี้เป็นแค่ตัวเลือก ไม่ใช่ด่าน
 */
import type { RecruitPosting } from '@/lib/recruitPostings';

export type LinkResponsibleStaff = { id: string; name: string; label?: string };
export type LinkResponsibleMe = { id: string; full_name?: string | null; nickname?: string | null; email?: string | null };
export type LinkResponsibleOption = { value: string; label: string };

function meLabel(me: LinkResponsibleMe): string {
  const nick = me.nickname?.trim();
  if (nick) return nick;
  const full = me.full_name?.trim();
  if (full) return full;
  return (me.email ?? '').split('@')[0] || 'ฉัน';
}

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/** รวมรายชื่อหลายสาย (สรรหา · Online) — คนเดียวอยู่หลายสายขึ้นครั้งเดียว · เรียงตามชื่อที่เรียก */
export function mergeResponsibleStaff(lists: ReadonlyArray<readonly LinkResponsibleStaff[]>): LinkResponsibleStaff[] {
  const byId = new Map<string, LinkResponsibleStaff>();
  for (const list of lists) for (const s of list) if (s.id && !byId.has(s.id)) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name, 'th'));
}

/** ตัวเลือก: คนกดอยู่บนสุดเสมอ (แม้ไม่อยู่ในสายที่เลือกได้) · ที่เหลือตามรายชื่อ · ไม่มีชื่อซ้ำ */
export function linkResponsibleOptions(
  staff: readonly LinkResponsibleStaff[],
  me: LinkResponsibleMe | null,
): LinkResponsibleOption[] {
  const out: LinkResponsibleOption[] = [];
  if (me?.id) out.push({ value: me.id, label: meLabel(me) });
  for (const s of staff) {
    if (!s.id || s.id === me?.id) continue;
    out.push({ value: s.id, label: s.label?.trim() || s.name });
  }
  return out;
}

/**
 * id ที่ส่งไป API — เลือกเองแล้ว = คนที่เลือก · ยังไม่เลือก = คนในรายชื่อที่ชื่อตรงกับ `preferredName`
 * (ผู้รับผิดชอบของกล่องลอย · เทียบชื่อเล่นหรือชื่อเต็ม) › คนกด · ไม่รู้ว่าใครกด = ไม่ส่ง (API ใช้บัญชีที่ล็อกอิน)
 */
export function linkResponsibleValue(
  picked: string,
  me: LinkResponsibleMe | null,
  staff: readonly LinkResponsibleStaff[] = [],
  preferredName: string | null = null,
): string {
  if (picked) return picked;
  const want = norm(preferredName);
  if (want) {
    if (me?.id && (norm(me.nickname) === want || norm(me.full_name) === want)) return me.id;
    const hit = staff.find((s) => norm(s.label) === want || norm(s.name) === want);
    if (hit) return hit.id;
  }
  return me?.id || '';
}

/**
 * ผู้รับผิดชอบของกล่องลอย = ชื่อที่บันทึกไว้กับประกาศล่าสุดของกล่องนั้น (เก็บเป็นชื่อตั้งแต่ 11 ส.ค. 2569)
 * BU เดียวกันก่อน › ประเภทเดียวกันข้าม BU · ไม่มี = null
 */
export function standaloneBoxResponsible(
  postings: readonly Pick<RecruitPosting, 'standaloneKind' | 'departmentCode' | 'responsibleName' | 'createdAt'>[],
  kind: string,
  departmentCode: string | null,
): string | null {
  const named = postings
    .filter((p) => p.standaloneKind === kind && p.responsibleName?.trim())
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const sameBu = named.find((p) => norm(p.departmentCode) === norm(departmentCode));
  return (sameBu ?? named[0])?.responsibleName?.trim() ?? null;
}
