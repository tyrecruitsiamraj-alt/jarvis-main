/**
 * ═══ เหตุผลยกเลิกใบขอ (เจ้าของ 24 พ.ย. 2569) — ตัวตัดสินที่เดียว ═══
 *
 * ใบที่ ERP หยุด/ยกเลิก บางใบจริง ๆ ได้คนแล้ว (เลือกจาก WL · เลือกจากพนักงานในไซต์) — เจ้าของเคาะ:
 *  - สมการใบขอคงเดิม: ยังนับอยู่ใน "ยกเลิก" · กดเลขยกเลิกแล้วแยก ได้คนแล้ว / ยกเลิกจริง / ไม่ได้กรอกเหตุผล
 *  - รายการเหตุผลกลาง (`request_cancel_reasons`) ตั้งต้นด้วย 11 ข้อของ ERP · Admin เพิ่ม/เลิกใช้ · ติ๊กข้อไหน "ได้คนแล้ว"
 *  - ทุกคนใส่เหตุผลบนใบได้ เลือกจากรายการเท่านั้น · ใส่ได้เฉพาะใบที่ ERP ไม่มีเหตุผล หรือเป็น "ยกเลิกโดย-สยามราช" (16)
 *    ใบที่ ERP บอกเหตุผลชัดแล้วใช้ของ ERP — เลขสองชุดไม่ขัดกัน
 * ไฟล์นี้ pure (ใช้ทั้งหน้าเว็บและ server) · เทสต์ `tests/api/requestCancelReason2569-11-24.test.ts`
 */

/** รหัสเหตุผลของ ERP ที่ทีมใส่ทับได้ — "ยกเลิกโดย-สยามราช" ไม่บอกว่าเพราะอะไร */
export const OVERRIDABLE_ERP_CODES: readonly string[] = ['16'];

export const NO_CANCEL_REASON = 'ไม่ได้กรอกเหตุผล';

/** กลุ่มของเหตุผล · คำบนจอตามแผนที่เจ้าของเห็น ("ยกเลิก 3 = ได้คนแล้ว 2 + ยกเลิกจริง 1 + ไม่ได้กรอกเหตุผล 0") */
export type CancelReasonGroup = 'got_person' | 'cancelled' | 'none';
export const CANCEL_GROUP_ORDER: readonly CancelReasonGroup[] = ['got_person', 'cancelled', 'none'];
export const CANCEL_GROUP_LABEL: Record<CancelReasonGroup, string> = {
  got_person: 'ได้คนแล้ว',
  cancelled: 'ยกเลิกจริง',
  none: NO_CANCEL_REASON,
};

export type CancelReasonMaster = {
  id: number;
  label: string;
  gotPerson: boolean;
  /** รหัสใน ERP (`st_ms_stop_by`) · null = ทีมเพิ่มเอง */
  erpCode: string | null;
  active: boolean;
  sortOrder: number;
};

export type CancelReasonTag = {
  /** เลขที่ใบขอดิบของ ERP */
  requestNo: string;
  reasonId: number;
  byName: string | null;
  at: string;
};

export type EffectiveCancelReason = {
  label: string;
  group: CancelReasonGroup;
  source: 'erp' | 'team' | 'none';
  /** ทีมใส่/แก้เหตุผลบนใบนี้ได้ไหม */
  taggable: boolean;
  /** เหตุผลที่ทีมใส่ไว้ (ไว้เลือกค่าเดิมในตัวเลือก) */
  reasonId: number | null;
  byName: string | null;
  at: string | null;
};

const norm = (v: string | null | undefined) => (v ?? '').trim();

/** ใบนี้ทีมใส่เหตุผลได้ไหม — ERP ไม่มีเหตุผล หรือเป็นรหัสที่ไม่บอกอะไร */
export function canTagCancelReason(erpCode: string | null | undefined): boolean {
  const c = norm(erpCode);
  return c === '' || OVERRIDABLE_ERP_CODES.includes(c);
}

/** คีย์ของใบ — เลขดิบ ตัวพิมพ์ใหญ่ ไม่มีช่องว่าง (ตัวเดียวกันทั้งตอนเก็บและตอนอ่าน) */
export const cancelTagKey = (requestNo: string) => requestNo.trim().toUpperCase();

/**
 * เหตุผลที่ใช้จริงของใบเดียว
 * ใบที่ทีมใส่ได้ + มีเหตุผลที่ทีมใส่ = ของทีม · ไม่งั้นใช้ของ ERP (กลุ่มตามรายการกลาง · ไม่อยู่ในรายการ = ยกเลิกจริง) · ไม่มีเลย = ไม่ได้กรอกเหตุผล
 */
export function effectiveCancelReason(
  erp: { code?: string | null; name?: string | null },
  tag: CancelReasonTag | null | undefined,
  masters: readonly CancelReasonMaster[],
): EffectiveCancelReason {
  const code = norm(erp.code);
  const taggable = canTagCancelReason(code);
  if (taggable && tag) {
    const m = masters.find((x) => x.id === tag.reasonId);
    if (m) return { label: m.label, group: m.gotPerson ? 'got_person' : 'cancelled', source: 'team', taggable, reasonId: m.id, byName: tag.byName, at: tag.at };
  }
  if (code) {
    const m = masters.find((x) => norm(x.erpCode) === code);
    const label = norm(erp.name) || m?.label || `รหัส ${code}`;
    return { label, group: m?.gotPerson ? 'got_person' : 'cancelled', source: 'erp', taggable, reasonId: null, byName: null, at: null };
  }
  return { label: NO_CANCEL_REASON, group: 'none', source: 'none', taggable, reasonId: null, byName: null, at: null };
}

export type CancelGroupCount = { requests: number; positions: number };
export type CancelReasonCount = CancelGroupCount & { label: string; group: CancelReasonGroup };
export type CancelReasonBreakdown = {
  total: CancelGroupCount;
  groups: Record<CancelReasonGroup, CancelGroupCount>;
  /** รายเหตุผล — เรียงตามกลุ่ม แล้วอัตรามากไปน้อย · ไม่ได้กรอกเหตุผลอยู่ท้ายสุด */
  reasons: CancelReasonCount[];
};

/** แยกยอดยกเลิกตามกลุ่มและเหตุผล — 🔴 ผลรวมทุกกลุ่ม = ยอดทั้งหมด = เลขบนกล่องที่กด */
export function cancelReasonBreakdown(rows: readonly { reason: EffectiveCancelReason; positions: number }[]): CancelReasonBreakdown {
  const zero = (): CancelGroupCount => ({ requests: 0, positions: 0 });
  const groups = { got_person: zero(), cancelled: zero(), none: zero() } as Record<CancelReasonGroup, CancelGroupCount>;
  const total = zero();
  const byLabel = new Map<string, CancelReasonCount>();
  for (const { reason, positions } of rows) {
    total.requests += 1;
    total.positions += positions;
    groups[reason.group].requests += 1;
    groups[reason.group].positions += positions;
    const k = `${reason.group}|${reason.label}`;
    const c = byLabel.get(k) ?? { label: reason.label, group: reason.group, requests: 0, positions: 0 };
    c.requests += 1;
    c.positions += positions;
    byLabel.set(k, c);
  }
  const reasons = [...byLabel.values()].sort(
    (a, b) => CANCEL_GROUP_ORDER.indexOf(a.group) - CANCEL_GROUP_ORDER.indexOf(b.group) || b.positions - a.positions || a.label.localeCompare(b.label, 'th'),
  );
  return { total, groups, reasons };
}

/** บรรทัดสมการใต้กล่อง — "ยกเลิก 10 = ได้คนแล้ว 6 + ยกเลิกจริง 3 + ไม่ได้กรอกเหตุผล 1" (หน่วยอัตรา) */
export function cancelReasonEquation(b: CancelReasonBreakdown): string {
  const n = (v: number) => v.toLocaleString('th-TH');
  return `ยกเลิก ${n(b.total.positions)} = ${CANCEL_GROUP_ORDER.map((g) => `${CANCEL_GROUP_LABEL[g]} ${n(b.groups[g].positions)}`).join(' + ')}`;
}

/** ตัวเลือกตอนใส่เหตุผล — เฉพาะที่เปิดใช้ · ไม่มี "ยกเลิกโดย-สยามราช" (ข้อที่ไม่บอกอะไร ใส่ซ้ำก็ไม่ได้อะไร) */
export function pickableCancelReasons(masters: readonly CancelReasonMaster[]): CancelReasonMaster[] {
  return masters
    .filter((m) => m.active && !OVERRIDABLE_ERP_CODES.includes(norm(m.erpCode)))
    .sort((a, b) => Number(b.gotPerson) - Number(a.gotPerson) || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'th'));
}
