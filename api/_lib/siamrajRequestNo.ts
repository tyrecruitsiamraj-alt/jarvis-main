import { isOpenStaffingRowForRemaining, type StaffingOpenRow } from './siamrajStaffingOpen.js';

const DIGITS_ONLY_REQUEST_NO = /^\d{5,}$/;

/** ส่วนตัวเลขท้ายเลขใบขอ เช่น LBM6905015 → 6905015 */
export function extractRequestNoDigitSuffix(value: string): string | null {
  const m = value.trim().match(/\d{5,}$/);
  return m ? m[0] : null;
}

/**
 * ดึง prefix จาก site_code เช่น 67LBDL0324 → LBD
 * ใช้เมื่อ request_no ใน Siamraj เก็บแค่ตัวเลข
 */
export function extractSiteCodeRequestPrefix(siteCode?: string | null): string | null {
  const s = (siteCode || '').trim();
  const m = s.match(/^\d{2}([A-Za-z]+)L/i);
  return m?.[1]?.toUpperCase() || null;
}

/** แสดงเลขใบขอให้มี prefix ภาษาอังกฤษเมื่อ DB เก็บแค่ตัวเลข */
export function normalizeSiamrajRequestNoForDisplay(
  raw: string,
  hints?: { siteCode?: string | null; departmentCode?: string | null },
): string {
  const t = raw.trim();
  if (!t || !DIGITS_ONLY_REQUEST_NO.test(t)) return t;
  const fromSite = extractSiteCodeRequestPrefix(hints?.siteCode);
  if (fromSite) return `${fromSite}${t}`;
  const dept = (hints?.departmentCode || '').trim().toUpperCase();
  if (dept.length >= 2 && dept.length <= 4) return `${dept}${t}`;
  return t;
}

export function requestNoMatchesLookup(query: string, requestNo: string): boolean {
  const q = query.trim().toLowerCase();
  const no = requestNo.trim().toLowerCase();
  if (!q || !no) return false;
  if (no === q || no.includes(q) || q.includes(no)) return true;
  const qDigits = extractRequestNoDigitSuffix(q);
  const noDigits = extractRequestNoDigitSuffix(no);
  return !!(qDigits && noDigits && qDigits === noDigits);
}

function prefixSimilarity(hint: string, requestNo: string): number {
  const h = hint.replace(/\d+$/, '').toLowerCase();
  const r = requestNo.replace(/\d+$/, '').toLowerCase();
  if (!h || !r) return 0;
  if (r.includes(h) || h.includes(r)) return 100;
  let score = 0;
  let j = 0;
  for (const c of h) {
    const idx = r.indexOf(c, j);
    if (idx < 0) continue;
    score += 1;
    j = idx + 1;
  }
  return score;
}

/** เลือกใบขอที่ตรงกับคำค้นหามากที่สุดเมื่อมีหลายใบที่ลงท้ายเลขเดียวกัน */
export function pickBestRequestNoCandidate<T extends StaffingOpenRow & { request_no?: string | null }>(
  rows: T[],
  lookupHint: string,
): T | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  const hint = lookupHint.trim();
  const ranked = [...rows].sort((a, b) => {
    const aOpen = isOpenStaffingRowForRemaining(a) ? 1 : 0;
    const bOpen = isOpenStaffingRowForRemaining(b) ? 1 : 0;
    if (bOpen !== aOpen) return bOpen - aOpen;

    const aPrefix = prefixSimilarity(hint, (a.request_no || '').trim());
    const bPrefix = prefixSimilarity(hint, (b.request_no || '').trim());
    if (bPrefix !== aPrefix) return bPrefix - aPrefix;

    return (b.request_no || '').localeCompare(a.request_no || '');
  });

  return ranked[0] ?? null;
}
