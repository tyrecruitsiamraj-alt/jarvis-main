/**
 * สถานะระบบ — ตรรกะล้วน (แปลงสัญญาณดิบเป็นไฟเขียว/เหลือง/แดง + คำที่คนอ่านออก)
 *
 * ทำไมต้องมี: 19 ส.ค. 2569 เจอโรคเดียวกันสองเคสในวันเดียว —
 * สวิตช์ส่งใบสมัครหน้าสาธารณะ **ปิดอยู่ 4 วัน** โดยไม่มีใครรู้ · และต้น ส.ค.
 * Lumos หยุดดึงคิว 3 วันจนคิวบวม 3,400+ กว่าจะรู้ตัว
 * 🔴 **ระบบไม่เคยบอกว่าตัวเองหยุดทำงาน** — ไฟล์นี้คือเกณฑ์ตัดสินว่า "ผิดปกติ" แปลว่าอะไร
 *
 * ⚠️ ตรรกะอยู่ที่นี่ที่เดียว — ทั้งยามเฝ้า (ที่เด้งแจ้งเตือน) และหน้าสถานะ (ที่คนเปิดดู)
 * ต้องตัดสินเหมือนกันเป๊ะ ไม่งั้นหน้าจอเขียวแต่แจ้งเตือนแดง แล้วไม่มีใครเชื่ออะไรเลย
 */

export type HealthLevel = 'ok' | 'warn' | 'down';

export type HealthCheck = {
  key: HealthCheckKey;
  label: string;
  level: HealthLevel;
  /** ค่าที่โชว์ตัวใหญ่ เช่น "32 นาทีก่อน" */
  value: string;
  /** บรรทัดเล็กใต้ค่า — บอกเกณฑ์ที่ใช้ตัดสิน */
  hint: string;
};

export type HealthCheckKey = 'lumosPull' | 'lumosResult' | 'queueBacklog' | 'erp';

/** สัญญาณดิบที่ฝั่งเซิร์ฟเวอร์อ่านมาให้ */
export type HealthSignals = {
  /** Lumos ดึงคิวไปครั้งล่าสุดเมื่อไหร่ (max delivered_at) */
  lumosPullAt: string | null;
  /** ผลโทรกลับเข้าระบบครั้งล่าสุดเมื่อไหร่ */
  lumosResultAt: string | null;
  /** คิวที่ **ถึงเวลาแล้ว** แต่ยังไม่ถูกดึงไป — ตัวชี้ว่าคิวเริ่มบวม */
  queueDueNow: number;
  /** คิวที่ยังไม่ถึงเวลานัด — ปกติ ไม่ใช่ปัญหา */
  queueWaiting: number;
  /** อ่าน ERP ได้ไหม · null = ยังไม่มีข้อมูล (ยามเฝ้ายังไม่เดินสักรอบ) */
  erpOk: boolean | null;
  erpOpenJobs: number;
  erpCheckedAt: string | null;
};

/**
 * เกณฑ์ตัดสิน (นาที)
 * ⚠️ ตั้งหลวมไว้ก่อนโดยตั้งใจ — เตือนถี่เกินไปคนจะกดปิดโดยไม่อ่าน
 * แล้วเราจะได้ระบบเตือนที่ไม่มีใครฟัง ซึ่งแย่กว่าไม่มีเลย
 */
export const HEALTH_THRESHOLDS = {
  /** Lumos ดึงคิว — ปกติทุก 5–15 นาที */
  lumosPull: { warn: 180, down: 720 },
  /** ผลโทรกลับ — หลวมกว่า เพราะบางช่วงไม่มีสายให้โทรจริง ๆ */
  lumosResult: { warn: 720, down: 2880 },
  /** ERP เช็คล่าสุด — เก่ากว่านี้ถือว่าไม่รู้สถานะแล้ว */
  erpStale: { warn: 60, down: 240 },
} as const;

/** คิวที่ถึงเวลาแล้วแต่ยังไม่ถูกดึง — เกินเท่าไหร่ถือว่าเริ่มบวม */
export const QUEUE_BACKLOG_LIMITS = { warn: 1, down: 50 } as const;

const MIN = 60_000;

/** อายุเป็นนาทีจาก ISO · null = ไม่มีค่า (ยังไม่เคยเกิด) */
export function minutesSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / MIN));
}

/** "32 นาทีก่อน" · "2 ชม. 51 น." · "3 วันก่อน" · null = "ยังไม่เคย" */
export function humanAgo(minutes: number | null): string {
  if (minutes === null) return 'ยังไม่เคย';
  if (minutes < 1) return 'เมื่อกี้';
  if (minutes < 60) return `${minutes} นาทีก่อน`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} ชม.ก่อน` : `${h} ชม. ${m} น.`;
  }
  const d = Math.floor(minutes / (60 * 24));
  return `${d} วันก่อน`;
}

/**
 * อายุ → ระดับ
 * 🔴 ไม่มีค่าเลย (`null`) = **`warn` ไม่ใช่ `ok`** — "ไม่เคยเกิดขึ้น" กับ "ปกติดี"
 * คนละเรื่องกัน ถ้าตีเป็นเขียวจะกลับไปเป็นปัญหาเดิม (ระบบเงียบแต่จอบอกว่าสบายดี)
 */
export function levelFromAge(
  minutes: number | null,
  th: { warn: number; down: number },
): HealthLevel {
  if (minutes === null) return 'warn';
  if (minutes >= th.down) return 'down';
  if (minutes >= th.warn) return 'warn';
  return 'ok';
}

/** ระดับที่แย่ที่สุดในชุด — ใช้ตัดสินว่าจะขึ้นแถบแดงบนหัวหน้าจอไหม */
export function worstLevel(checks: readonly { level: HealthLevel }[]): HealthLevel {
  if (checks.some((c) => c.level === 'down')) return 'down';
  if (checks.some((c) => c.level === 'warn')) return 'warn';
  return 'ok';
}

function backlogLevel(dueNow: number): HealthLevel {
  const n = Math.max(0, Math.trunc(Number(dueNow)) || 0);
  if (n >= QUEUE_BACKLOG_LIMITS.down) return 'down';
  if (n >= QUEUE_BACKLOG_LIMITS.warn) return 'warn';
  return 'ok';
}

/** ประกอบไฟทั้งชุดจากสัญญาณดิบ */
export function buildHealthChecks(signals: HealthSignals, now: Date): HealthCheck[] {
  const pullMin = minutesSince(signals.lumosPullAt, now);
  const resultMin = minutesSince(signals.lumosResultAt, now);
  const erpMin = minutesSince(signals.erpCheckedAt, now);
  const dueNow = Math.max(0, Math.trunc(Number(signals.queueDueNow)) || 0);
  const waiting = Math.max(0, Math.trunc(Number(signals.queueWaiting)) || 0);

  // ERP: อ่านไม่ได้ = แดงทันที · อ่านได้แต่ข้อมูลเก่า = เหลือง (ไม่รู้สถานะปัจจุบันแล้ว)
  const erpLevel: HealthLevel =
    signals.erpOk === false ? 'down' : signals.erpOk === null ? 'warn' : levelFromAge(erpMin, HEALTH_THRESHOLDS.erpStale);

  return [
    {
      key: 'lumosPull',
      label: 'Lumos ดึงคิว',
      level: levelFromAge(pullMin, HEALTH_THRESHOLDS.lumosPull),
      value: humanAgo(pullMin),
      hint: `เตือนเมื่อเกิน ${Math.round(HEALTH_THRESHOLDS.lumosPull.warn / 60)} ชม.`,
    },
    {
      key: 'lumosResult',
      label: 'ผลโทรกลับ',
      level: levelFromAge(resultMin, HEALTH_THRESHOLDS.lumosResult),
      value: humanAgo(resultMin),
      hint: `เตือนเมื่อเกิน ${Math.round(HEALTH_THRESHOLDS.lumosResult.warn / 60)} ชม.`,
    },
    {
      key: 'queueBacklog',
      label: 'คิวค้างเกินเวลา',
      level: backlogLevel(dueNow),
      value: `${dueNow.toLocaleString('th-TH')} ใบ`,
      hint:
        waiting > 0
          ? `รอเวลานัดอีก ${waiting.toLocaleString('th-TH')} ใบ (ปกติ)`
          : 'ไม่มีใบไหนรอเวลานัด',
    },
    {
      key: 'erp',
      label: 'ERP (ใบขอ)',
      level: erpLevel,
      value:
        signals.erpOk === false
          ? 'อ่านไม่ได้'
          : signals.erpOk === null
            ? 'ยังไม่ได้ตรวจ'
            : `${signals.erpOpenJobs.toLocaleString('th-TH')} ใบเปิด`,
      hint: signals.erpOk === null ? 'ยามเฝ้ายังไม่เดินสักรอบ' : `ตรวจ ${humanAgo(erpMin)}`,
    },
  ];
}

/**
 * ข้อความแจ้งเตือนตอนสถานะเปลี่ยน — ยามเฝ้าเรียกใช้
 * คืน null เมื่อไม่ต้องเตือน (ระดับไม่เปลี่ยน หรือเปลี่ยนระหว่าง warn↔down ที่ยังแย่เหมือนเดิม)
 *
 * 🔴 **หายแล้วต้องบอกด้วย** — ถ้าเตือนตอนพังอย่างเดียว คนจะไม่กล้าเชื่อว่ามันหายจริงไหม
 * แล้วจะเข้าไปเช็คเองทุกครั้ง ซึ่งก็เท่ากับไม่มีระบบเตือน
 */
export function healthAlertFor(
  check: HealthCheck,
  previous: HealthLevel | null,
): { kind: 'down' | 'recovered'; title: string; body: string } | null {
  const bad = check.level !== 'ok';
  const wasBad = previous !== null && previous !== 'ok';
  if (bad && !wasBad) {
    return {
      kind: 'down',
      title: `🚨 ${check.label} ผิดปกติ`,
      body: `${check.value} · ${check.hint}`,
    };
  }
  if (!bad && wasBad) {
    return {
      kind: 'recovered',
      title: `✅ ${check.label} กลับมาปกติแล้ว`,
      body: `${check.value}`,
    };
  }
  return null;
}
