const UNIT_LAST_PATH_KEY = 'jarvis:unit-last-path';
const JOB_LIST_LAST_URL_KEY = 'jarvis:job-list-last-url';

export type UnitLastPath = '/jobs/overview' | '/jobs/list';

export function saveUnitLastPath(path: UnitLastPath): void {
  sessionStorage.setItem(UNIT_LAST_PATH_KEY, path);
}

export function saveJobListLastUrl(url: string): void {
  if (url.startsWith('/jobs/list')) {
    sessionStorage.setItem(JOB_LIST_LAST_URL_KEY, url);
  }
}

export function loadJobListLastUrl(): string | null {
  return sessionStorage.getItem(JOB_LIST_LAST_URL_KEY);
}

/** Bottom nav / ลิงก์กลับ — คืนหน้าหน่วยงานล่าสุดใน session (ไม่ใช่ login ใหม่) */
export function resolveUnitNavPath(): string {
  const lastPath = sessionStorage.getItem(UNIT_LAST_PATH_KEY);
  if (lastPath === '/jobs/list') {
    return loadJobListLastUrl() || '/jobs/list';
  }
  if (lastPath === '/jobs/overview') {
    return '/jobs/overview';
  }
  return '/jobs/list';
}

export function clearJobUnitPageSession(): void {
  sessionStorage.removeItem(UNIT_LAST_PATH_KEY);
  sessionStorage.removeItem(JOB_LIST_LAST_URL_KEY);
  sessionStorage.removeItem('jarvis:job-dashboard-filters');
}
