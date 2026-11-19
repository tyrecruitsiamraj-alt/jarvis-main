/**
 * หน้าภาพรวมโหลดช้า (เจ้าของ 19 พ.ย. 2569) — วัดบนเว็บจริง: ลิงก์โพสต์เอง 11.3 วิ · รายการโพสต์ Autopost 3.9 วิ ต่อท้ายข้อมูลหลัก 4.2 วิ
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const apiFetch = vi.fn();
vi.mock('@/lib/apiFetch', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
const { fetchSoPostGroups, prefetchSoPostGroups } = await import('@/lib/soPostGroupsApi');

afterEach(() => vi.clearAllMocks());
const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe('ภาพรวมโหลดเร็วขึ้น', () => {
  it('รายการโพสต์ยิงพร้อมข้อมูลหลัก แล้วการ์ดรับคำตอบชุดเดิม ไม่ยิงซ้ำ · ช่วงไม่ตรง = ยิงใหม่', async () => {
    apiFetch.mockResolvedValue(ok({ total: 1819, rows: [] }));
    prefetchSoPostGroups({ from: '2026-11-01', to: '2026-11-19', bu: null });
    const got = await fetchSoPostGroups({ from: '2026-11-01', to: '2026-11-19', bu: null, page: 1 });
    expect(got.total).toBe(1819);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await fetchSoPostGroups({ from: '2026-11-02', to: '2026-11-19', bu: null, page: 1 });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('ฐานมีดัชนีใบสมัครตามลิงก์ (ลิงก์โพสต์เอง 11.3 → 1.8 วิ จึงกลับมาโหลดพร้อมหน้าได้ — ตารางรายคนของการสั่งงานใช้)', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    expect(src).not.toContain('selfOpen');
    expect(src).toContain('const outreachPeople = staff.key === filterKey && staff.rows && linkRows ? outreachByPerson(staff.rows, linkRows, model.cohort) : null;');
    const mig = readFileSync('migrations/191_application_link_id_index.sql', 'utf8');
    expect(mig).toContain('on public_job_applications (link_id) where link_id is not null');
  });
});
