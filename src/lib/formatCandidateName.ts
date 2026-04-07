import type { Candidate } from '@/types';

/** แสดงชื่อเต็ม: คำนำหน้า + ชื่อ + นามสกุล (เว้นวรรคอัตโนมัติ) */
export function formatCandidateDisplayName(
  c: Pick<Candidate, 'first_name' | 'last_name'> & { title_prefix?: string | null },
): string {
  const p = (c.title_prefix ?? '').trim();
  const f = (c.first_name ?? '').trim();
  const l = (c.last_name ?? '').trim();
  return [p, f, l].filter(Boolean).join(' ');
}
