import { apiFetch } from './apiFetch';
import type { RecruitOverviewResponse } from './recruitOverviewTypes';

/** หน้า "ภาพรวมงานสรรหา" — `month` = 'YYYY-MM' (ไม่ส่ง = เดือนนี้) */
export async function fetchRecruitOverview(
  month?: string | null,
  /** ช่วงที่เลือกเอง (รายวัน/ช่วง · 5 ต.ค. 2569) — ส่งมา = ไม่ใช้ month */
  range?: { from: string; to: string; all?: boolean } | null,
  /** ผู้ใช้หลาย BU เลือกทีละ BU (26 ต.ค. 2569) · null = ค่าเริ่มของเซิร์ฟเวอร์ */
  bu?: string | null,
): Promise<RecruitOverviewResponse> {
  const p = new URLSearchParams();
  if (bu) p.set('bu', bu);
  if (range) {
    p.set('from', range.from);
    p.set('to', range.to);
    if (range.all) p.set('all', '1');
  } else if (month) p.set('month', month);
  const qs = p.toString();
  const r = await apiFetch(`/api/recruit-overview${qs ? `?${qs}` : ''}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดภาพรวมงานสรรหาไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as RecruitOverviewResponse;
}

/** ชื่อ/เบอร์ตาม id (29 ต.ค. 2569 ป๊อปรายชื่อของภาพรวม) — ทีละ 100 id ต่อครั้ง (ความยาว URL) · ในขอบเขต BU ของผู้ใช้ */
export type ApplicantNameRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  unit_name: string | null;
  job_title: string | null;
  position_interest: string | null;
  created_at: string | null;
};

export async function fetchApplicantNames(ids: readonly string[]): Promise<ApplicantNameRow[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const parts = await Promise.all(
    chunks.map(async (chunk) => {
      const r = await apiFetch(`/api/recruit-overview?names=${encodeURIComponent(chunk.join(','))}`);
      if (!r.ok) throw new Error(`โหลดรายชื่อไม่สำเร็จ (HTTP ${r.status})`);
      return ((await r.json()) as { rows: ApplicantNameRow[] }).rows;
    }),
  );
  return parts.flat();
}
