import React from 'react';
import type { JobRequest } from '@/types';
import { fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import type { RecruitPosting } from '@/lib/recruitPostings';
import { buildReleaseIndex, fetchJobReleases, type JobRelease } from '@/lib/jobPublicReleaseApi';
import { fetchReleaseSkips } from '@/lib/jobReleaseSkipApi';
import { buildSkipIndex, type JobReleaseSkip } from '@/lib/jobReleaseSkips';
import { buildJobKeyIndex } from '@/lib/jobKeyIndex';

/**
 * ═══ ของที่ป๊อปประกาศต้องรู้ต่อใบ — ใบขอ · ลิงก์สมัคร · ทะเบียนประกาศ · ทะเบียน "ไม่ประกาศ" (2 ต.ค. 2569) ═══
 *
 * แยกจาก `BoardPostingSteps` (ป๊อป 4 ขั้นเดิม — ทางถอย ห้ามแตะ) ให้ป๊อปหน้าเดียว (`BoardPublishSheet`) ใช้
 * กติกาเดิมทั้งหมด:
 * - ทะเบียนอ่านไม่ได้ = **fail-closed** (ถือว่ายังไม่ประกาศ · ยังไม่มีลิงก์) เหมือนฝั่ง server
 * - ทะเบียน "ไม่ประกาศ" อ่านไม่ได้ = `null` = ไม่รู้ ⇒ จอต้องไม่โชว์ปุ่มที่อาจขัดกับของจริง
 * - 🔴 ลิงก์ของใบหาผ่าน `buildJobKeyIndex` ไม่ใช่ `===` (id ใบขอมี 3 รูป — ดู `jobKeyIndex.ts`)
 */
export function useJobPublishRegistry(id: string) {
  const [job, setJob] = React.useState<JobRequest | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [releases, setReleases] = React.useState<JobRelease[] | null>(null);
  const [skips, setSkips] = React.useState<JobReleaseSkip[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    setError(null);
    setJob(null);
    fetchSiamrajUnitRequest(id)
      .then((j) => {
        if (alive) setJob(j);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'โหลดใบขอไม่สำเร็จ');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const loadPostings = React.useCallback(async () => {
    try {
      setPostings(await fetchRecruitPostings());
    } catch {
      setPostings([]);
    }
  }, []);

  const loadReleases = React.useCallback(async () => {
    try {
      setReleases(await fetchJobReleases());
    } catch {
      setReleases([]);
    }
  }, []);

  const loadSkips = React.useCallback(async () => {
    try {
      setSkips(await fetchReleaseSkips());
    } catch {
      setSkips(null);
    }
  }, []);

  React.useEffect(() => {
    void loadPostings();
    void loadReleases();
    void loadSkips();
  }, [loadPostings, loadReleases, loadSkips]);

  /** ประกาศ/ลิงก์ทั้งหมดของใบนี้ (ใหม่ → เก่า) — `null` = ยังโหลดไม่เสร็จ */
  const jobPostings = React.useMemo<RecruitPosting[] | null>(() => {
    if (!postings) return null;
    const idx = buildJobKeyIndex<RecruitPosting[]>(
      postings.map((p) => [p.jobId, [p]] as const),
      (existing, incoming) => [...existing, ...incoming],
    );
    return (job ? idx.get(job.id) : undefined) ?? idx.get(id) ?? [];
  }, [postings, job, id]);
  const latestPosting = jobPostings?.[0] ?? null;
  /** ลิงก์สมัครที่ยังใช้ได้ (ประกาศที่ยังเปิด) — `null` = ยังโหลดไม่เสร็จ */
  const linkCount = jobPostings
    ? jobPostings.filter((p) => p.status === 'open').reduce((sum, p) => sum + p.links.length, 0)
    : null;

  /** อยู่ในทะเบียนประกาศไหม — `null` = ยังอ่านไม่เสร็จ (ห้ามเดา) */
  const released = React.useMemo<boolean | null>(() => {
    if (!releases || !job) return null;
    return buildReleaseIndex(releases).has(job.id);
  }, [releases, job]);

  /** แถว "ไม่ประกาศ" ของใบนี้ — `undefined` = ยังอ่านไม่ได้ · `null` = ยังไม่ได้ตั้ง */
  const skip = React.useMemo<JobReleaseSkip | null | undefined>(
    () => (skips && job ? (buildSkipIndex(skips).get(job.id) ?? null) : undefined),
    [skips, job],
  );

  return { job, error, postings, jobPostings, latestPosting, linkCount, released, skip, loadPostings, loadReleases, loadSkips };
}
