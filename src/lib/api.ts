/**
 * เส้นตอบกลับเป็น HTML (500/502 ระหว่าง deploy · nginx) — ข้อความของคน ไม่ใช่ของนักพัฒนา
 * (QA 10 ต.ค. 2569: จอเคยขึ้น "API endpoint ไม่ได้ส่ง JSON กลับมา กรุณารันผ่าน vercel dev …")
 */
export const SERVER_NOT_JSON_TEXT = 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง';

export async function readErrorMessage(response: Response, fallback: string) {
    if (response.status === 404) {
      return "API_NOT_READY";
    }

    if (response.status === 413) {
      return 'ไฟล์ใหญ่เกินไป — ติดต่อผู้ดูแลระบบเพื่ออัปเดต nginx client_max_body_size';
    }
  
    const contentType = response.headers.get('content-type') || '';
  
    if (contentType.includes('application/json')) {
      const body = await response.json().catch(() => null);
      return body?.message || body?.error || fallback;
    }
  
    const text = await response.text().catch(() => '');
  
    if (text.includes('import ') || text.includes('<!DOCTYPE html') || text.includes('<html')) {
      return SERVER_NOT_JSON_TEXT;
    }
  
    return text || fallback;
  }
  
  export async function readJsonSafe<T>(response: Response): Promise<T> {
    if (response.status === 404) {
      throw new Error('API_NOT_READY');
    }
  
    const contentType = response.headers.get('content-type') || '';
  
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
  
      throw new Error(
        text.includes('import ') || text.includes('<!DOCTYPE html') || text.includes('<html')
          ? SERVER_NOT_JSON_TEXT
          : 'Response ไม่ใช่ JSON',
      );
    }
  
    return response.json() as Promise<T>;
  }
  
  export function isApiUnavailableMessage(message: string) {
    return (
      message.includes('API_NOT_READY') ||
      message.includes(SERVER_NOT_JSON_TEXT) ||
      message.includes('Failed to fetch') ||
      message.includes('Response ไม่ใช่ JSON') ||
      message.includes('404')
    );
  }