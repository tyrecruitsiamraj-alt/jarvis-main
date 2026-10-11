/**
 * เลื่อนแถบแนวนอนให้เห็นแท็บที่เปิดอยู่ (QA รอบ 2 ข้อ 32 · 11 ต.ค. 2569 · มือถือ "Dashboard" ถูกตัดเหลือ "Dashboa")
 * เลื่อนเฉพาะ **แนวนอนของแถบ** — ไม่ใช้ `scrollIntoView` เพราะจะเลื่อนทั้งหน้าตามไปด้วย
 * แถบไม่ล้น / แท็บอยู่ในจออยู่แล้ว = ไม่ทำอะไร
 */
export function scrollIntoViewX(container: HTMLElement | null, child: HTMLElement | null, pad = 12): void {
  if (!container || !child || container.scrollWidth <= container.clientWidth) return;
  const c = container.getBoundingClientRect();
  const r = child.getBoundingClientRect();
  if (r.left < c.left) container.scrollLeft -= c.left - r.left + pad;
  else if (r.right > c.right) container.scrollLeft += r.right - c.right + pad;
}
