// @vitest-environment node
/**
 * ปุ่ม "ไม่โทร" ในป๊อปลงผลติดต่อ (เจ้าของ 27 พ.ย. 2569
 * "ปุ่มไม่โทร เอาไปไว้หน้าติดต่อในช่อง ข้างๆกับพวก ติดต่อสำเร็จ ไม่สำเร็จ" · Choice "มีทั้งสองที่")
 * + "ต้องย้ายไปตั้งแต่หน้าที่บอกว่าไม่โทรเลย" ⇒ ตั้งไม่โทร = ปลดคนเก็บ ชื่อไปกล่องของเหตุผลในแท็บผู้สมัคร
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ไม่โทรจากแท็บการติดต่อ', () => {
  const dlg = readFileSync('src/components/recruit-rm/ApplicantContactDialog.tsx', 'utf8');
  const lib = readFileSync('api/_lib/applicantNoCall.ts', 'utf8');

  it('ปุ่มอยู่ขั้นการติดต่อ ต่อจากติดต่อไม่สำเร็จ · เลือกเหตุผลแล้วบันทึกทันที', () => {
    const fail = dlg.indexOf('<X aria-hidden /> ติดต่อไม่สำเร็จ');
    const nocall = dlg.indexOf('data-testid="contact-nocall"');
    const stepEnd = dlg.indexOf('</StepHead>', fail);
    expect(fail).toBeGreaterThan(0);
    expect(nocall).toBeGreaterThan(fail);
    expect(nocall).toBeLessThan(stepEnd);
    expect(dlg).toContain('onSelect={() => void pickNoCall(x.id)}');
    expect(dlg).toContain('await setApplicationNoCall([a.id], reasonId);');
  });

  it('ตั้งไม่โทรปลดคนเก็บ + Lead และคืนล็อกเบอร์ · ลูกทีมแตะใบที่คนอื่นเก็บไม่ได้ (DB ตัดสิน)', () => {
    expect(lib).toContain('claimed_by = null, claimed_by_name = null, claimed_at = null,');
    expect(lib).toContain('is_lead = false, lead_by = null, lead_by_name = null, lead_at = null,');
    expect(lib).toContain('($4::boolean or o.claimed_by is null or o.claimed_by = $5::uuid)');
    expect(lib).toContain('await releaseApplicationCallHolds(r.id, r.old_claim);');
    expect(readFileSync('api/_handlers/applicant-no-call.ts', 'utf8')).toContain('canOthers: canManage(req)');
  });
});
