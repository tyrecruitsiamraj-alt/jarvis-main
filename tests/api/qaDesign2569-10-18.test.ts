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
});

describe('รอบ 2 (18 ต.ค. 2569)', () => {
  it('มือถือ: ปุ่มมาแล้ว/ไม่มาอยู่ช่องตัวเลือกที่ติดขวา · ช่องตัวเลือกติดขวาถึงจอ 768', () => {
    const src = read('src/components/recruit-rm/RmTable.tsx');
    expect(src).toContain("{tab === 'appointments' ? <div className=\"mb-1 flex justify-end sm:hidden\">{attendanceButtons(r, true)}</div> : null}");
    expect(src).toContain('max-lg:sticky max-lg:right-0 max-lg:bg-card');
  });
  it('กดชื่อผู้สมัครเปิดรายละเอียด', () => {
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain("onClick={() => onAction('view', r)}");
  });
  it('แท็บหัวหน้าแถวเดียวกับปุ่มเริ่มที่ lg (จอ 768 ไม่โดนตัด)', () => {
    expect(read('src/components/shared/PageHeader.tsx')).toContain('lg:order-2 lg:basis-0 lg:flex-1');
  });
  it('ตารางติดตามมือถือ: หน่วยงานใต้ชื่อ · เบอร์แบบ 0…', () => {
    const src = read('src/components/follow/FollowPlanningCalendar.tsx');
    expect(src).toContain('{localThaiPhone(row.group.phone)}');
    expect(read('src/pages/aftercare/AftercarePage.tsx')).toContain('{localThaiPhone(p.phone_e164)}');
  });
  it('ปฏิทินดูแลหลังเริ่มงาน: ไม่มีตัวหนังสือ 8–9px · ปุ่ม shadcn', () => {
    const src = read('src/components/aftercare/AftercarePlanningCalendar.tsx');
    expect(src).not.toMatch(/text-\[(8|9)px\]/);
    expect(src).not.toContain('<button\n            type="button"\n            onClick={() => onMonthChange');
  });
  it('ปุ่มมีคำ: แก้วันเวลา · โทร · เอาออก', () => {
    expect(read('src/components/follow/FollowPlanningCalendar.tsx')).toContain('<Pencil aria-hidden /> แก้');
    expect(read('src/components/follow/FollowCallQueue.tsx')).toContain('<Phone aria-hidden /> โทร');
    expect(read('src/components/follow/FollowScheduleEditor.tsx')).toContain('<X aria-hidden /> เอาออก');
  });
  it('ตั้งค่า › ผู้ใช้งาน หัวไทย · Pre-Check อายุคีย์บอร์ดตัวเลข', () => {
    const a = read('src/pages/settings/AdminSettings.tsx');
    expect(a).toContain('>บทบาท</th>');
    expect(a).toContain('>จัดการ</th>');
    expect(read('src/pages/matching/PreCheckPage.tsx')).toContain('aria-label="อายุต่ำสุด"');
  });
});

describe('3 ข้อสุดท้าย (18 ต.ค. 2569)', () => {
  it('ชื่องาน/หน่วยงานบนจอไม่มีอิโมจิ (📍)', async () => {
    const { withoutEmoji, applicationUnitLabel } = await import('../../src/lib/recruitRm');
    expect(withoutEmoji('📍 ธนาคารกรุงศรี ✅')).toBe('ธนาคารกรุงศรี');
    expect(applicationUnitLabel({ unit_name: null, job_title: '📍 KYE บางนา', position_interest: null } as never)).toBe('KYE บางนา');
  });
  it('ปุ่มลองใหม่: รายชื่อในป๊อป/หน้าใบ · บทโทร · กราฟรายวันหน้าหลัก', () => {
    expect(read('src/components/jobs/JobApplicantsDialog.tsx')).toContain('<LoadErrorNotice message={error} onRetry={() => setReloadSeq((n) => n + 1)} />');
    expect(read('src/pages/settings/CallScriptsTab.tsx')).toContain('<LoadErrorNotice message={error} onRetry={() => void load()} />');
    expect(read('src/components/home-ai-share/AiShareDetail.tsx')).toContain('<LoadErrorNotice message={failed} onRetry={onRetry} />');
  });
  it('ตารางผลโทรราย BU มือถือ: เรื่อง/ใครโทร ติดซ้าย', () => {
    expect(read('src/components/home-ai-share/AiShareLumosStats.tsx')).toContain('max-sm:sticky max-sm:left-20');
  });
});
