/**
 * ═══ คอมเมนต์จาก So Scraping → ใบสมัคร (เจ้าของ 22 ต.ค. 2569) ═══
 * Choice: ลงหน้าผู้สมัคร Journey เดียวกับเจ้าหน้าที่เพิ่มเอง (ซ้ำก็คือซ้ำ) · ไม่มีเบอร์เก็บเฉย ๆ ·
 * AI ยังไม่โทรจนกว่า So Scraping เรียก ai-call (หรือเจ้าหน้าที่กดส่งเอง) — ตัวส่งอัตโนมัติข้ามใบที่ยังไม่เลือกวิธีโทร
 * ตรรกะล้วน (ตรวจข้อมูลขาเข้า) · ฝั่ง server อยู่ `api/_handlers/so-scraping-integration.ts`
 */
export const SO_SCRAPING_CREATED_BY = 'So Scraping';
export const SO_SCRAPING_CHANNEL_LABEL = 'Facebook คอมเมนต์';
/** ชื่อ key ใน `app_integration_keys` */
export const SO_SCRAPING_KEY_NAME = 'so-scraping';

export type SoScrapingLeadInput = {
  request_no: string;
  commenter_name: string | null;
  phone: string | null;
  comment_text: string | null;
  comment_url: string;
  post_url: string | null;
  group_name: string | null;
  commented_at: string | null;
};

const REQUEST_NO = /^[A-Za-z]{2,4}\d{7}$/;
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** เบอร์ไทย 10 หลัก (ตัด +66/66 นำหน้าให้) · ไม่ใช่เบอร์ = null */
export function normalizeCommentPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('66') && d.length === 11) d = `0${d.slice(2)}`;
  return /^0\d{9}$/.test(d) ? d : null;
}

/** ชื่อ-นามสกุลจากชื่อคนคอมเมนต์ (ช่องว่างแรก) · ไม่มีชื่อ = "ผู้สนใจจากคอมเมนต์" */
export function splitCommenterName(name: string | null): { first: string; last: string } {
  const n = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!n) return { first: 'ผู้สนใจจากคอมเมนต์', last: '' };
  const i = n.indexOf(' ');
  return i < 0 ? { first: n.slice(0, 120), last: '' } : { first: n.slice(0, i).slice(0, 120), last: n.slice(i + 1).slice(0, 120) };
}

export function parseSoScrapingLead(b: unknown): { ok: true; value: SoScrapingLeadInput } | { ok: false; message: string } {
  if (typeof b !== 'object' || b === null) return { ok: false, message: 'ต้องส่ง JSON' };
  const r = b as Record<string, unknown>;
  const requestNo = str(r.request_no, 32)?.toUpperCase() ?? null;
  if (!requestNo || !REQUEST_NO.test(requestNo)) return { ok: false, message: 'request_no ไม่ถูกต้อง (เช่น LBM6903001)' };
  const commentUrl = str(r.comment_url, 1000);
  if (!commentUrl || !/^https?:\/\//i.test(commentUrl)) return { ok: false, message: 'ต้องส่ง comment_url (ใช้กันซ้ำ)' };
  const at = str(r.commented_at, 64);
  const atMs = at ? Date.parse(at) : Number.NaN;
  return {
    ok: true,
    value: {
      request_no: requestNo,
      commenter_name: str(r.commenter_name, 200),
      phone: str(r.phone, 64),
      comment_text: str(r.comment_text, 4000),
      comment_url: commentUrl,
      post_url: str(r.post_url, 1000),
      group_name: str(r.group_name, 300),
      commented_at: Number.isFinite(atMs) ? new Date(atMs).toISOString() : null,
    },
  };
}
