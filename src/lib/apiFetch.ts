/**
 * Same-origin API calls (Vite proxy in dev). Sends cookies for auth.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

/**
 * Error ที่ **พก HTTP status มาด้วย**
 *
 * 🔴 มีเพราะหน้าจอต้องแยก "ไม่มีสิทธิ์ (403)" ออกจาก "ต่อไม่ติด/ช้าเกิน"
 * ทางแก้ของสองอันนี้คนละเรื่องกัน — 403 กดลองใหม่กี่ครั้งก็ไม่สำเร็จ ต้องไปขอสิทธิ์
 * (เดิมทั้งคู่กลายเป็น Error ธรรมดา หน้าจอเลยเหมารวมว่า "ไม่มีข้อมูล" แล้วโชว์ 0)
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** อ่าน status ออกจาก error ที่รับมา — ไม่ใช่ HttpError = `null` */
export function httpStatusOf(e: unknown): number | null {
  return e instanceof HttpError ? e.status : null;
}
