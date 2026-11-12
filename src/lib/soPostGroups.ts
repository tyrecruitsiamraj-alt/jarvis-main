/**
 * ═══ โพสต์ลงกลุ่ม Facebook จาก So Scraping — การ์ด "5." ในภาพรวมงานสรรหา (เจ้าของ 11 พ.ย. 2569 · ข้อ 13 ของ
 * `api-scraper/docs/JARVIS_OPTIONS_PROMPT.md`) ═══
 * GET {base_url}/api/integrations/jarvis/post-groups?from=&to=&bu=&page=&page_size= (เรียกจาก server เท่านั้น)
 * 🔴 สถานะ/คำ/เหตุ ใช้ตามที่ So Scraping ส่งมา (`status_label` · `error`) ห้ามคิดเอง — นิยามเดียวกับหน้า So Scraping
 * ตรรกะล้วน (แปลงคำตอบ) ใช้ทั้งฝั่ง server และหน้าจอ
 */

export type SoPostGroupStatus = { key: string; label: string };

export type SoPostGroupRow = {
  requestNo: string | null;
  position: string | null;
  orderedAt: string | null;
  orderedByName: string | null;
  account: string | null;
  fbGroupId: string | null;
  groupName: string | null;
  status: string;
  statusLabel: string;
  postedAt: string | null;
  postLink: string | null;
  error: string | null;
  /** กองเหตุที่ So Scraping ส่งมา (key ใน `reasonGroups`) · ยังไม่ส่ง = null */
  reasonGroup: string | null;
};

export type SoPostGroups = {
  from: string;
  to: string;
  bu: string | null;
  page: number;
  pages: number;
  total: number;
  statuses: SoPostGroupStatus[];
  /** ลำดับ/คำของกองเหตุ (สเปกขอ So Scraping 12 พ.ย. 2569) · ยังไม่ส่ง = [] */
  reasonGroups: SoPostGroupStatus[];
  counts: Record<string, number>;
  rows: SoPostGroupRow[];
};

export const SO_POST_GROUPS_PAGE_SIZE = 10;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback);

/** ลิงก์โพสต์ต้องเป็น facebook.com เท่านั้น (กันลิงก์แปลกจากข้อมูลภายนอก) — ไม่ใช่ = ไม่มีลิงก์ */
function safeFbLink(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && /(^|\.)facebook\.com$/i.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** แปลงคำตอบของ So Scraping — ช่องที่หายไปเป็นค่าว่าง ไม่เดา · `counts` ครบทุกสถานะ (ไม่มี = 0) */
export function parseSoPostGroups(body: unknown): SoPostGroups {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const statuses: SoPostGroupStatus[] = (Array.isArray(b.statuses) ? b.statuses : [])
    .map((s) => (s && typeof s === 'object' ? (s as Record<string, unknown>) : {}))
    .map((s) => ({ key: str(s.key) ?? '', label: str(s.label) ?? str(s.key) ?? '' }))
    .filter((s) => s.key);
  const reasonGroups: SoPostGroupStatus[] = (Array.isArray(b.reason_groups) ? b.reason_groups : [])
    .map((s) => (s && typeof s === 'object' ? (s as Record<string, unknown>) : {}))
    .map((s) => ({ key: str(s.key) ?? '', label: str(s.label) ?? str(s.key) ?? '' }))
    .filter((s) => s.key);
  const rawCounts = (b.counts && typeof b.counts === 'object' ? b.counts : {}) as Record<string, unknown>;
  const counts = Object.fromEntries(statuses.map((s) => [s.key, int(rawCounts[s.key], 0)]));
  const labelOf = new Map(statuses.map((s) => [s.key, s.label]));
  const rows: SoPostGroupRow[] = (Array.isArray(b.rows) ? b.rows : []).map((r) => {
    const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const status = str(x.status) ?? '';
    return {
      requestNo: str(x.request_no),
      position: str(x.position),
      orderedAt: str(x.ordered_at),
      orderedByName: str(x.ordered_by_name) ?? str(x.ordered_by),
      account: str(x.account),
      fbGroupId: str(x.fb_group_id),
      groupName: str(x.group_name),
      status,
      statusLabel: str(x.status_label) ?? labelOf.get(status) ?? status,
      postedAt: str(x.posted_at),
      postLink: safeFbLink(x.post_link),
      error: str(x.error),
      reasonGroup: str(x.reason_group),
    };
  });
  const total = int(b.total, rows.length);
  return {
    from: str(b.from) ?? '',
    to: str(b.to) ?? '',
    bu: str(b.bu),
    page: Math.max(1, int(b.page, 1)),
    pages: Math.max(1, int(b.pages, 1)),
    total,
    statuses,
    reasonGroups,
    counts,
    rows,
  };
}

/**
 * ผลเมื่อกรองตามสถานะ (กดช่องตัวเลข) — `reasons` = เหตุที่ So Scraping ส่งมา จัดกลุ่มนับ (null = ไม่มีเหตุ) มากไปน้อย
 * `reasonTree` = แบ่งกองตาม `reason_group` ที่ So Scraping ส่ง (เจ้าของ 12 พ.ย. 2569 เลือกให้ So Scraping แบ่ง) · ยังไม่ส่ง = [] (จอใช้ `reasons` แบบเดิม)
 */
export type SoReasonGroup = { key: string; label: string; n: number; items: Array<{ error: string | null; n: number }> };
export type SoPostGroupsFiltered = SoPostGroups & { status: string | null; filteredTotal: number; reasons: Array<{ error: string | null; n: number }>; reasonTree: SoReasonGroup[] };

const countErrors = (list: readonly SoPostGroupRow[]) => {
  const byErr = new Map<string | null, number>();
  for (const r of list) byErr.set(r.error, (byErr.get(r.error) ?? 0) + 1);
  return [...byErr].map(([error, n]) => ({ error, n })).sort((a, b) => b.n - a.n);
};

export function filterSoPostGroups(
  all: { statuses: SoPostGroupStatus[]; reasonGroups?: SoPostGroupStatus[]; rows: SoPostGroupRow[] },
  meta: { from: string; to: string; bu: string | null },
  status: string,
  page: number,
): SoPostGroupsFiltered {
  const counts = Object.fromEntries(all.statuses.map((s) => [s.key, 0]));
  for (const r of all.rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const picked = all.rows.filter((r) => r.status === status);
  const pages = Math.max(1, Math.ceil(picked.length / SO_POST_GROUPS_PAGE_SIZE));
  const p = Math.min(pages, Math.max(1, page));
  // กองเหตุ — มีแถวไหนติดกองมาเมื่อไรถึงแบ่ง (แถวที่ไม่มีกองไปรวม "ไม่ระบุกอง") · ผลรวมกอง = จำนวนในสถานะนี้
  const labelOf = new Map((all.reasonGroups ?? []).map((g) => [g.key, g.label]));
  const reasonTree: SoReasonGroup[] = picked.some((r) => r.reasonGroup)
    ? [...new Set(picked.map((r) => r.reasonGroup ?? ''))]
        .map((key) => {
          const list = picked.filter((r) => (r.reasonGroup ?? '') === key);
          return { key: key || '-', label: key ? labelOf.get(key) ?? key : 'ไม่ระบุกอง', n: list.length, items: countErrors(list) };
        })
        .sort((a, b) => b.n - a.n)
    : [];
  return {
    ...meta,
    page: p,
    pages,
    total: all.rows.length,
    statuses: all.statuses,
    reasonGroups: all.reasonGroups ?? [],
    counts,
    rows: picked.slice((p - 1) * SO_POST_GROUPS_PAGE_SIZE, p * SO_POST_GROUPS_PAGE_SIZE),
    status,
    filteredTotal: picked.length,
    reasons: countErrors(picked),
    reasonTree,
  };
}

/** ยอดต่อเลขใบขอ — การ์ดบนหน้าโพสต์ประกาศ "งานไหน สั่งไปเท่าไหร่ โพสต์ได้เท่าไหร่" (เจ้าของ 12 พ.ย. 2569) */
export type SoPostSummary = { statuses: SoPostGroupStatus[]; byRequest: Record<string, { total: number; counts: Record<string, number> }> };

export function summarizeSoPostGroups(all: { statuses: SoPostGroupStatus[]; rows: SoPostGroupRow[] }): SoPostSummary {
  const byRequest: SoPostSummary['byRequest'] = {};
  for (const r of all.rows) {
    if (!r.requestNo) continue;
    const x = (byRequest[r.requestNo] ??= { total: 0, counts: {} });
    x.total += 1;
    x.counts[r.status] = (x.counts[r.status] ?? 0) + 1;
  }
  return { statuses: all.statuses, byRequest };
}
