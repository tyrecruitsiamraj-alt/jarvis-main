/**
 * ═══ เหตุที่ตัวส่ง AI ไม่ส่ง — ข้อความชุดเดียว + ตัวแยกกล่อง (เจ้าของ 26 พ.ย. 2569) ═══
 * > *"ไม่เอาแยกกล่องใครกล่องมันไปเลยจบ ก็ไม่ต้องมีคำว่าไม่ส่ง Ai แล้วแต่แยกมาเลยว่าเรื่องไหนที่ไม่ส่ง Ai
 * > อายุเกินก็กล่อง อายุเกิน เบอร์โทรผิดก็กล่อง เบอร์โทรผิด ฯลฯ"*
 *
 * ตัวส่ง (`api/_lib/lumosDispatch.ts`) ใช้ข้อความพวกนี้ตอนข้าม แล้วจดลง `ai_block_reason` ของใบ
 * (ตัวส่งซ้ำทุก 5 นาที + ปุ่ม "ส่ง AI โทร") · แท็บผู้สมัครอ่านข้อความเดียวกันกลับมาแยกกล่อง (`aiBlockBoxOf`)
 * 🔴 แก้คำที่นี่ที่เดียว — ตัวแยกกล่องจับด้วยต้นข้อความ ถ้าแก้คำแต่ไม่แก้ที่นี่ คนจะตกกล่อง "พร้อมส่ง AI"
 */
import { SUPPRESSION_LEAD, SUPPRESSION_WRONG_NUMBER_LEAD } from './callFollowupPolicy';

export const AI_BLOCK_REASON = {
  noPhone: 'ไม่มีเบอร์มือถือที่ใช้โทรได้ (ต้องเป็นมือถือ 10 หลัก)',
  /** 🔴 ใบขอไม่มีรายได้ = AI ไม่โทร (6 ต.ค. 2569) */
  noIncome: 'ใบขอยังไม่ตั้งรายได้ — ตั้งรายได้ในป๊อปโพสต์ประกาศ (กล่องรายได้) ก่อน แล้วค่อยส่ง AI',
  /** ERP ช้า/ล่ม — กดส่งใหม่ได้เลย */
  factsUnread: 'อ่านรายได้ของใบขอไม่ทัน — ลองกดส่ง AI ใหม่อีกครั้ง',
  requestClosed: 'ใบขอปิดแล้ว — เลือกใบขอที่ยังเปิด หรือให้ AI ทักทายถามก่อน',
  held: 'เจ้าหน้าที่รับไปโทรเองอยู่ — AI ไม่โทรทับ',
  scrapNoName: 'ไม่มีชื่อ (ซ่อนชื่อบนเว็บหางาน) AI เรียกชื่อไม่ได้ — เก็บไปโทรเองแทน',
  /** สำรองเมื่อไม่รู้เหตุ — ปกติใช้ `suppressionReasonText` บอกเหตุจริง + วันที่ */
  suppressed: 'เบอร์นี้ถูกพักอยู่',
  declined: 'เคยปฏิเสธงานนี้ไปแล้ว — ไม่เสนอซ้ำ',
  employed: 'ได้งานแล้ว (มีสายติดตามงานใน 60 วัน) — ไม่เสนองานใหม่',
  /** จับคู่งาน 1 คน 1 ใบ · AI เสนอแล้วภายใน N วันส่งซ้ำไม่ได้ (25 พ.ย. 2569) */
  matchBusy: 'AI เสนองานคนนี้ไปแล้วไม่นานนี้ หรือมีงานอื่นเสนออยู่ — โทรเองได้ที่ "เก็บไปโทรเอง"',
  /** "ระบบตรวจไม่ได้" ไม่ใช่ "มีคนจองไปแล้ว" — ลองใหม่ได้ */
  guarded: 'ระบบตรวจบัญชีห้ามโทรไม่ได้ตอนนั้น จึงกันไว้ก่อน — กดส่งใหม่ได้',
} as const;

/** กล่องที่เหตุพาไป — `ready` = ลองใหม่ได้ (อ่านใบขอไม่ทัน · ตรวจไม่ได้ · ไม่รู้จักเหตุ) */
export type AiBlockBox =
  | 'ready'
  | 'no_income'
  | 'request_closed'
  | 'phone_paused'
  | 'declined_job'
  | 'bad_data'
  | 'employed'
  | 'offered_recently'
  | 'kept'
  | 'no_name';

const head = (s: string) => s.split(' — ')[0].trim();

/** ต้นข้อความ → กล่อง (ตรวจตามลำดับ · ต้นข้อความไม่ทับกัน) */
const BY_LEAD: ReadonlyArray<readonly [string, AiBlockBox]> = [
  [head(AI_BLOCK_REASON.noIncome), 'no_income'],
  [head(AI_BLOCK_REASON.requestClosed), 'request_closed'],
  [head(AI_BLOCK_REASON.noPhone), 'bad_data'],
  // เบอร์ผิด / ไม่ใช่เจ้าตัว (พักเบอร์เพราะคนรับไม่ใช่เจ้าของ) = กล่องเบอร์โทรผิด ไม่ใช่เบอร์ถูกพัก
  [SUPPRESSION_WRONG_NUMBER_LEAD, 'bad_data'],
  ...SUPPRESSION_LEAD.map((lead) => [lead, 'phone_paused'] as const),
  [head(AI_BLOCK_REASON.declined), 'declined_job'],
  [head(AI_BLOCK_REASON.employed), 'employed'],
  [head(AI_BLOCK_REASON.matchBusy), 'offered_recently'],
  [head(AI_BLOCK_REASON.held), 'kept'],
  [head(AI_BLOCK_REASON.scrapNoName), 'no_name'],
];

/** เหตุที่จดไว้ → กล่อง · ไม่มีเหตุ = null · เหตุที่ลองใหม่ได้/ไม่รู้จัก = `ready` (ตัวส่งตรวจซ้ำทุกด่านตอนกดอยู่แล้ว) */
export function aiBlockBoxOf(reason: string | null | undefined): AiBlockBox | null {
  const r = (reason ?? '').trim();
  if (!r) return null;
  for (const [lead, box] of BY_LEAD) if (r.startsWith(lead)) return box;
  return 'ready';
}
