/**
 * GET /api/home-presence — ใครอยู่ในระบบ (ท้ายหน้าหลัก · 30 ก.ย. 2569 · อ่านอย่างเดียว)
 *
 * Online = เข้าระบบหรือบันทึกงานใน 30 นาทีล่าสุด · Offline = เคยเข้าแล้วแต่ช่วงนั้นเงียบ · ยังไม่เข้าระบบ = ไม่เคยเลย
 * `by_bu` = ยอดแยก BU (รอบ 5) ส่งให้ทุกคน เพราะเป็นยอด ไม่ใช่ชื่อ
 * นิยาม/ตัวจัดอยู่ `src/lib/homePresence.ts` · ร่องรอยชุดเดียวกับหน้าทีม Online (`userActivitySql.ts`)
 *
 * 🔴 รายชื่อ (ชื่อคน) ส่งให้เฉพาะหัวหน้ากับผู้ดูแล (เจ้าของเคาะ · กติกาเดียวกับหน้าทีม Online) — คนอื่นได้แค่ยอด
 * 🔴 บัญชีผูกแผนก = เห็นเฉพาะคนใน BU ของตัวเอง · ไม่ผูกแผนก = บอกเหตุ (ห้าม 0 ปลอม)
 */
import { withAuth, sendError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { respondServiceError } from '../_lib/domainErrors.js';
import { dbQuery } from '../_lib/postgres.js';
import { loadMatchingBuScope, type DepartmentScope } from '../_lib/departmentScope.js';
import { accountsSql, lastLoginSql, recentActivitySql } from '../_lib/userActivitySql.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import {
  ONLINE_MINUTES,
  buildPresencePeople,
  countPresence,
  countPresenceByBu,
  sortPresence,
  type HomePresenceResponse,
  type RawPresenceAccount,
} from '../../src/lib/homePresence.js';

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; body: HomePresenceResponse }>();

const isoOf = (v: Date | string | null | undefined): string | null =>
  v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : String(v);

export async function buildHomePresence(
  scope: DepartmentScope,
  canSeePeople: boolean,
  now: Date,
): Promise<HomePresenceResponse> {
  const forcedBu = scope.mode === 'code' ? normalizeTrendBu(scope.code) : null;
  const body: HomePresenceResponse = {
    generated_at: now.toISOString(),
    online_minutes: ONLINE_MINUTES,
    bu: forcedBu,
    counts: null,
    by_bu: null,
    people: null,
    can_see_people: canSeePeople,
    error: null,
  };
  if (scope.mode === 'none') {
    body.error = 'บัญชีนี้ยังไม่ได้ผูกแผนก เลยยังดูรายชื่อไม่ได้';
    return body;
  }
  const since = new Date(now.getTime() - ONLINE_MINUTES * 60_000).toISOString();
  const [acc, logins, recent] = await Promise.all([
    dbQuery<{ id: string; dept: string; role: string; active: boolean; display_name: string | null }>(accountsSql()),
    dbQuery<{ uid: string; last_at: Date | string | null }>(lastLoginSql()),
    dbQuery<{ uid: string; last_at: Date | string | null }>(recentActivitySql(), [since]),
  ]);
  const accounts: RawPresenceAccount[] = acc.rows
    .map((r) => ({
      id: r.id,
      name: r.display_name ?? '—',
      bu: r.dept ? (normalizeTrendBu(r.dept) ?? '') : '',
      role: r.role,
      active: !!r.active,
    }))
    .filter((a) => !forcedBu || a.bu === forcedBu);
  const toMap = (rows: Array<{ uid: string; last_at: Date | string | null }>) => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const at = isoOf(r.last_at);
      if (at) m.set(r.uid, at);
    }
    return m;
  };
  const people = sortPresence(buildPresencePeople(accounts, toMap(logins.rows), toMap(recent.rows), now));
  body.counts = countPresence(people);
  body.by_bu = countPresenceByBu(people);
  body.people = canSeePeople ? people : null;
  return body;
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'Read-only');
  }
  try {
    const scope: DepartmentScope = await loadMatchingBuScope(req.user);
    const canSeePeople = req.user.role === 'admin' || req.user.role === 'supervisor';
    const cacheKey = JSON.stringify([scope, canSeePeople]);
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);

    const body = await buildHomePresence(scope, canSeePeople, new Date());
    if (!body.error) cache.set(cacheKey, { at: Date.now(), body });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    respondServiceError(res, e, 'home-presence GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
