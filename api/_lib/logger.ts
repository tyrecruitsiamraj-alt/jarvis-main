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

export function logError(msg: string, fields?: LogFields): void {
  emit('error', msg, fields);
}
