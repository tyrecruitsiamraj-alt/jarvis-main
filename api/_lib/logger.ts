export type LogLevel = 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, msg: string, fields?: LogFields): void {
  const line = JSON.stringify({
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(msg: string, fields?: LogFields): void {
  emit('info', msg, fields);
}

export function logWarn(msg: string, fields?: LogFields): void {
  emit('warn', msg, fields);
}

/**
 * ดึงเหตุผลจริงออกจาก `error.cause` — `fetch()` ของ Node (undici) โยน
 * `TypeError: fetch failed` เสมอไม่ว่าสาเหตุจริงจะเป็นอะไร (DNS หาไม่เจอ/
 * ต่อปลายทางไม่ติด/TLS ผิดพลาด/timeout) ตัวสาเหตุจริงถูกซ่อนอยู่ใน `.cause`
 * (บาง network stack ห่อเป็น AggregateError ที่มี `.errors` อีกที)
 * ไม่ดึงออกมา log ก็จะเห็นแต่ "fetch failed" เฉย ๆ ไล่ต้นเหตุไม่ได้เลย
 */
function describeError(err: unknown, depth = 0): unknown {
  if (depth > 3) return undefined; // กันวนไม่รู้จบถ้า cause อ้างตัวเอง
  if (!(err instanceof Error)) return err === undefined ? undefined : String(err);
  const out: Record<string, unknown> = { message: err.message };
  const code = (err as NodeJS.ErrnoException).code;
  if (code) out.code = code;
  if (err instanceof AggregateError && Array.isArray(err.errors)) {
    out.errors = err.errors.map((e) => describeError(e, depth + 1));
  }
  if (err.cause !== undefined) out.cause = describeError(err.cause, depth + 1);
  return out;
}

/**
 * มี 5 จุดในระบบเรียกแบบ `logError(msg, e, {context})` มาตลอด แต่ signature เดิม
 * รับแค่ (msg, fields) — Error เลยไปนั่งช่อง fields (spread ไม่ออก เพราะ property
 * ของ Error เป็น non-enumerable) และ context ถูกทิ้งเงียบ ๆ
 * ผลคือ log อย่าง "lumos.followup.failed" ไม่มีทั้งข้อความ error และ queueId
 * (เจอตอนเปิด typecheck ให้ api/ ครั้งแรก 10 ส.ค. 2569 — เดิมไม่มี config ไหนครอบ)
 */
export function logError(msg: string, errorOrFields?: unknown, fields?: LogFields): void {
  if (errorOrFields instanceof Error) {
    emit('error', msg, {
      message: errorOrFields.message,
      stack: errorOrFields.stack,
      ...(errorOrFields.cause !== undefined ? { cause: describeError(errorOrFields.cause) } : {}),
      ...fields,
    });
    return;
  }
  emit('error', msg, {
    ...(typeof errorOrFields === 'object' && errorOrFields !== null
      ? (errorOrFields as LogFields)
      : errorOrFields !== undefined
        ? { message: String(errorOrFields) }
        : {}),
    ...fields,
  });
}

/**
 * สรุป error เป็น**ข้อความบรรทัดเดียวที่บอกเหตุจริง** — เอาไปโชว์บนจอได้
 *
 * 🔴 ทำไมต้องมี: `fetch()` ของ Node โยน `TypeError: fetch failed` เสมอ ไม่ว่าสาเหตุจริง
 * จะเป็น DNS หาไม่เจอ · ต่อไม่ติด · TLS พัง · หรือ timeout — เหตุจริงซ่อนอยู่ใน `.cause`
 * จดแค่ `e.message` ลงฐานจึงได้คำว่า "fetch failed" เปล่า ๆ ซึ่งไล่ต้นเหตุไม่ได้เลย
 * (เจ้าของถาม 11 ก.ย. 2569: *"อยากรู้ว่าเพราะอะไร เพราะมันเป็นบ่อยแล้ว"*)
 *
 * ตัวอย่างผลลัพธ์: `fetch failed (ECONNRESET: read ECONNRESET)`
 *
 * ⚠️ ใช้ตัวถอด `.cause` ตัวเดียวกับ `logError` — log กับจอต้องเล่าเรื่องเดียวกัน
 */
export function errorSummaryText(err: unknown, maxLength = 300): string {
  const parts: string[] = [];
  const walk = (e: unknown, depth = 0): void => {
    if (depth > 3 || e == null) return;
    if (!(e instanceof Error)) {
      parts.push(String(e));
      return;
    }
    const code = (e as NodeJS.ErrnoException).code;
    parts.push(code ? `${code}: ${e.message}` : e.message);
    if (e instanceof AggregateError && Array.isArray(e.errors)) {
      for (const inner of e.errors.slice(0, 2)) walk(inner, depth + 1);
    }
    if (e.cause !== undefined) walk(e.cause, depth + 1);
  };
  walk(err);
  // ตัดข้อความซ้ำ (cause มักพูดซ้ำกับ message ชั้นนอก) แล้วต่อเป็นบรรทัดเดียว
  const seen = new Set<string>();
  const text = parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p && !seen.has(p) && seen.add(p))
    .join(' | ');
  return text.slice(0, maxLength);
}
