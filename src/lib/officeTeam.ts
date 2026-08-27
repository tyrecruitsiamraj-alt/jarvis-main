/**
 * ═══ บอร์ด 4 ทีมบนหน้าแรก — เมตริกตามสเปกเจ้าของ (26 ส.ค. 2569) ═══
 *
 * 🔴 **ประวัติที่ห้ามลืม (เจ้าของด่ามาแล้วสองทาง):**
 * 1. เมตริกชุดนี้เจ้าของ**พิมพ์สเปกเองทีมต่อทีม**และยืนยันว่า "โอเคกะแบบนั้น"
 * 2. รอบหนึ่งเคยยุบเหลือการ์ดเปล่า 4 ใบ (แค่ชื่อทีม+เลข 2 ตัว) → โดนด่า
 *    *"กล่องโง่ ๆ ที่ไม่รู้อะไรแล้วก็ต้องไปไล่กดหาเอง"* ⇒ **ห้ามยุบเมตริกทิ้งอีก**
 * 3. สิ่งที่เจ้าของสั่งเพิ่มคือ **ทุกบรรทัดรายละเอียดต้องกดแล้วนำทางไปหน้าที่
 *    เกี่ยวข้องกับบรรทัดนั้น** (*"กดรายละเอียดอันไหนก็นำทางไปอันนั้น"*)
 * 4. ของที่ตีตกถาวร: ฉาก isometric · รายชื่อคนนั่งโต๊ะ · การ์ดเปล่าไร้ข้อมูล
 *
 * ไฟล์นี้ = types + ตัวช่วย pure · ตัวดึงข้อมูลอยู่ `api/_handlers/office-team.ts`
 * ตัววาดอยู่ `src/components/home/TeamBoardPanel.tsx`
 * แหล่งข้อมูลต่อเมตริก (วัดฐานแล้ว) อยู่ `~/.claude/plans/home-team-board-redesign.md` H2
 */

/** ขั้นของคำขอโพส — นิยามเดียวกับ flow-summary (pending/in_progress/posted) ห้ามมีที่สอง */
export type StageCounts = { pending: number; in_progress: number; posted: number };

/** ตัวเลขต่อเลนของคิว Lumos */
export type LaneCounts = {
  total: number;
  /** รอส่งออก (ยังไม่ถึงมือ Lumos) */
  pending: number;
  /** Lumos รับไปแล้ว ยังไม่มีผลกลับ */
  waiting: number;
  /** มีผลกลับแล้ว */
  done: number;
  cancelled: number;
};

export type OnlineTeamStats = {
  open_total: number;
  released: number;
  unreleased: number;
  content: StageCounts;
  scraping: StageCounts;
};

export type RecruitTeamStats = {
  /** ใบเปิดที่มีคนสมัครเข้ามาแล้ว / ยังไม่มี */
  jobs_with_apps: number;
  jobs_without_apps: number;
  apps_total: number;
  /** ผู้สมัครที่มีการติดต่อแล้ว (AI หรือโทรมือ — นับคนแบบ union ห้ามบวกสองก้อน) */
  apps_contacted: number;
  apps_uncontacted: number;
  /** ใบสมัครที่มีนัดแล้ว */
  appts_made: number;
  /** มา/ไม่มา/เลื่อน — จาก application_appointment_results (089) ไม่ใช่ follow_entries */
  attendance: { showed: number; no_show: number; rescheduled: number };
};

export type LumosTeamStats = {
  /** เส้นทางเข้า: หน้าสาธารณะ (app-) · หน้า match (card-/ir-) · หน้า Follow */
  public: LaneCounts;
  match: LaneCounts;
  follow: LaneCounts;
};

export type BoardTeams = {
  online: OnlineTeamStats | null;
  recruit: RecruitTeamStats | null;
  lumos: LumosTeamStats | null;
  /** ทีมที่วัดไม่ได้ + เหตุผล — จอต้องวาด "วัดไม่ได้" ห้ามหายเงียบ ห้าม 0 ปลอม */
  errors: Partial<Record<'online' | 'recruit' | 'lumos', string>>;
};

/**
 * แถวคิว → เลนของทีม Lumos — นิยามเดียวที่ทั้ง SQL (office-team handler) และเทสต์ใช้
 * (person_ref มี 4 รูปเท่านั้น วัดจริง 26 ส.ค. 2569: app- · card- · ir- · follow-)
 * 🔴 แก้ฝั่งไหนต้องแก้อีกฝั่งให้ตรงกัน
 */
export function queueLane(
  personRef: string,
  jobRef: string,
): 'public' | 'match' | 'follow' | 'other' {
  if (jobRef === 'follow' || personRef.startsWith('follow-')) return 'follow';
  if (personRef.startsWith('app-')) return 'public';
  if (personRef.startsWith('card-') || personRef.startsWith('ir-')) return 'match';
  return 'other';
}
