export async function readErrorMessage(response: Response, fallback: string) {
    if (response.status === 404) {
      return "API_NOT_READY";
    }
  
    const contentType = response.headers.get('content-type') || '';
  
    if (contentType.includes('application/json')) {
      const body = await response.json().catch(() => null);
      return body?.error || body?.message || fallback;
    }
  
    const text = await response.text().catch(() => '');
  
    if (text.includes('import ') || text.includes('<!DOCTYPE html') || text.includes('<html')) {
      return 'API endpoint ไม่ได้ส่ง JSON กลับมา กรุณารันผ่าน vercel dev หรือเช็ก /api route';
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
          ? 'API endpoint ไม่ได้ส่ง JSON กลับมา กรุณารันผ่าน vercel dev หรือเช็ก /api route'
          : 'Response ไม่ใช่ JSON',
      );
    }
  
    return response.json() as Promise<T>;
  }
  
  export function isApiUnavailableMessage(message: string) {
    return (
      message.includes('API_NOT_READY') ||
      message.includes('API endpoint ไม่ได้ส่ง JSON') ||
      message.includes('Failed to fetch') ||
      message.includes('Response ไม่ใช่ JSON') ||
      message.includes('404')
    );
  }