// @vitest-environment node
/**
 * 🔴 แก้ตามรายงาน QA รอบ 2 (5 ต.ค. 2569 · เจ้าของ "อนุมัติให้แก้ ทั้งหมด")
 * pin โครงไว้กันย้อนกลับ — ตรรกะหลักมีเทสต์ของตัวเองที่ followGrouping / trends / followAftercareMove
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { friendlyErrorText, NETWORK_ERROR_TEXT } from '../../src/lib/friendlyError';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

describe('friendlyErrorText — error บนจอเป็นภาษาคน', () => {
  it('เน็ตหลุด = ต่อเซิร์ฟเวอร์ไม่ได้', () => {
    expect(friendlyErrorText(new TypeError('Failed to fetch'), 'x')).toBe(NETWORK_ERROR_TEXT);
    expect(friendlyErrorText(new TypeError('Load failed'), 'x')).toBe(NETWORK_ERROR_TEXT);
  });
  it('อังกฤษดิบ / ว่าง = ข้อความของจุดนั้น', () => {
    expect(friendlyErrorText(new Error('Internal server error'), 'โหลดไม่ได้')).toBe('โหลดไม่ได้');
    expect(friendlyErrorText(new Error(''), 'โหลดไม่ได้')).toBe('โหลดไม่ได้');
    expect(friendlyErrorText(null, 'โหลดไม่ได้')).toBe('โหลดไม่ได้');
  });
  it('ข้อความไทยจากเซิร์ฟเวอร์ส่งต่อตามเดิม (บอกเหตุจริง)', () => {
    expect(friendlyErrorText(new Error('เวลาที่ผ่านมาแล้วตั้งไม่ได้'), 'x')).toBe('เวลาที่ผ่านมาแล้วตั้งไม่ได้');
  });
});

describe('หน้าติดตาม — โหลด / ล้ม / ว่าง แยกกัน', () => {
  const page = read('src/pages/follow/FollowPage.tsx');
  it('ยังไม่เคยโหลดสำเร็จ = โครงหน้า ไม่ใช่ 0 / ตามครบแล้ว', () => {
    expect(page).toContain('{lastLoadedAt === null ? (');
    expect(page).toContain('data-testid="follow-first-load"');
  });
  it('โหลดสำเร็จ (รวมรอบเงียบ) ล้างแถบล้ม · แถบล้มอยู่บนสุดมีปุ่มลองใหม่', () => {
    const reload = page.slice(page.indexOf('const reload = useCallback'), page.indexOf('const reload = useCallback') + 900);
    expect(reload).toMatch(/setLastLoadedAt\(new Date\(\)\);[\s\S]*setError\(null\);/);
    expect(page).toMatch(/role="alert"[\s\S]{0,400}\{error\}/);
  });
  it('ปุ่มในป๊อปพลาด = toast (เห็นทั้งที่ป๊อปเปิดอยู่) ไม่ใช่แถบระดับหน้า', () => {
    for (const msg of ['ยกเลิกไม่สำเร็จ', 'ลบไม่สำเร็จ', 'ปิดงานไม่สำเร็จ', 'ย้อนสถานะไม่สำเร็จ', 'ลงผลโทรไม่สำเร็จ', 'ล้างผลโทรไม่สำเร็จ']) {
      expect(page).toContain(`toast.error(friendlyErrorText(err, '${msg}'))`);
    }
    expect(page.match(/setError\(/g)?.length).toBe(2);
  });
});

describe('กันจอขาว', () => {
  it('แถบ iRecruit ถอดแล้ว (6 ต.ค. 2569) — ปุ่มดึงตอนนี้อ่านผลแบบปลอดภัย (คำตอบผิดรูปไม่พัง)', () => {
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page).toContain('const sum = res?.summary;');
    expect(page).toContain('${sum?.added ?? 0}');
  });
  it('เก็บไปโทรเอง: skipped ไม่มี = []', () => {
    expect(read('src/lib/publicApplicationsApi.ts')).toContain('skipped: Array.isArray(out?.skipped) ? out.skipped : []');
  });
  it('ลิงก์ไม่มีรหัสไม่ถูกโชว์', () => {
    expect(read('src/components/jobs/GenApplyLinkDialog.tsx')).toContain('.filter((l) => Boolean(l?.code))');
    expect(read('src/components/jobs/AddChannelLinks.tsx')).toContain("if (!link?.code) throw new Error('Gen link ไม่สำเร็จ');");
  });
});

describe('คำบนจอ — ตัดประโยคอธิบาย / ไม่มีรหัสอังกฤษดิบ', () => {
  it('รหัสผลโทรในสรุปของ Lumos กลายเป็นคำไทยของงานติดตาม', async () => {
    const { thaiOutcomeWords } = await import('../../src/lib/followPlanning');
    expect(thaiOutcomeWords('ผลลัพธ์ที่บันทึกไว้คือ confirmed')).not.toMatch(/confirmed/);
    expect(thaiOutcomeWords('สถานะ preparing')).toBe('สถานะ กำลังเตรียมสาย');
    expect(thaiOutcomeWords('ข้อความปกติ')).toBe('ข้อความปกติ');
  });
  it('ไม่มีข้อความช่วงห้ามโทร 20:00–08:00 บนจอแล้ว (ยกเลิก 28 ก.ย.)', () => {
    for (const f of [
      'src/components/recruit-rm/CallChoiceConfirmDialog.tsx',
      'src/pages/jobs/UnitRequestTabPage.tsx',
      'src/components/jobs/JobRecallSuggestions.tsx',
      'src/components/dashboard/LumosCallRatePanel.tsx',
    ]) {
      expect(read(f), f).not.toMatch(/20:00–08:00/);
    }
  });
  it('ประโยคยาวที่ QA เจอหายจากจอ', () => {
    const gone: Array<[string, string]> = [
      ['src/pages/follow/FollowPage.tsx', 'ทำทีละขั้น — ใครก่อน'],
      ['src/pages/follow/FollowPage.tsx', '① คนที่จะติดตาม'],
      ['src/components/follow/StaffContactField.tsx', 'เลือกชื่อแล้วเบอร์ขึ้นเอง'],
      ['src/components/follow/FollowPlanningCalendar.tsx', 'ไม่ถูกนำมาหาร'],
      ['src/components/follow/FollowPlanningCalendar.tsx', 'ไม่ใช่เฉพาะวันที่เลือก'],
      ['src/components/follow/FollowEditDialog.tsx', 'ใครกรอกคนนั้นเป็นเจ้าของ'],
      ['src/components/follow/RoundScriptNote.tsx', 'แก้บทได้ที่หน้าตั้งค่า'],
      ['src/components/follow/FollowCallRoundsPanel.tsx', '(Call Pipeline)'],
      ['src/components/jobs/JobBoardView.tsx', 'ตัวเลขข้างบนทั้งหมดไม่นับส่วนนี้'],
      ['src/lib/recruitRm.ts', 'ล็อกต้องเช็คสิทธิ์ BU'],
    ];
    for (const [f, text] of gone) expect(read(f), `${f}: ${text}`).not.toContain(text);
  });
});

describe('ดีไซน์ / มือถือ / สถานะจอ (ก้อน 3)', () => {
  it('สีแบรนด์โหมดมืด: ค่าตั้งต้นใช้ค่าธีม · สีที่ตั้งเองความสว่าง 64%', async () => {
    const { brandPrimaryForTheme, DEFAULT_BRANDING } = await import('../../src/lib/brandingStorage');
    expect(brandPrimaryForTheme(DEFAULT_BRANDING.primaryHsl, false)).toBe(DEFAULT_BRANDING.primaryHsl);
    expect(brandPrimaryForTheme(DEFAULT_BRANDING.primaryHsl, true)).toBeNull();
    expect(brandPrimaryForTheme('210 60% 30%', true)).toBe('210 60% 64%');
    expect(brandPrimaryForTheme('210 60% 70%', true)).toBe('210 60% 64%');
  });
  it('ป๊อปมีพื้นทึบทั้งสองธีม + ม่านโหมดมืดเข้ม + ปุ่มปิด 36px', () => {
    const d = read('src/components/ui/dialog.tsx');
    expect(d).toContain('jarvis-frost bg-card dark:bg-card');
    expect(d).toContain('dark:bg-background/80');
    expect(d).toContain('h-9 w-9');
  });
  it('ช่วงเวลากลางคืน 20–06 กรองได้ (ข้ามเที่ยงคืน)', async () => {
    const { filterFollowEntries } = await import('../../src/lib/followListFilter');
    const e = (iso: string) => ({ id: iso, scheduled_at: iso }) as never;
    const rows = [e('2026-10-05T19:00:00Z'), e('2026-10-04T21:30:00Z'), e('2026-10-05T05:00:00Z')];
    // 02:00 ไทย + 04:30 ไทย อยู่ในกลางคืน · 12:00 ไทยไม่อยู่
    const out = filterFollowEntries(rows, { date: '', band: 'night' } as never);
    expect(out.map((r: { id: string }) => r.id).sort()).toEqual(['2026-10-04T21:30:00Z', '2026-10-05T19:00:00Z'].sort());
  });
  it('ตารางผู้สมัครว่าง = หัวตาราง + แถว "ไม่พบใบสมัคร" (ไม่หายทั้งตาราง)', () => {
    const t = read('src/components/recruit-rm/RmTable.tsx');
    expect(t).not.toContain('ลองล้างคำค้นหรือเปลี่ยนแท็บ');
    expect(t).toContain('data-testid="rm-empty-row"');
  });
  it('ไม่มีป๊อปซ้อนป๊อปในป๊อปเพิ่มคน — ตัวเลือกชื่อ/หน่วยงานฝังในที่เดิม', () => {
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page).not.toMatch(/<BoardPersonPicker\b/);
    expect(page).not.toMatch(/<BoardUnitPicker\b/);
    // ชื่อมาจาก ERP แล้ว (9 ต.ค. 2569 "เอาเป็นจาก Erp แทน") — ยังฝังในป๊อปเดิม ไม่เปิด Dialog ใหม่
    expect(page).toContain('<ErpPersonPickerBody');
    expect(read('src/components/follow/ErpPersonPicker.tsx')).not.toMatch(/<Dialog\b/);
    expect(page).toContain('<BoardUnitPickerBody');
  });
  it('แถบขั้นมีป้ายสั้นบนจอแคบ', async () => {
    const { RELEASE_STEP_TEXT } = await import('../../src/lib/boardRelease');
    expect(Object.values(RELEASE_STEP_TEXT).map((t) => t.short)).toEqual(['ตรวจใบขอ', 'สถานที่', 'รายได้', 'ส่ง']);
  });
  it('อ่าน meta ใบขอไม่ได้ = feed ล้ม ไม่ถอยไป /api/jobs เงียบ ๆ', () => {
    expect(read('src/lib/siamrajUnitRequestsApi.ts')).toContain("if (!r.ok) throw new HttpError(r.status, 'อ่านใบขอจากระบบงานหลักไม่ได้');");
  });
  it('ใบประวัติ: โหลดไม่ได้แยกจากยังไม่มี', () => {
    expect(read('src/components/recruit-rm/ApplicantRecordTables.tsx')).toContain("if (state === 'failed')");
    expect(read('src/lib/applicationContactsApi.ts')).toContain("throw new Error('โหลดประวัติการติดต่อไม่ได้')");
  });
  it('ชื่อแท็บเบราว์เซอร์ = หน้า · ชื่อระบบ', async () => {
    const { setPageTitle } = await import('../../src/lib/brandingStorage');
    const g = globalThis as { document?: { title: string } };
    const prev = g.document;
    g.document = { title: '' };
    setPageTitle('ติดตามคนเริ่มงาน');
    expect(g.document.title).toBe('ติดตามคนเริ่มงาน · So Recruit');
    setPageTitle(null);
    expect(g.document.title).toBe('So Recruit');
    g.document = prev;
  });
});

describe('คำว่า "Gen link" ทั้งระบบ (เจ้าของยืนยัน 5 ต.ค. 2569)', () => {
  it('ไม่มี "สร้างลิงก์" ในข้อความบนจอแล้ว', () => {
    for (const f of [
      'src/components/jobs/JobBoardView.tsx',
      'src/components/jobs/GenApplyLinkDialog.tsx',
      'src/components/jobs/AddChannelLinks.tsx',
      'src/components/jobs/RecruitBoardTools.tsx',
      'src/components/jobs/BoardPublishSheet.tsx',
      'src/lib/roleFunctions.ts',
      'src/lib/jobLinkSilence.ts',
      'src/lib/recruitRm.ts',
      'src/lib/boardFlow.ts',
      'src/pages/recruit/RecruitChannelsPage.tsx',
    ]) {
      const code = read(f)
        .split('\n')
        .filter((l) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(l) && !/^\s+[^'"`<]*สร้างลิงก์[^'"`>]*$/.test(l))
        .join('\n');
      expect(code, f).not.toMatch(/['"`>]\s*[^'"`<]*สร้างลิงก์/);
    }
  });
});

describe('สีหลักโหมดมืดอ่านชัด (เจ้าของ Choice 5 ต.ค. 2569)', () => {
  it('index.css: สีหลักสว่าง 353 70% 64% + ตัวหนังสือบนสีหลักกรมท่าเข้ม', () => {
    const css = read('src/index.css');
    const dark = css.slice(css.indexOf('  .dark {'), css.indexOf('--sidebar-ring', css.indexOf('  .dark {')) + 40);
    expect(dark).toContain('--primary: 353 70% 64%;');
    expect(dark).toContain('--primary-foreground: 220 54% 12%;');
    expect(dark).toContain('--sidebar-primary-foreground: 220 54% 12%;');
  });
  it('branding ไม่เขียนตัวหนังสือขาวทับโหมดมืด', () => {
    const b = read('src/lib/brandingStorage.ts');
    expect(b).not.toContain("root.style.setProperty('--primary-foreground', '0 0% 100%');");
    expect(b).toContain("if (dark) root.style.removeProperty(name);");
  });
});
