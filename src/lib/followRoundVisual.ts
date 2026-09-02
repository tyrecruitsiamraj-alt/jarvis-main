import type { ToneKey } from '@/lib/designTokens';
import {
  FOLLOW_ROUND_BUCKETS,
  FOLLOW_ROUND_BUCKET_LABEL,
  type FollowRoundBucket,
} from '@/lib/followRoundBuckets';

/**
 * **Visual Control** ของแผงการโทรหน้า Follow (เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * > *"ทำเป็น Visual Control แบ่งสีให้ชัด เห็นสีแล้วรู้เลยว่าควรทำอะไร"*
 * > *"ทำเป็นแบบช่องแบ่งกด การโทรครั้งที่1 การโทรครั้งที่2 การโทรครั้งที่3 กดแล้ว visual เปลี่ยนตาม"*
 *
 * กติกาสีของทั้งระบบ (ห้ามคิดชุดใหม่ที่นี่):
 *   เขียว = ดีแล้ว ไม่ต้องทำอะไร · เหลือง = ต้องตามต่อ · แดง = หลุดแล้ว ต้องตัดสินใจ ·
 *   น้ำเงิน = กำลังเดินอยู่ · เทา = ยังไม่ถึงคิว
 *
 * 🔴 **สีบอก "ควรทำอะไร" ไม่ใช่ "มากหรือน้อย"** — ช่องที่ต้องลงมือ (โทรไม่ติด/ไม่ไป)
 * ต้องเด่นแม้เลขน้อย และช่องที่ดีแล้วต้องไม่แย่งสายตาแม้เลขเยอะ
 *
 * 🔴 **ช่องต้องคงสีประจำตัวไว้เสมอ แม้เป็น 0** (เจ้าของสั่งซ้ำ 18 ส.ค. 2569:
 * *"ตรง ทั้งหมด รอโทร กำลังโทร ฯลฯ ทำเป็น Visual แบบแบ่งสีให้หน่อย"*)
 * เดิมทำ "0 = เทา" แล้วเจอว่าเวลาข้อมูลน้อย ทั้งแถบเทาหมดจนแยกไม่ออกว่าช่องไหนคืออะไร
 *
 * แต่ยังต้องกันของเดิมด้วย: **กล่องว่างห้ามเด่นเท่ากล่องที่มีของ** ไม่งั้นคนไล่ดูของที่ไม่มีจริง
 * → ทางออกคือ `muted` — สีเดิมแต่จาง ๆ (ป้ายจาง พื้นไม่ติดสี ไม่ขึ้นกรอบหนา)
 * ส่วน `actionable` ยังผูกกับ "มีของจริง" เท่านั้น เหมือนเดิมทุกอย่าง
 */

export type BucketVisual = {
  /** สีประจำช่อง — **คงที่เสมอ** ไม่ขึ้นกับจำนวน (ใช้เป็นตัวระบุว่าช่องไหนคืออะไร) */
  tone: ToneKey;
  /** true = ช่องที่ต้องลงมือทำ (ใช้เน้นกรอบ + ขึ้นในคำแนะนำ) · เป็นจริงเมื่อมีของจริงเท่านั้น */
  actionable: boolean;
  /** true = ช่องว่าง (0 คน) — ให้ลงสีแบบจาง ไม่ใช่เต็มสี */
  muted: boolean;
};

/** โทนประจำช่อง — คงที่เสมอ · ส่วน actionable/muted คิดจากจำนวนที่ `bucketVisual()` */
const BUCKET_BASE: Record<FollowRoundBucket, Omit<BucketVisual, 'muted'>> = {
  // เจ้าของสั่ง 18 ส.ค. 2569: *"ตรง ทั้งหมด รอโทร กำลังโทร ฯลฯ ทำเป็น Visual แบ่งสีให้หน่อย"*
  // — เดิม ทั้งหมด/รอโทร เป็นเทาทั้งคู่ กวาดตาแล้วแยกไม่ออกว่าช่องไหนคืออะไร
  all: { tone: 'info', actionable: false },
  waiting: { tone: 'teal', actionable: false },
  calling: { tone: 'primary', actionable: false },
  connected: { tone: 'success', actionable: false },
  unreached: { tone: 'warn', actionable: true },
  went: { tone: 'success', actionable: false },
  not_went: { tone: 'danger', actionable: true },
};

/** สีของช่อง — สีคงที่ · ช่องว่างได้ `muted` และไม่นับเป็นของที่ต้องลงมือ */
export function bucketVisual(bucket: FollowRoundBucket, count: number): BucketVisual {
  const base = BUCKET_BASE[bucket];
  const has = count > 0;
  return { tone: base.tone, actionable: has && base.actionable, muted: !has };
}

export type RoundCounts = Record<FollowRoundBucket, number>;

export type RoundSignal = {
  /** ok = ไม่มีอะไรต้องทำ · watch = มีของค้าง · act = มีของหลุดต้องตัดสินใจ */
  level: 'empty' | 'ok' | 'watch' | 'act';
  tone: ToneKey;
  /** ข้อความสั้นบอกว่าควรทำอะไรต่อ — ขึ้นใต้แท็บรอบที่เลือก */
  text: string;
};

/**
 * สรุปว่ารอบนี้ควรทำอะไร — เรียงความเร่งด่วนจากหนักไปเบา
 * แดงชนะเหลือง · เหลืองชนะน้ำเงิน · ไม่มีอะไรค้างเลยถึงจะเขียว
 */
export function roundSignal(counts: RoundCounts): RoundSignal {
  if (!(counts.all > 0)) {
    // เจ้าของสั่ง 18 ส.ค. 2569: *"ยังไม่มีใครอยู่รอบนี้ เอาออก"* —
    // รอบว่างไม่ต้องมีข้อความ (เลข 0 บนกล่องบอกอยู่แล้ว) · text ว่าง = UI ไม่เรนเดอร์แถบ
    return { level: 'empty', tone: 'neutral', text: '' };
  }
  if (counts.not_went > 0) {
    return {
      level: 'act',
      tone: 'danger',
      text: `ไม่ไป ${counts.not_went.toLocaleString('th-TH')} คน — ตัดสินใจว่าจะหาคนแทนหรือปิดเรื่อง`,
    };
  }
  if (counts.unreached > 0) {
    return {
      level: 'act',
      tone: 'warn',
      text: `โทรไม่ติด ${counts.unreached.toLocaleString('th-TH')} คน — ส่งโทรรอบถัดไป หรือโทรเองตรง ๆ`,
    };
  }
  if (counts.calling > 0) {
    return {
      level: 'watch',
      tone: 'primary',
      text: `AI กำลังโทร ${counts.calling.toLocaleString('th-TH')} คน — รอผลกลับ`,
    };
  }
  if (counts.waiting > 0) {
    return {
      level: 'watch',
      tone: 'neutral',
      text: `รอโทร ${counts.waiting.toLocaleString('th-TH')} คน — ยังไม่ถึงเวลาที่ตั้งไว้`,
    };
  }
  return { level: 'ok', tone: 'success', text: 'รอบนี้เดินครบแล้ว ไม่มีอะไรค้าง' };
}

/**
 * ป้ายแท็บ — เปลี่ยนเป็น **"สายที่ N"** (แผนแก้จุดงงข้อ 5 · 2 ก.ย. 2569)
 *
 * เดิมเจ้าของขอ "การโทรครั้งที่ N" (18 ส.ค.) แต่หลังจากมี dropdown
 * "รอบนี้คือสายที่เท่าไหร่" ในฟอร์ม (1 ก.ย.) ระบบเลยมีสองคำสำหรับเรื่องเดียวกัน
 * — Haiku ทดสอบแล้วถามว่า "ครั้งที่ 1/2/3 คืออะไร" ทั้งที่เพิ่งตั้ง "สายที่ 2" ในฟอร์มไป
 * ⇒ ใช้คำว่า "สายที่" ให้ตรงกันทั้งระบบ (คำที่คนเลือกเองตอนตั้งรอบชนะ)
 */
export function roundTabLabel(slot: number): string {
  return `สายที่ ${slot}`;
}

/** ช่องที่ต้องลงมือของรอบนี้ (เรียงตามลำดับที่โชว์บนจอ) — ใช้เน้นและทำสรุป */
export function actionableBuckets(counts: RoundCounts): FollowRoundBucket[] {
  return FOLLOW_ROUND_BUCKETS.filter((b) => bucketVisual(b, counts[b]).actionable);
}

/** ข้อความสรุปช่องที่ต้องลงมือ — ไม่มีเลยคืน null (ห้ามขึ้นข้อความว่าง) */
export function actionableSummary(counts: RoundCounts): string | null {
  const items = actionableBuckets(counts).map(
    (b) => `${FOLLOW_ROUND_BUCKET_LABEL[b]} ${counts[b].toLocaleString('th-TH')}`,
  );
  return items.length > 0 ? items.join(' · ') : null;
}
