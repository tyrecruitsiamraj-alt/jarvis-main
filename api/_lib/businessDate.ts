const BANGKOK_TZ = 'Asia/Bangkok';

/** YYYY-MM-DD in Asia/Bangkok (business calendar date). */
export function bangkokBusinessDateYmd(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Noon on the given business date in Bangkok — stable anchor for daily scoring windows. */
export function bangkokNoonDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+07:00`);
}

export function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d!;
}
