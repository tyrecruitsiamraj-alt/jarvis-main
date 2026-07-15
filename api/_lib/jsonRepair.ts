/**
 * ตัวช่วย parse JSON จากโมเดล LLM ที่มักตอบไม่สมบูรณ์:
 * - escape ผิด (\_ \* ใน markdown)
 * - control char จริง (newline/tab) ภายใน string
 * - โดนตัดกลางทาง (string/วงเล็บไม่ปิด)
 * - มี text/```json fence ห่อ
 */

/** escape ที่ JSON ไม่รู้จัก (\_ \* ฯลฯ) → escape ให้ถูก */
function repairJsonEscapes(text: string): string {
  return text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}

/** newline/tab จริงภายใน string → escape ให้ถูก */
function escapeControlCharsInStrings(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

/** output โดนตัด → ปิด string ที่ค้าง + เติม ]/} ที่ขาด */
function closeTruncatedJson(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = text;
  if (escaped) out = out.slice(0, -1);
  if (inString) out += '"';
  out = out.replace(/[,:\s]+$/, '');
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === '{' ? '}' : ']';
  }
  return out;
}

/**
 * พยายาม parse JSON จากข้อความโมเดลด้วยการซ่อมหลายชั้น
 * @throws ถ้าซ่อมแล้วยัง parse ไม่ได้
 */
export function parseLenientJson<T = Record<string, unknown>>(text: string): T {
  const trimmed = text.trim();
  const candidates = [trimmed, trimmed.match(/\{[\s\S]*\}/)?.[0]].filter(
    (c): c is string => Boolean(c),
  );
  for (const candidate of candidates) {
    const ctrl = escapeControlCharsInStrings(candidate);
    const escaped = repairJsonEscapes(ctrl);
    for (const variant of [
      candidate,
      ctrl,
      escaped,
      closeTruncatedJson(ctrl),
      closeTruncatedJson(escaped),
    ]) {
      try {
        return JSON.parse(variant) as T;
      } catch {
        // ลองรูปแบบถัดไป
      }
    }
  }
  throw new Error('โมเดลไม่ได้ตอบ JSON ที่อ่านได้');
}
