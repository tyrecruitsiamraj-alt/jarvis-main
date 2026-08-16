import { apiFetch } from '@/lib/apiFetch';

/**
 * เลนสรรหา — "หาคนเพิ่ม + ส่ง AI โทร" ข้าม 3 แหล่ง (R2b · เจ้าของเคาะ 16 ส.ค. 2569)
 *
 * สรรหา = จัดการ **คนที่ยังไม่สมัคร** → Lumos โทรก่อน แล้วคนตามเก็บใบสมัคร
 * (ต่างจากเลนคัดสรรที่คนโทรก่อน แล้วค่อยกดหาเพิ่ม — `/api/matching/irecruit-candidates`)
 *
 * ข้อความสรุปทั้งหมดสร้างจากฟังก์ชัน pure ในไฟล์นี้ที่เดียว เพื่อให้ป้ายบอกแหล่ง
 * บนผลค้นกับบนสรุปตอนส่งตรงกันเสมอ (เจ้าของขอ)
 */

export type RecruitLaneSource = 'irecruit' | 'so_recruit' | 'checklist';

export const RECRUIT_LANE_SOURCE_LABEL: Record<RecruitLaneSource, string> = {
  irecruit: 'จาก iRecruit',
  so_recruit: 'จากฐานใหม่',
  checklist: 'จาก Checklist',
};

export type RecruitLaneMatch = {
  source: RecruitLaneSource;
  source_label: string;
  ref: string;
  full_name: string;
  phone_number: string | null;
  position_text: string;
  location_label: string | null;
  sex: string | null;
  age: number | null;
  tier: 'green' | 'yellow' | 'red';
  reason: string;
};

export type RecruitLaneSourceStat = {
  source: RecruitLaneSource;
  label: string;
  loaded: number;
  error: string | null;
};

export type RecruitLaneDispatch = {
  queued: number;
  duplicated: string[];
  skipped: Array<{ ref: string; name: string; reason: string }>;
  cooldownSkipped: number;
  leadCooldownSkipped: number;
  queuedBySource: Record<RecruitLaneSource, number>;
};

export type RecruitLaneResult = {
  jobId: string;
  request_no: string | null;
  job_family_label: string;
  pool_size: number;
  sources: RecruitLaneSourceStat[];
  duplicates_dropped: number;
  on_board_dropped: number;
  board_check_unavailable: boolean;
  shortlisted: number;
  matches: RecruitLaneMatch[];
  dispatch: RecruitLaneDispatch | null;
};

export async function fetchRecruitLaneCandidates(
  jobId: string,
  options?: { send?: boolean; refresh?: boolean },
): Promise<RecruitLaneResult> {
  const params = new URLSearchParams({ jobId });
  if (options?.send) params.set('send', '1');
  if (options?.refresh) params.set('refresh', '1');
  const r = await apiFetch(`/api/matching/recruit-lane?${params.toString()}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as {
      message?: string;
      detail?: string;
      error?: string;
    };
    throw new Error(data.message || data.detail || data.error || `ค้นหาไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as RecruitLaneResult;
}

/**
 * สรุปกองที่ค้นเจอ — "ค้นจาก N คน (จาก Checklist a · จากฐานใหม่ b · จาก iRecruit c)"
 * แหล่งที่อ่านไม่ได้ต้อง**บอกออกมา** ไม่ใช่แสดงเป็น 0 เงียบ ๆ (0 = ไม่มีคน คนละเรื่องกับ อ่านไม่ได้)
 */
export function recruitLanePoolSummary(result: {
  pool_size: number;
  sources: RecruitLaneSourceStat[];
  duplicates_dropped: number;
  on_board_dropped: number;
  board_check_unavailable: boolean;
}): string {
  const parts: string[] = [`ค้นจากกอง ${result.pool_size.toLocaleString('th-TH')} คน`];
  const ok = result.sources.filter((s) => !s.error);
  if (ok.length > 0) {
    parts.push(ok.map((s) => `${s.label} ${s.loaded.toLocaleString('th-TH')}`).join(' · '));
  }
  const failed = result.sources.filter((s) => s.error);
  if (failed.length > 0) parts.push(`⚠️ อ่านไม่ได้: ${failed.map((s) => s.label).join(' · ')}`);
  if (result.duplicates_dropped > 0) parts.push(`ตัดคนซ้ำข้ามแหล่ง ${result.duplicates_dropped}`);
  if (result.on_board_dropped > 0) parts.push(`ได้ใบสมัครแล้ว ${result.on_board_dropped} (ไปเลนคัดสรร)`);
  if (result.board_check_unavailable) parts.push('⚠️ เช็คบอร์ด ERP ไม่ได้ — อาจมีคนที่ได้ใบสมัครแล้วปนอยู่');
  return parts.join(' · ');
}

/** สรุปผลส่งคิว — "ส่ง AI โทร N คน (จาก Checklist a · …) · ข้าม …" */
export function recruitLaneSendSummary(d: RecruitLaneDispatch): string {
  const parts: string[] = [`ส่ง AI โทร ${d.queued} คน`];
  const bySource = (Object.keys(RECRUIT_LANE_SOURCE_LABEL) as RecruitLaneSource[])
    .filter((s) => (d.queuedBySource?.[s] ?? 0) > 0)
    .map((s) => `${RECRUIT_LANE_SOURCE_LABEL[s]} ${d.queuedBySource[s]}`);
  if (bySource.length > 0) parts.push(bySource.join(' · '));
  if (d.cooldownSkipped > 0) parts.push(`ข้าม ${d.cooldownSkipped} (เพิ่งติดต่อเรื่องงานนี้ใน 30 วัน)`);
  if (d.leadCooldownSkipped > 0) {
    parts.push(`ข้าม ${d.leadCooldownSkipped} (ใบสนใจที่เพิ่งถูกโทรเรื่องงานอื่น)`);
  }
  if (d.duplicated.length > 0) parts.push(`เคยส่งแล้ว ${d.duplicated.length}`);
  if (d.skipped.length > 0) parts.push(`ส่งไม่ได้ ${d.skipped.length}`);
  return parts.join(' · ');
}

/** สีชิปของ tier — เขียว/เหลือง/แดง ตามผล AI */
export function tierChipClass(tier: RecruitLaneMatch['tier']): string {
  if (tier === 'green') return 'jarvis-chip jarvis-chip-success';
  if (tier === 'red') return 'jarvis-chip jarvis-chip-danger';
  return 'jarvis-chip jarvis-chip-warn';
}
