import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pushCfg = vi.hoisted(() => ({ value: null as null | object }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({ getLumosPushConfig: () => pushCfg.value }));
const db = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: async () => {
    db.calls += 1;
    return { rows: [] };
  },
}));

import {
  RETRY_SINCE,
  isApplicationDispatchRetryEnabled,
  runApplicationDispatchRetryOnce,
  unsentApplicationsSql,
  unsentUnlinkedApplicationsSql,
  UNLINKED_GREET_SINCE,
  KEYED_AUTO_SINCE,
} from '../../api/_lib/applicationDispatchRetry';

/**
 * ใบสมัครที่ส่ง AI ไม่สำเร็จตอนกรอก → ลองส่งใหม่เอง (เจ้าของสั่ง 15 ต.ค. 2569 "ทำข้อ 1 กันไม่ให้หลุดอีก")
 */
describe('ตัวลองส่งใบสมัครเข้า AI ซ้ำ', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    pushCfg.value = null;
    db.calls = 0;
  });

  it('หยิบเฉพาะใบที่ควรถูกส่งตอนกรอก — ด่านเดียวกับเส้นกรอกเสร็จ + ไม่แย่งงานคน', () => {
    const sql = unsentApplicationsSql();
    for (const guard of [
      'a.job_id is not null',
      'a.created_by_name is null',
      "a.created_at >= $1::timestamptz",
      "interval '3 minutes'",
      "interval '7 days'",
      'a.claimed_by is null',
      'a.unclaimed_at is null',
      'coalesce(a.is_lead, false) = false',
      "a.call_choice in ('ai', 'auto_ai')",
      "q.person_ref = 'app-' || a.id::text",
      'application_cancellations',
      'application_irecruit_dups',
    ]) {
      expect(sql).toContain(guard);
    }
  });

  it('ใบคีย์เอง/นำเข้า Excel ที่ผูกใบขอ = AI โทรเอง (เจ้าของ 20 ต.ค. 2569) · ใบดึงจาก iRecruit ไม่หยิบ · ใบคีย์เก่าไม่โทรเงียบ', () => {
    const sql = unsentApplicationsSql();
    expect(sql).toContain("a.created_by_name <> 'iRecruit' and a.created_at >= $2::timestamptz");
    expect(KEYED_AUTO_SINCE).toBe('2026-10-20T10:00:00+07:00');
  });

  it('ไม่ผูกใบขอ = AI โทรบททักทายทั่วไป (เจ้าของ 21 ต.ค. 2569) · ด่านเดิมครบ · iRecruit ไม่หยิบ · ใบเก่าไม่โทรเงียบ', () => {
    const sql = unsentUnlinkedApplicationsSql();
    expect(sql).toContain("a.job_id is null and a.created_at >= $2::timestamptz and coalesce(a.created_by_name, '') <> 'iRecruit'");
    expect(sql).toContain('a.province');
    for (const guard of ['a.claimed_by is null', 'coalesce(a.is_lead, false) = false', 'application_cancellations', 'application_irecruit_dups', "q.person_ref = 'app-' || a.id::text"]) {
      expect(sql).toContain(guard);
    }
    expect(UNLINKED_GREET_SINCE).toBe(KEYED_AUTO_SINCE);
    const src = readFileSync('api/_lib/applicationDispatchRetry.ts', 'utf8');
    expect(src).toContain('await enqueueLumosGreetingForApplications(send, { autoPush: true });');
    expect(src).toContain('const { send, dups } = await splitIrecruitDuplicates(unlinked);');
  });

  it('🔴 ใบที่หลุดก่อนแก้ (17 ใบ) ไม่ถูกหยิบ — เจ้าของยังไม่สั่งส่ง', () => {
    expect(RETRY_SINCE).toBe('2026-10-15T09:00:00+07:00');
  });

  it('🔴 ไม่มีคีย์ push (เครื่องนักพัฒนา) หรือปิดส่งอัตโนมัติ = ไม่ทำอะไร ไม่แตะฐาน', async () => {
    process.env.APPLICATION_AUTO_DISPATCH_ENABLED = 'true';
    pushCfg.value = null;
    expect(isApplicationDispatchRetryEnabled()).toBe(false);
    expect(await runApplicationDispatchRetryOnce()).toMatchObject({ found: 0, queued: 0 });
    expect(db.calls).toBe(0);

    pushCfg.value = { baseUrl: 'x' };
    process.env.APPLICATION_AUTO_DISPATCH_ENABLED = 'false';
    expect(isApplicationDispatchRetryEnabled()).toBe(false);

    process.env.APPLICATION_AUTO_DISPATCH_ENABLED = 'true';
    expect(isApplicationDispatchRetryEnabled()).toBe(true);
    process.env.APPLICATION_DISPATCH_RETRY_ENABLED = 'false';
    expect(isApplicationDispatchRetryEnabled()).toBe(false);
  });

  it('เปิดแล้วแต่ไม่มีใบค้าง = อ่านฐานครั้งเดียว ไม่ส่งอะไร', async () => {
    process.env.APPLICATION_AUTO_DISPATCH_ENABLED = 'true';
    pushCfg.value = { baseUrl: 'x' };
    expect(await runApplicationDispatchRetryOnce()).toMatchObject({ found: 0, queued: 0 });
    expect(db.calls).toBe(1);
  });

  it('server เปิดตัวนี้ตอนบูต', () => {
    expect(readFileSync('server/local-api.ts', 'utf8')).toContain('startApplicationDispatchRetryWorker();');
  });
});
