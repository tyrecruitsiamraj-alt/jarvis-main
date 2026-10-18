// @vitest-environment node
/**
 * QA 17 ต.ค. 2569 กลุ่ม "ดีไซน์/คำ/มือถือ" (หน้าในเมนู) — เจ้าของเลือกแก้ 18 ต.ค. 2569
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('โหมดมืด', () => {
  it('พื้นโปร่ง bg-white/40 มีคู่ dark ทุกจุด', () => {
    for (const p of [
      'src/components/jobs/RequestLeadRulesCard.tsx',
      'src/components/jobs/UnitRequestWorkStatusField.tsx',
      'src/pages/matching/PreCheckPage.tsx',
      'src/pages/jobs/SiamrajUnitRequestDetailPage.tsx',
      'src/components/matching/IrecruitMatchPanel.tsx',
    ]) {
      for (const line of read(p).split('\n').filter((l) => l.includes('bg-white/40'))) {
        expect(line, p).toContain('dark:bg-');
      }
    }
  });
  it('ป้ายสถานะทำงานใช้ TONE · ชะลอไม่ใช่เขียว', () => {
    const src = read('src/components/jobs/UnitRequestWorkStatusField.tsx');
    expect(src).toContain("resolved === 'on_hold'\n              ? 'neutral'");
    expect(src).not.toContain('bg-emerald-500/12 text-emerald-800');
  });
  it('Pre-Check ปุ่มรัศมี/แก้ไขเป็น shadcn Button', () => {
    const src = read('src/pages/matching/PreCheckPage.tsx');
    expect(src).not.toContain("'bg-blue-600 text-white shadow-sm'");
    expect(src).toContain("variant={radius === r ? 'default' : 'outline'}");
  });
});

describe('ปุ่มต้องมีคำ', () => {
  it('ลบบัญชี · ลบประโยคในบทพูด · ปุ่มแถวช่องทาง', () => {
    expect(read('src/pages/settings/AdminSettings.tsx')).toContain('<Trash2 aria-hidden /> ลบ');
    expect(read('src/pages/settings/CallScriptsTab.tsx')).toContain('<Trash2 aria-hidden /> ลบ');
    const ch = read('src/pages/recruit/RecruitChannelsPage.tsx');
    expect(ch).toContain('<Pencil aria-hidden /> แก้ชื่อ');
    expect(ch).not.toContain('window.confirm');
  });
  it('ปุ่มปิดของ Sheet ไม่ใช่ภาษาอังกฤษ', () => {
    expect(read('src/components/ui/sheet.tsx')).not.toContain('>Close<');
  });
});

describe('คำบนจอ', () => {
  it('ไม่มีชื่อตัวแปรระบบ/migration/schema บนจอ', () => {
    expect(read('api/_lib/systemHealthStore.ts')).not.toMatch(/note: 'ตั้งที่ [A-Z_]+'/);
    expect(read('src/pages/settings/BrandingAppearanceTab.tsx')).not.toContain('รัน migration');
    expect(read('src/pages/aftercare/AftercarePage.tsx')).not.toContain('ยังไม่ได้รัน migration 107');
    const d = read('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx');
    expect(d).not.toContain('schema so-operation');
    expect(d).not.toContain('Siamraj · อ่านอย่างเดียว');
  });
  it('หน้าตั้งค่าชื่อไทยตรงเมนู · ช่องตำแหน่งไม่มีประโยคอธิบาย', () => {
    expect(read('src/pages/settings/AdminSettings.tsx')).toContain('<PageHeader title="ตั้งค่า" />');
    expect(read('src/components/shared/JobTitleField.tsx')).not.toContain("? 'ตำแหน่งใหม่");
  });
});

describe('มือถือ + พฤติกรรม', () => {
  it('ปฏิทินดูแลหลังเริ่มงาน: คอลัมน์ชื่อแคบลงบนมือถือ', () => {
    expect(read('src/components/aftercare/AftercarePlanningCalendar.tsx')).toContain('min-w-28 max-w-32');
  });
  it('หน้าประกาศเต็มจอ: ไม่มีหน้าที่พามา = กลับกล่องงาน', () => {
    expect(read('src/pages/jobs/BoardPostingPage.tsx')).toContain(": '/jobs/board');");
  });
  it('/value: แก้แล้วคืนค่าเดิมไม่ค้าง "ยังไม่ได้บันทึก"', () => {
    expect(read('src/pages/value/ValueCasePage.tsx')).toContain('JSON.stringify(inputs) !== JSON.stringify(savedInputs)');
  });
});
