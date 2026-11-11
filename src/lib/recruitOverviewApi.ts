import { apiFetch } from './apiFetch';
import type { RecruitOverviewResponse } from './recruitOverviewTypes';

/** หน้า "ภาพรวมงานสรรหา" — `month` = 'YYYY-MM' (ไม่ส่ง = เดือนนี้) */
export async function fetchRecruitOverview(
  month?: string | null,
  /** ช่วงที่เลือกเอง (รายวัน/ช่วง · 5 ต.ค. 2569) — ส่งมา = ไม่ใช้ month */
  range?: { from: string; to: string; all?: boolean } | null,
  /** ผู้ใช้หลาย BU เลือกทีละ BU (26 ต.ค. 2569) · null = ผลรวมทุก BU ในสิทธิ์ (29 ต.ค. 2569) */
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
  /** คนที่เก็บไปโทร · null = ยังไม่มีคนเก็บ (11 พ.ย. 2569) */
  claimed_by?: string | null;
  claimed_at?: string | null;
  /** ลงผลติดต่อล่าสุด · null = ยังไม่เคยลงผล */
  last_log_at?: string | null;
  last_log_ok?: boolean | null;
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

/**
 * ใครถือรายชื่อนี้ ทำไปถึงไหน (เจ้าของ 11 พ.ย. 2569 "บอกเลยว่าเก็บไปแล้วนะอยู่ที่ใคร … เก็บไปแล้วยังไม่โทรอยู่ใคร ค้างมากี่วันแล้ว")
 * - ไม่มีคนเก็บ = `free`
 * - เก็บแล้ว ยังไม่ลงผลหลังเก็บ = `waiting` + ค้างกี่วัน (วันไทย นับจากวันที่เก็บ)
 * - เก็บแล้ว ลงผลแล้ว = `called` + ติดต่อได้ไหม
 */
export type HolderState =
  | { kind: 'free' }
  | { kind: 'waiting'; who: string; days: number | null }
  | { kind: 'called'; who: string; ok: boolean | null; at: string };

const DAY_MS = 86_400_000;
const ymdBangkok = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

export function holderStateOf(r: Pick<ApplicantNameRow, 'claimed_by' | 'claimed_at' | 'last_log_at' | 'last_log_ok'>, now: Date): HolderState {
  const who = (r.claimed_by ?? '').trim();
  if (!who) return { kind: 'free' };
  const claimed = r.claimed_at ?? null;
  if (r.last_log_at && (!claimed || Date.parse(r.last_log_at) >= Date.parse(claimed))) {
    return { kind: 'called', who, ok: r.last_log_ok ?? null, at: r.last_log_at };
  }
  const days = claimed ? Math.max(0, Math.round((Date.parse(ymdBangkok(now.toISOString())) - Date.parse(ymdBangkok(claimed))) / DAY_MS)) : null;
  return { kind: 'waiting', who, days };
}

/** สรุปบนป๊อป: เก็บไปแล้วยังไม่โทร อยู่ที่ใคร กี่คน ค้างนานสุดกี่วัน · ยังไม่มีคนเก็บ · โทรแล้ว */
export function holderSummary(states: readonly HolderState[]): { waiting: Array<{ who: string; n: number; maxDays: number | null }>; free: number; called: number } {
  const by = new Map<string, { who: string; n: number; maxDays: number | null }>();
  let free = 0;
  let called = 0;
  for (const s of states) {
    if (s.kind === 'free') free += 1;
    else if (s.kind === 'called') called += 1;
    else {
      const cur = by.get(s.who) ?? { who: s.who, n: 0, maxDays: null };
      cur.n += 1;
      if (s.days !== null) cur.maxDays = Math.max(cur.maxDays ?? 0, s.days);
      by.set(s.who, cur);
    }
  }
  return { waiting: [...by.values()].sort((a, b) => b.n - a.n || a.who.localeCompare(b.who, 'th')), free, called };
}
