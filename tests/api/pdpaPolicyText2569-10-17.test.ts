/**
 * PDPA ข้อความจริงของบริษัท (เจ้าของ 17 ต.ค. 2569 "Pdpa ต้องมีข้อความอันนี้ให้อ่านด้วย")
 * ช่องติ๊ก "ข้าพเจ้าได้อ่านและยอมรับ <ข้อตกลงและคำยินยอมในการใช้ข้อมูลส่วนบุคคล>" · กดชื่อข้อตกลง = กางอ่านในฟอร์ม (ห้ามป๊อปซ้อน)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PDPA_CONSENT_REQUIRED_MESSAGE,
  PDPA_CONSENT_REQUIRED_MESSAGE_STAFF,
  PDPA_CONSENT_TEXT_APPLICANT,
  PDPA_CONSENT_VERSION,
  PDPA_POLICY,
  PDPA_POLICY_TITLE,
} from '../../src/lib/pdpaConsent';

describe('ข้อความยินยอม', () => {
  it('คำตามแบบที่เจ้าของส่ง · ฉบับใหม่', () => {
    expect(`${PDPA_CONSENT_TEXT_APPLICANT} ${PDPA_POLICY_TITLE}`).toBe('ข้าพเจ้าได้อ่านและยอมรับ ข้อตกลงและคำยินยอมในการใช้ข้อมูลส่วนบุคคล');
    expect(PDPA_CONSENT_REQUIRED_MESSAGE).toBe('กรุณายอมรับข้อตกลงและเงื่อนไขก่อนดำเนินการต่อ');
    // ฟอร์มเจ้าหน้าที่ใช้คำของตัวเอง — คนยอมรับคือผู้สมัคร (QA 17 ต.ค. 2569)
    expect(PDPA_CONSENT_REQUIRED_MESSAGE_STAFF).toBe('ติ๊กว่าผู้สมัครยอมรับข้อตกลงก่อน');
    expect(PDPA_CONSENT_VERSION).toBe('v1-2569-10-17');
  });
  it('ข้อตกลงครบ 5 หัวข้อ · มีเบอร์ติดต่อบริษัท', () => {
    expect(PDPA_POLICY.sections.map((s) => s.title)).toEqual([
      '1. วัตถุประสงค์ของการเก็บรวบรวมข้อมูล',
      '2. ความปลอดภัยของข้อมูล',
      '3. การเปิดเผยข้อมูลส่วนบุคคล',
      '4. สิทธิของท่านเกี่ยวกับข้อมูลส่วนบุคคล',
      '5. การให้ความยินยอม',
    ]);
    expect(PDPA_POLICY.intro).toContain('พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562');
    expect(PDPA_POLICY.sections[4].bullets?.[2]).toContain('082-7530-062');
  });
  it('🔴 กดชื่อข้อตกลงแล้วกางในฟอร์ม (ไม่ใช่ Dialog) · ปุ่มอยู่นอก label (กดอ่านไม่ติ๊กให้เอง)', () => {
    const c = readFileSync('src/components/shared/PdpaConsentCheck.tsx', 'utf8');
    expect(c).not.toMatch(/from '@\/components\/ui\/dialog'/);
    expect(c).toContain('data-testid="pdpa-policy"');
    expect(c).toMatch(/<\/label>\{' '\}/);
  });
});
