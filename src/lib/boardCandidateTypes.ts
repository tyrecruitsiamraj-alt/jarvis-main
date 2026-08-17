/**
 * ชนิดข้อมูลของ "คนของเรา" (บอร์ด) และผลแมทจาก AI
 *
 * แยกออกมาจาก MatchingPage.tsx ตอนแตกไฟล์ — เดิมประกาศไว้ในหน้าเว็บ
 * ทำให้ component ที่แยกออกมาใช้ร่วมไม่ได้โดยไม่ import ย้อนกลับเข้าหน้า (วงกลม)
 *
 * ⚠️ รูปร่างต้องตรงกับที่ API ส่งมา — `api/_handlers/matching-board-candidates.ts`
 */

/** "คนของเรา" — ผ่านสัมภาษณ์แล้ว รอลงงาน (จาก board) แมทกับใบขอด้วย AI */
export type BoardCandidateMatch = {
  card_id: number;
  full_name: string;
  nick_name: string | null;
  mobile: string | null;
  sex_code: string | null;
  age: number | null;
  required_salary: number | null;
  job1_name: string | null;
  job2_name: string | null;
  province_name: string | null;
  amphur_name: string | null;
  /** ถังบนบอร์ด: 'To do' / 'ไม่มีงาน' (auto ค้นสองถังนี้) */
  column_label?: string | null;
  tier: 'green' | 'yellow' | 'red';
  reason: string;
};

/** ระดับความตรงของสกิล: เขียว=ตรง · เหลือง=ใกล้เคียง · แดง=คนละสาย */
export type MatchTier = BoardCandidateMatch['tier'];

/** ผลแมท "คนของเรา" ต่อใบขอ — ตัวเดียวกับที่หน้าจับคู่งานใช้ */
export type BoardMatchResult = {
  jobId: string;
  job_family_code: string;
  job_family_label: string;
  pool_size: number;
  matches: BoardCandidateMatch[];
  /** เป้า = อัตราที่ขอ × 3 — ต่ำกว่านี้ระบบค้นถัง "ไม่มีงาน" เพิ่มให้แล้ว */
  recommended_target?: number;
  fallback_used?: boolean;
  fallback_pool_size?: number;
};

/**
 * ผลจาก API — **AI คิดที่ worker หลังบ้านเท่านั้น** หน้าเว็บได้แค่ผลสำเร็จหรือสถานะรอ
 * (ห้ามมีหน้าไหนสั่งให้ AI คิดสด — เคยทำให้คำขอค้างเป็นนาทีต่อคนที่เปิดหน้า)
 */
export type BoardMatchResponse = BoardMatchResult & {
  computed_at?: string;
  /** ยังไม่มีผลของใบนี้ — ส่งเข้าคิวหลังบ้านให้แล้ว */
  pending?: boolean;
  /** สั่งค้นหาใหม่แล้ว — ผลที่เห็นคือของเดิม รอผลใหม่มาแทน */
  refresh_queued?: boolean;
  worker_active?: boolean;
};
