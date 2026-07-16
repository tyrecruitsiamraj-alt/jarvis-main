const UNIT_LAST_PATH_KEY = 'jarvis:unit-last-path';
const JOB_LIST_LAST_URL_KEY = 'jarvis:job-list-last-url';

export type UnitLastPath = '/jobs/overview' | '/jobs/list';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function saveUnitLastPath(path: UnitLastPath): void {
  writeStorage(UNIT_LAST_PATH_KEY, path);
}

export function saveJobListLastUrl(url: string): void {
  if (url.startsWith('/jobs/list')) {
    writeStorage(JOB_LIST_LAST_URL_KEY, url);
  }
}

export function loadJobListLastUrl(): string | null {
  const url = readStorage(JOB_LIST_LAST_URL_KEY);
  return url && url.startsWith('/jobs/list') ? url : null;
}

/** รับเฉพาะ path ภายในแอป — กัน open redirect */
export function sanitizeUnitReturnTo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) return null;
  if (value.startsWith('/api/')) return null;
  // อนุญาตหน้าในแอปที่เกี่ยวข้องกับการนำทางใบขอ/หน่วยงาน
  if (
    value === '/jobs/list' ||
    value.startsWith('/jobs/list?') ||
    value.startsWith('/jobs/list#') ||
    value === '/jobs/overview' ||
    value.startsWith('/jobs/overview?') ||
    value.startsWith('/jobs/overview#') ||
    value === '/jobs/board' ||
    value.startsWith('/jobs/board?') ||
    value.startsWith('/jobs/board#') ||
    value === '/dashboard' ||
    value.startsWith('/dashboard?') ||
    value.startsWith('/dashboard#')
  ) {
    return value;
  }
  return null;
}

/** ปุ่มย้อนกลับจากหน้ารายละเอียดใบขอ */
export function resolveUnitDetailBackPath(options?: {
  stateReturnTo?: unknown;
  search?: string;
}): string {
  const fromState = sanitizeUnitReturnTo(options?.stateReturnTo);
  if (fromState) return fromState;

  const fromQuery = sanitizeUnitReturnTo(
    options?.search ? new URLSearchParams(options.search).get('returnTo') : null,
  );
  if (fromQuery) return fromQuery;

  return loadJobListLastUrl() || '/jobs/list';
}

/** Bottom nav / ลิงก์กลับ — คืนหน้าหน่วยงานล่าสุด (filter + หน้า) */
export function resolveUnitNavPath(): string {
  const lastPath = readStorage(UNIT_LAST_PATH_KEY);
  if (lastPath === '/jobs/overview') {
    return '/jobs/overview';
  }
  return loadJobListLastUrl() || '/jobs/list';
}

export function clearJobUnitPageSession(): void {
  removeStorage(UNIT_LAST_PATH_KEY);
  removeStorage(JOB_LIST_LAST_URL_KEY);
  try {
    sessionStorage.removeItem('jarvis:job-dashboard-filters');
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem('jarvis:job-dashboard-filters');
  } catch {
    /* ignore */
  }
}
