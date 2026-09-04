import { isEmbedMode } from '@/lib/embedMode';

/**
 * **แท็กจำนวนคลิกบนหน้าสาธารณะ** (เจ้าของถาม 3 ก.ย. 2569)
 *
 * ที่มีอยู่ก่อนแล้ว: `recruit_posting_links.hit_count` นับ **คลิกเปิดลิงก์ช่องทาง**
 * ตัวนี้เก็บสิ่งที่ยังไม่มี — เข้ามาแล้ว **กดดูงานใบไหน / กดสมัครใบไหน**
 *
 * 🔴 **ยิงแล้วลืม (fire-and-forget)** — ห้ามให้การนับคลิกหน่วงหรือทำให้ปุ่มสมัครสะดุด
 * 🔴 **นับเฉพาะหน้าสาธารณะ** — เจ้าหน้าที่กดดูใบขอในระบบไม่ใช่ "คนสนใจงาน"
 *    ถ้านับปนกัน เลขจะโป่งด้วยการกดของทีมเราเอง แล้วอ่านไม่ได้ว่าประกาศไหนดังจริง
 */
export type PublicClickAction = 'open_job' | 'open_apply' | 'submit';

/** รหัสลิงก์ช่องทางที่พาเข้ามา (ถ้ามี) — `/apply/p/<code>` หรือ `?ref=<code>` */
function linkCodeFromUrl(): string | null {
  const m = window.location.pathname.match(/^\/apply\/p\/([^/?#]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  const ref = new URLSearchParams(window.location.search).get('ref');
  return ref ? ref.slice(0, 40) : null;
}

export function trackPublicClick(
  action: PublicClickAction,
  target: { jobRef?: string | null; postingId?: string | null } = {},
): void {
  try {
    const body = JSON.stringify({
      action,
      job_ref: target.jobRef ?? null,
      posting_id: target.postingId ?? null,
      link_code: linkCodeFromUrl(),
      embedded: isEmbedMode(),
    });
    // keepalive = ส่งให้จบแม้ผู้ใช้กดแล้วหน้าเปลี่ยนทันที
    void fetch('/api/public/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // นับพลาดไม่เป็นไร — ห้ามให้ล้มการสมัครงาน
  }
}
