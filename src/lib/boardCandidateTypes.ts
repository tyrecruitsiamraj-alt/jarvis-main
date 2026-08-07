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
