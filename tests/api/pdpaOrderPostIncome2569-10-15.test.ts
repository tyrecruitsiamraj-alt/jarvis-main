/**
 * 15 ต.ค. 2569 (ค่ำ) — สามเรื่องจากเจ้าของ
 * 1. PDPA: "ตอนพนักงานกรอกชื่อมาเรามีเรื่อง Pdpa ไหม" → Choice "ทำช่องยินยอม รอข้อความจากบริษัท"
 *    ช่องติ๊กทั้ง 3 ทางเข้า (หน้าสมัคร · เพิ่มข้อมูลผู้สมัคร · นำเข้า Excel) · จดลง `app_application_consents` (148)
 * 2. "สั่งโพสต์" แทนป้าย "สมัครงาน" ในการ์ดตัวอย่าง → คำขอ Content ของศูนย์งาน api-scraper เดิม (Choice)
 * 3. กล่องรายได้รวม: ตัวเลือกบอกตัวเลข · ไม่มี "ทั้งสอง" · ไม่เคยเลือก = รายได้รวม (Choice)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INCOME_SHOWN_OPTIONS } from '../../src/lib/incomeShown';
import { PDPA_CONSENT_VERSION } from '../../src/lib/pdpaConsent';

const read = (p: string) => readFileSync(p, 'utf8');

describe('PDPA — ช่องยินยอมครบทุกทางเข้า', () => {
  it('🔴 ทั้ง 3 ฟอร์มมีช่องติ๊ก และกดบันทึก/ส่งไม่ได้ถ้าไม่ติ๊ก', () => {
    const apply = read('src/components/jobs/PublicApplyDialog.tsx');
    expect(apply).toContain('<PdpaConsentCheck checked={consent} onChange={setConsent} text={PDPA_CONSENT_TEXT_APPLICANT} />');
    expect(apply).toContain('if (!consent) return setError(PDPA_CONSENT_REQUIRED_MESSAGE);');
    expect(apply).toContain('pdpa_consent: true,');

    const add = read('src/components/recruit-rm/AddApplicantDialog.tsx');
    expect(add).toContain('<PdpaConsentCheck checked={consent} onChange={setConsent} text={PDPA_CONSENT_TEXT_STAFF} />');
    expect(add).toContain('if (!consent) return setError(PDPA_CONSENT_REQUIRED_MESSAGE_STAFF);');

    const imp = read('src/components/recruit-rm/ImportApplicantsDialog.tsx');
    expect(imp).toContain('text={PDPA_CONSENT_TEXT_STAFF}');
    expect(imp).toMatch(/disabled=\{ready === 0 \|\| busy !== null \|\| !sharedPicked \|\| !consent\}/);
  });

  it('server: คีย์เอง/นำเข้า ไม่ยินยอม = 400 · หน้าสมัครจดเมื่อได้ true (หน้าเก่าที่ค้างไม่ทำใบหาย) · ทุกทางจดฉบับข้อความ', () => {
    expect(read('api/_handlers/job-applications.ts')).toContain(
      "if (b.pdpa_consent !== true) return sendError(res, 400, 'Bad request', PDPA_CONSENT_REQUIRED_MESSAGE_STAFF);",
    );
    expect(read('api/_handlers/job-applications.ts')).toContain("await recordApplicationConsent([String(row.id)], 'staff', staffName);");
    const pub = read('api/_handlers/public/apply.ts');
    expect(pub).toContain("if (consented) await recordApplicationConsent([id], 'apply', null);");
    expect(read('api/_lib/applicationConsent.ts')).toContain('on conflict (application_id) do nothing');
    expect(read('migrations/148_application_consents.sql')).toContain('create table if not exists app_application_consents');
    expect(PDPA_CONSENT_VERSION).toBe('v1-2569-10-17');
  });
});

describe('สั่งโพสต์ — ผ่านศูนย์งาน api-scraper เดิม (20 ต.ค. 2569: ส่งข้อความ/แบบโพสต์/กลุ่มไป So Scraping)', () => {
  it('การ์ดตัวอย่างในป๊อปประกาศ (ทั้งสองโฉม) ใช้ปุ่มสั่งโพสต์แทนป้ายสมัครงาน', () => {
    expect(read('src/pages/jobs/BoardPostingPage.tsx')).toContain(
      '<PublicJobCardPreview job={jobWithPatch} action={<OrderPostButton job={jobWithPatch} caption={postText} onCaptionSaved=',
    );
    expect(read('src/components/jobs/BoardPublishSheet.tsx')).toContain(
      '<PublicJobCardPreview job={jobWithPatch} action={<OrderPostButton job={jobWithPatch} onCaptionSaved=',
    );
    // หน้าสมัครจริง (onApply) ไม่โดน — ยังเป็นปุ่มสมัครงาน
    expect(read('src/components/jobs/PublicJobCardPreview.tsx')).toMatch(/onApply \? \([\s\S]*สมัครงาน[\s\S]*\) : action \? \(/);
  });

  it('🔴 คำขอโพสต์มีข้อความ/แบบโพสต์/กลุ่ม · ยังรอ/กำลังทำ = กดซ้ำไม่ได้ · ขอ Scrap อยู่ที่นี่ที่เดียว', () => {
    // 20 ต.ค. 2569 (Choice "บนการ์ดกล่องงาน"): สั่งโพสต์ย้ายไปป๊อป Autopost · ป๊อปประกาศเหลือสถานะ + ขอ Scrap
    const dlg = read('src/components/jobs/AutopostDialog.tsx');
    expect(dlg).toContain("soPostSnapshot({ ...composeJobSnapshot(job), position: publicJobTitle(job) }, { mode, caption, groupIds: picked })");
    const btn = read('src/components/jobs/OrderPostButton.tsx');
    expect(btn).not.toContain('soPostSnapshot(');
    expect(btn).toContain('...soScrapSnapshot(job, title),');
    // 20 ต.ค. 2569 Choice "เอาออก สั่งจากป๊อปประกาศที่เดียว" — ทั้งปุ่ม Content และ Scraping ในจับคู่งาน
    expect(read('src/pages/matching/MatchingPage.tsx')).not.toContain('createPosting(');
    expect(read('src/pages/matching/MatchingPage.tsx')).not.toContain('ให้สร้าง Content');
    expect(read('src/pages/matching/MatchingPage.tsx')).not.toContain('const composeJobSnapshot =');
  });
});

describe('กล่องรายได้รวม — ตัวเลือกบอกตัวเลข', () => {
  it('เหลือ 2 ตัวเลือก (ไม่มีทั้งสอง) · ปุ่มบอกจำนวนเงิน · ไม่มีเลข = กดไม่ได้', () => {
    expect(INCOME_SHOWN_OPTIONS.map((o) => o.value)).toEqual(['total', 'average']);
    const box = read('src/components/jobs/PostingFieldBox.tsx');
    expect(box).toContain("{o.label} <span className=\"tabular-nums\">{amount ?? '—'}</span>");
    expect(box).toContain('disabled={!amount}');
  });
});
