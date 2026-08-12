/**
 * "คนนี้แมทอยู่กี่งาน (และงานไหนบ้าง)" — ค้นผลแมทย้อนจาก card_id
 *
 * เจ้าของสั่ง 12 ส.ค. 2569: บนรายชื่อผู้สมัครต้องบอกว่า "คนนี้ match อยู่กี่งาน"
 * และตอนติ๊กส่งโทร คนที่แมทหลายงานต้องมี popup ให้เลือกว่าส่งงานไหน
 * (= ของค้างข้อ 8 ใน SESSION-HANDOFF §5: API ที่ค้น board_match_results ย้อนจาก card_id)
 *
 * ⚠️ นับเฉพาะ **ใบขอที่ยังเปิดอยู่และอยู่ใน BU scope ของผู้ใช้** — board_match_results
 * เก็บผลของใบที่ปิดไปแล้วด้วย นับดิบ ๆ จะได้เลขโตเกินจริง (ข้อมูลจริง: card 1805
 * อยู่ในผลแมท 113 ใบขอ ซึ่งส่วนใหญ่ปิดแล้ว) — ผู้เรียกต้องส่ง openJobs ที่กรอง
 * scope แล้วเข้ามา ไม่ให้ไฟล์นี้ตัดสินสิทธิ์เอง
 *
 * ⚠️ นับเฉพาะ tier เขียว/เหลือง (นิยาม "แนะนำ" เดียวกับ recommendedCandidateCount) —
 * แดงคือ AI บอกว่าไม่เหมาะ เอามานับ "แมทอยู่ N งาน" จะทำให้เลขไม่ตรงกับที่ตาเห็นบนจอ
 */
import { loadBoardMatchTierMap } from './boardMatchStore.js';

export type CandidateJobMatch = {
  jobId: string;
  /** tier ของคนนี้ในใบนั้น — เขียว/เหลืองเท่านั้น (แดงไม่นับเป็นแมท) */
  tier: 'green' | 'yellow';
};

/**
 * map card_id → ใบขอเปิดที่คนนั้นถูกแนะนำ (เขียว/เหลือง)
 * คืนเฉพาะคนที่ขอมา — คนที่ไม่แมทอะไรเลยได้ [] (ไม่หายไปจาก map ให้ client เดา)
 */
export async function loadCandidateJobMatches(
  cardIds: number[],
  openJobIds: ReadonlySet<string>,
): Promise<Map<number, CandidateJobMatch[]>> {
  const out = new Map<number, CandidateJobMatch[]>();
  for (const id of cardIds) out.set(id, []);
  if (cardIds.length === 0) return out;

  const wanted = new Set(cardIds);
  const tierMap = await loadBoardMatchTierMap();
  for (const [jobId, entry] of tierMap) {
    if (!openJobIds.has(jobId)) continue;
    for (const t of entry.tiers) {
      if (t.tier === 'red') continue;
      if (!wanted.has(t.cardId)) continue;
      out.get(t.cardId)!.push({ jobId, tier: t.tier });
    }
  }
  return out;
}
