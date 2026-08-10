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
