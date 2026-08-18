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
 * 🔴 **เลข 0 ต้องไม่ติดสีร้อน** — กล่องว่างที่ยังแดงอยู่ทำให้คนไล่ดูของที่ไม่มีจริง
 * ทุกช่องที่นับได้ 0 ตกไปเป็นโทนเทาเสมอ ไม่ว่าจะเป็นช่องอะไร
 */

export type BucketVisual = {
  tone: ToneKey;
  /** true = ช่องที่ต้องลงมือทำ (ใช้เน้นกรอบ + ขึ้นในคำแนะนำ) */
  actionable: boolean;
};

/** โทนประจำช่องเมื่อ **มีคนอยู่ในช่อง** — 0 คนถูกลดเป็นเทาที่ `bucketVisual()` */
const BUCKET_BASE: Record<FollowRoundBucket, BucketVisual> = {
  all: { tone: 'neutral', actionable: false },
  waiting: { tone: 'neutral', actionable: false },
  calling: { tone: 'primary', actionable: false },
  connected: { tone: 'success', actionable: false },
  unreached: { tone: 'warn', actionable: true },
  went: { tone: 'success', actionable: false },
  not_went: { tone: 'danger', actionable: true },
};

/** สีของช่องตามจำนวนคนในช่อง */
export function bucketVisual(bucket: FollowRoundBucket, count: number): BucketVisual {
  if (!(count > 0)) return { tone: 'neutral', actionable: false };
  return BUCKET_BASE[bucket];
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
    return { level: 'empty', tone: 'neutral', text: 'ยังไม่มีใครอยู่รอบนี้' };
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

/** ป้ายแท็บ — เจ้าของขอคำเต็ม "การโทรครั้งที่ N" ไม่ใช่ "รอบ N" */
export function roundTabLabel(slot: number): string {
  return `การโทรครั้งที่ ${slot}`;
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
