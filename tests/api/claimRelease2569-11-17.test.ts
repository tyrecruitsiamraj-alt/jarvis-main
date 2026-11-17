// @vitest-environment node
/**
 * ชื่อที่เก็บไว้ต้องออกมาเอง (เจ้าของ 17 พ.ย. 2569 "คนออกแล้วชื่อที่เก็บไปไหน … ต้องออกมา Auto เว้นเฉพาะคนที่ได้ลงงาน"
 * · Choice "กลับกองกลาง ไม่ส่ง AI เอง") — วัดจริงก่อนเปิด: ดอง 256 · ได้งาน 2 · Lead ของบัญชีที่ถูกลบ 50
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { CLAIM_KEEP_SQL, OVERVIEW_BUCKETS } from '../../api/_lib/applicantOverviewSql';
import { isClaimAutoAiEnabled } from '../../api/_lib/callChoiceWorker';

const SRC = readFileSync('api/_lib/callChoiceWorker.ts', 'utf8');

describe('ปล่อยชื่ออัตโนมัติ', () => {
  afterEach(() => {
    delete process.env.CLAIM_AUTO_AI_ENABLED;
  });

  it('ไม่ปล่อย: ได้งานแล้ว · มีนัด · ยกเลิกแล้ว — ใช้ใน worker เท่านั้น (ถังภาพรวมห้ามอ่าน status)', () => {
    expect(CLAIM_KEEP_SQL).toContain("a.status = 'converted'");
    expect(CLAIM_KEEP_SQL).toContain('appointment');
    expect(CLAIM_KEEP_SQL).toMatch(/application_cancellations/);
    expect(OVERVIEW_BUCKETS.claimed_idle).not.toContain('converted');
    expect(SRC).toContain('and not ${CLAIM_KEEP_SQL}');
  });

  it('คนออก (ปิด/ลบบัญชี) = ปล่อยทันทีไม่รอ 1 วัน ทั้งที่เก็บไว้และ Lead ในการติดต่อ · ชื่อบอกว่าปิดบัญชีแล้ว', () => {
    expect(SRC).toMatch(/or \(a\.claimed_by is not null and \$\{departedSql\('a\.claimed_by'\)\}\)/);
    expect(SRC).toContain("and ${departedSql('a.lead_by')} and not ${CLAIM_KEEP_SQL}");
    expect(SRC).toContain("' (ปิดบัญชีแล้ว)'");
  });

  it('ปล่อยแล้วกลับกองกลาง AI ไม่โทรเอง — เปิดได้ด้วยสวิตช์แยกเท่านั้น', () => {
    expect(isClaimAutoAiEnabled()).toBe(false);
    process.env.CLAIM_AUTO_AI_ENABLED = 'true';
    expect(isClaimAutoAiEnabled()).toBe(true);
    expect(SRC).toMatch(/if \(isClaimAutoAiEnabled\(\)\) \{\s*const sent = await autoSendToAi/);
  });

  it('เครื่องจริงเปิดตัวปล่อย · ไม่เปิด AI โทรเอง · เครื่อง dev ยังปิด', () => {
    const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
    expect(deploy).toContain('sync-env.sh .env CLAIM_GUARD_ENABLED "true"');
    expect(deploy).toContain('sync-env.sh .env CLAIM_AUTO_AI_ENABLED "false"');
    expect(readFileSync('server/local-api-safe.ts', 'utf8')).toContain("CLAIM_GUARD_ENABLED: 'false'");
  });

  it('ป้ายบนแถวไม่บอกว่า AI จะรับไปแล้ว', () => {
    const t = readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8');
    expect(t).not.toContain('AI จะรับไป');
    expect(t).toContain('ปล่อยจาก {r.unclaimed_from_name');
  });
});
