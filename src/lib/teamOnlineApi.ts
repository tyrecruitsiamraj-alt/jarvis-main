/** ตัวดึง `/api/team-online` — หน้าทีม Online (29 ก.ย. 2569) */
import { apiFetch } from '@/lib/apiFetch';
import type { TeamOnlineResponse, TeamPeriod } from '@/lib/teamOnline';

export async function fetchTeamOnline(period: TeamPeriod, bu?: string | null): Promise<TeamOnlineResponse> {
  const q = new URLSearchParams({ period });
  if (bu) q.set('bu', bu);
  const r = await apiFetch(`/api/team-online?${q.toString()}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดหน้าทีม Online ไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as TeamOnlineResponse;
}
