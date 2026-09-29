/** ตัวดึง `/api/team-online` — หน้าทีม Online (29 ก.ย. 2569 · ช่วงเวลาแบบปฏิทินของแท็บ Dashboard) */
import { apiFetch } from '@/lib/apiFetch';
import type { TeamCompare, TeamOnlineResponse } from '@/lib/teamOnline';
import type { TrendGrain } from '@/lib/trends/timeBuckets';

export type TeamOnlineQuery = { from: string; to: string; grain: TrendGrain; compare: TeamCompare; bu?: string | null };

export async function fetchTeamOnline(q: TeamOnlineQuery): Promise<TeamOnlineResponse> {
  const p = new URLSearchParams({ from: q.from, to: q.to, grain: q.grain, compare: q.compare });
  if (q.bu) p.set('bu', q.bu);
  const r = await apiFetch(`/api/team-online?${p.toString()}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดหน้าทีม Online ไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as TeamOnlineResponse;
}
