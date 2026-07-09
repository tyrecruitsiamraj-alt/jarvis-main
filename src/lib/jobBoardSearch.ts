import type { JobRequest } from '@/types';
import { unitRequestSearchBlob } from '@/lib/unitRequestDisplay';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';

export function isBoardVisibleJob(j: JobRequest): boolean {
  return j.status === 'open' || j.status === 'in_progress';
}

export function normBoardSearch(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

export function boardSearchTokens(input: string): string[] {
  return normBoardSearch(input)
    .split(/[\s,./\-_|]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** คำค้นหาบนบอร์ดงาน — รองรับคำย่อ กทม / กรุงเทพ */
export function jobBoardSearchBlob(j: JobRequest): string {
  const addr = j.location_address || '';
  const prov = inferProvinceFromAddress(addr);
  let extra = '';
  if (prov === 'กรุงเทพมหานคร' || /กรุงเทพ|กทม\.?|bangkok/i.test(addr)) {
    extra = ' กรุงเทพ กรุงเทพฯ กทม กทม. bangkok';
  }
  if (prov) extra += ` ${prov}`;
  return normBoardSearch(`${unitRequestSearchBlob(j)} ${addr}${extra}`);
}
