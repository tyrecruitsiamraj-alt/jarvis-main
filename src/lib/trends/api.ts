/**
 * ตัวดึงข้อมูลของแท็บ Dashboard — เส้นเดียว `/api/dashboard-trends` (อ่านอย่างเดียว)
 * 🔴 โหลดไม่ได้ต้อง throw ให้จอบอกว่า "ยังบอกเลขไม่ได้" — ห้ามคืน [] (ว่าง = "ไม่มีงาน" ซึ่งคนละเรื่อง)
 */
import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage } from '@/lib/api';
import type {
  ApplicantTrendRow,
  DashboardTrendSection,
  FollowTrendRow,
  ReleaseTrendRow,
  RequestTrendPayload,
} from './types';

async function getJson<T>(section: DashboardTrendSection, from: string, to?: string): Promise<T> {
  const q = new URLSearchParams({ section, from });
  if (to) q.set('to', to);
  const r = await apiFetch(`/api/dashboard-trends?${q}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดข้อมูล Dashboard ไม่สำเร็จ'));
  return (await r.json()) as T;
}

export async function fetchFollowTrendRows(from: string, to: string): Promise<FollowTrendRow[]> {
  return (await getJson<{ rows: FollowTrendRow[] }>('follow', from, to)).rows;
}

export async function fetchApplicantTrendRows(from: string, to: string): Promise<ApplicantTrendRow[]> {
  return (await getJson<{ rows: ApplicantTrendRow[] }>('applicants', from, to)).rows;
}

export async function fetchReleaseTrendRows(from: string, to: string): Promise<ReleaseTrendRow[]> {
  return (await getJson<{ rows: ReleaseTrendRow[] }>('releases', from, to)).rows;
}

/** ใบขอ ERP — ปลายช่วงฝั่งเซิร์ฟเวอร์คือ "วันนี้ + ครึ่งปี" เสมอ (ส่งแค่วันเริ่ม) */
export async function fetchRequestTrends(from: string): Promise<RequestTrendPayload> {
  return getJson<RequestTrendPayload>('requests', from);
}
