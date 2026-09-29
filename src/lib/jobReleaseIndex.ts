/**
 * ใบนี้ปล่อยแล้วไหม — ตัวจับคู่ทะเบียนปล่อยใบ (`job_public_releases`) กับใบขอ **ที่เดียวของทั้งระบบ**
 *
 * ย้ายออกมาจาก `jobPublicReleaseApi.ts` 29 ก.ย. 2569 (เนื้อเดิมทุกบรรทัด) ให้ฝั่ง server เรียกตัวเดียวกับกล่องงานได้
 * (หน้าทีม Online นับเลน "ยังไม่ปล่อย / ปล่อยแล้วเงียบ" ต้องได้เลขเท่ากล่องงานเป๊ะ) — ไฟล์เดิม re-export ไว้ ผู้เรียกเดิมไม่ต้องแก้
 *
 * เทียบ **ทั้ง id เต็มและเลขที่ใบขอ**
 * 🔴 เหตุผลเดียวกับฝั่ง server: feed ให้ใบล่วงหน้าเป็น `siamraj-pre:XXX` แต่ของฝั่งเรา
 * บางที่เก็บ `siamraj-sql:XXX` — เทียบ id เต็มอย่างเดียวจะพลาดใบล่วงหน้าทั้งกอง
 * (กับดักเดิมของโปรเจกต์ที่ทำให้ชิป "ปล่อยลิงก์แล้ว" ไม่ติดกับใบล่วงหน้า)
 */
import { requestNoOf } from '@/lib/jobKeyIndex';

export type JobReleaseKey = { job_id: string; request_no: string | null };

export function buildReleaseIndex(releases: readonly JobReleaseKey[]): {
  has: (jobId: string) => boolean;
  count: number;
} {
  const ids = new Set<string>();
  const nos = new Set<string>();
  for (const r of releases) {
    ids.add(r.job_id);
    const no = (r.request_no || requestNoOf(r.job_id)).trim();
    if (no) nos.add(no);
  }
  return {
    has: (jobId: string) => ids.has(jobId) || nos.has(requestNoOf(jobId)),
    count: releases.length,
  };
}
