/**
 * เส้นข้อมูลบอร์ด 4 ทีมบนหน้าแรก (26 ส.ค. 2569)
 * โครงผลลัพธ์นิยามที่ src/lib/officeTeam.ts (pure) — เส้นนี้แค่ fetch
 */
import { apiFetch } from '@/lib/apiFetch';
import type { BoardTeams } from '@/lib/officeTeam';

export type OfficeTeamResponse = {
  generated_at: string;
  /** BU กลางที่เส้นกรองให้ (ไม่มี/null = ไม่กรอง) */
  bu?: string | null;
  open_total: number;
  teams: BoardTeams;
};

/** `bu` = BU กลางชุดแผนก (หน้าหลักโฉม 3 ก้อน) · ไม่ส่ง = ผลเดิมทุกอย่าง */
export async function fetchOfficeTeam(bu?: string | null): Promise<OfficeTeamResponse> {
  const r = await apiFetch(bu ? `/api/office-team?bu=${encodeURIComponent(bu)}` : '/api/office-team');
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดบอร์ดทีมไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as OfficeTeamResponse;
}
