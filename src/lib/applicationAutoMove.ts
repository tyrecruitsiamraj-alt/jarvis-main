/**
 * ย้ายใบสมัครอัตโนมัติเมื่อใบขอที่เขาสมัครไว้ถูกปิด (098 · เจ้าของสั่ง 17 ส.ค. 2569)
 *
 * เกณฑ์ที่เจ้าของเคาะไว้เป๊ะ ๆ:
 * > *"ย้ายไปใบที่ ยังเปิด + ตำแหน่งเดียวกัน + จังหวัดเดียวกัน เท่านั้น
 * > (เรียงใบที่อำเภอตรงกันขึ้นก่อน)"*
 *
 * 🔴 **ไม่เข้าเกณฑ์ = ไม่ย้าย** — ห้ามผ่อนเกณฑ์เองเพื่อให้ย้ายได้
 * (ย้ายผิด = คนไปโผล่ในงานที่เขาไม่ได้สมัคร ซึ่งแย่กว่าปล่อยค้างไว้ให้คนมาจัดการเอง)
 *
 * ไฟล์นี้ pure ทั้งหมด — ตัดสินใจอย่างเดียว ไม่ยิงฐาน ไม่รู้จัก API
 * เทสต์ที่ `tests/api/applicationAutoMove.test.ts`
 */

/** ใบสมัครเท่าที่ตัวตัดสินใจต้องรู้ */
export type AutoMoveApplication = {
  id: string;
  /** ใบขอที่สมัครไว้ (id เต็ม) — ว่าง = สมัครทั่วไป ไม่ต้องย้าย */
  job_id?: string | null;
  province?: string | null;
  district?: string | null;
  position_interest?: string | null;
  job_title?: string | null;
  status?: string | null;
  /** ชื่อขึ้นบอร์ด ERP แล้ว = เป็นงานคัดสรรต่อ ห้ามย้าย */
  on_board?: boolean | null;
  /** มีนัดสัมภาษณ์แล้ว = มีคนคุยไว้แล้ว ห้ามย้าย */
  appointment_at?: string | null;
  /** ย้ายอัตโนมัติไปแล้วรอบหนึ่ง — ไม่ย้ายซ้ำ (กันเด้งไปเรื่อย ๆ) */
  moved_at?: string | null;
};

/** ใบขอปลายทางที่ยังเปิดอยู่ */
export type AutoMoveTargetJob = {
  id: string;
  request_no?: string | null;
  unit_name?: string | null;
  province?: string | null;
  district?: string | null;
  position?: string | null;
};

export type AutoMoveDecision =
  | { move: true; job: AutoMoveTargetJob; reason: string }
  | { move: false; reason: string };

/** เทียบข้อความไทยแบบไม่สนช่องว่าง/ตัวพิมพ์ — ชื่อจังหวัด/ตำแหน่งใน ERP เว้นวรรคไม่เท่ากัน */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) =>
    (v ?? '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
  const x = norm(a);
  const y = norm(b);
  // ทั้งคู่ว่าง = **ไม่ถือว่าเหมือนกัน** (ไม่รู้ ≠ ตรงกัน) — ไม่งั้นใบที่ไม่มีข้อมูลจะแมทกับทุกใบ
  return x !== '' && x === y;
}

/** ตำแหน่งที่ผู้สมัครกรอกมา — ช่องที่เขาเลือกงานมาก่อน แล้วค่อยถอยไปชื่องานของใบเดิม */
export function applicationPositionOf(app: AutoMoveApplication): string {
  return (app.position_interest || '').trim() || (app.job_title || '').trim();
}

/**
 * ใบสมัครนี้เข้าข่ายให้ย้ายอัตโนมัติไหม (ยังไม่ดูปลายทาง)
 * แยกออกมาเพราะเป็นด่านความปลอดภัย — อ่านแล้วต้องเห็นทันทีว่ากันใครไว้บ้าง
 */
export function isAutoMovable(app: AutoMoveApplication): { ok: boolean; reason: string } {
  if (!(app.job_id || '').trim()) return { ok: false, reason: 'ไม่ได้ผูกกับใบขอ (สมัครทั่วไป)' };
  if (app.moved_at) return { ok: false, reason: 'เคยถูกย้ายอัตโนมัติไปแล้ว' };
  if (app.on_board === true) return { ok: false, reason: 'ชื่อขึ้นบอร์ดแล้ว (เป็นงานคัดสรร)' };
  if ((app.appointment_at || '').trim()) return { ok: false, reason: 'มีนัดสัมภาษณ์แล้ว' };
  // ย้ายเฉพาะใบที่ยังไม่มีใครทำอะไรกับมัน — แตะแล้ว = มีคนถือเรื่องอยู่
  if ((app.status || 'new') !== 'new') return { ok: false, reason: `สถานะเป็น ${app.status}` };
  if (!applicationPositionOf(app)) return { ok: false, reason: 'ไม่รู้ตำแหน่งที่สมัคร' };
  if (!(app.province || '').trim()) return { ok: false, reason: 'ไม่รู้จังหวัดของผู้สมัคร' };
  return { ok: true, reason: '' };
}

/**
 * เลือกใบปลายทาง — คืน `move:false` พร้อมเหตุผลเสมอเมื่อย้ายไม่ได้
 *
 * `declinedJobIds` = ใบที่คนนี้เคยปฏิเสธ (ห้ามเสนอซ้ำ — กติกาถาวรของระบบ)
 * `openJobs` ต้องเป็นใบที่ **ยังเปิดอยู่เท่านั้น** (ผู้เรียกกรองมาก่อน)
 */
export function pickAutoMoveTarget(
  app: AutoMoveApplication,
  openJobs: readonly AutoMoveTargetJob[],
  declinedJobIds: ReadonlySet<string> = new Set(),
): AutoMoveDecision {
  const gate = isAutoMovable(app);
  if (!gate.ok) return { move: false, reason: gate.reason };

  const position = applicationPositionOf(app);
  const fromJobId = (app.job_id || '').trim();

  const eligible = openJobs.filter(
    (j) =>
      j.id !== fromJobId &&
      !declinedJobIds.has(j.id) &&
      sameText(j.position, position) &&
      sameText(j.province, app.province),
  );
  if (eligible.length === 0) {
    return { move: false, reason: 'ไม่มีใบที่ยังเปิด + ตำแหน่งเดียวกัน + จังหวัดเดียวกัน' };
  }

  // อำเภอตรงกันขึ้นก่อน · ที่เหลือคงลำดับเดิมของ feed (sort ของ JS เป็น stable)
  const ranked = [...eligible].sort((a, b) => {
    const aNear = sameText(a.district, app.district) ? 0 : 1;
    const bNear = sameText(b.district, app.district) ? 0 : 1;
    return aNear - bNear;
  });

  const job = ranked[0];
  const near = sameText(job.district, app.district);
  return {
    move: true,
    job,
    reason: near ? 'closed_request:same_district' : 'closed_request:same_province',
  };
}
