/**
 * ═══ รายละเอียดงาน + คุณสมบัติจากใบขอ ERP (เจ้าของ 3 พ.ย. 2569 *"ทำไมไม่ขึ้นที่ระบบเราในเมื่อเขากรอกแล้ว"*) ═══
 *
 * เดิมกล่อง "รายละเอียดงาน" / "คุณสมบัติ" ในป๊อปประกาศอ่านแค่ค่าที่ทีมแก้เอง (`field_overrides`) — ERP กรอกไว้ก็ขึ้น "ไม่ระบุ"
 * ตอนนี้ค่าตั้งต้น = ERP (แพตเทิร์นเดียวกับวันเวลาทำงาน) · ทีมแก้แล้วทับ (siamraj-unit-requests.ts)
 * ที่มา: `st_request_p2` / `st_prequest_p2` — คอลัมน์ชุดเดียวกันทั้งใบขอจริงและใบขอ Pre Order
 * วัดจริง 3 พ.ย. 2569: ใบขอตั้งแต่ ส.ค. 566 ใบ มี work_detail1 565 · วุฒิ 563 · ประสบการณ์ 563 · ความสามารถ 562
 */

const clean = (v: string | null | undefined): string | null => {
  const s = (v ?? '').replace(/\s+/g, ' ').trim();
  return s && !/^[-–—.\s]+$/.test(s) ? s : null;
};

/** รายละเอียดงาน = work_detail1–3 บรรทัดละช่อง (แบบฟอร์ม ERP) */
export function erpJobDetailLines(...lines: (string | null | undefined)[]): string[] {
  return lines.map(clean).filter((x): x is string => x != null);
}

export type ErpQualificationFields = {
  degree?: string | null;
  major?: string | null;
  experience?: string | null;
  capability1?: string | null;
  capability2?: string | null;
  capability3?: string | null;
  capabilityOther?: string | null;
};

/** คุณสมบัติ = วุฒิ (+สาขา) · ประสบการณ์ · ความสามารถ 1–3 · อื่น ๆ (เพศ/อายุอยู่กล่องของมันเอง) */
export function erpRequirementLines(f: ErpQualificationFields): string[] {
  const out: string[] = [];
  const degree = clean(f.degree);
  const major = clean(f.major);
  // วุฒิไม่จำกัด/ภาคบังคับไม่มีสาขา — ช่องสาขาของใบพวกนี้มักเป็นอย่างอื่น (LAM6910001 กรอก "นครปฐม")
  const noMajor = !degree || /ไม่จำกัด|ภาคบังคับ|ไม่ระบุ/.test(degree);
  if (degree) out.push(major && !noMajor ? `วุฒิ ${degree} สาขา ${major}` : `วุฒิ ${degree}`);
  const exp = clean(f.experience);
  if (exp) out.push(exp.startsWith('ประสบการณ์') ? exp : `ประสบการณ์ ${exp}`);
  for (const c of [f.capability1, f.capability2, f.capability3, f.capabilityOther]) {
    const v = clean(c);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}
