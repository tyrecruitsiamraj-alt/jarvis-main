// @vitest-environment node
/**
 * เจ้าของ 20 ต.ค. 2569: "Lumos บอกไม่รับสาย ทำไมระบบเราบอกว่าส่ง AI แล้ว ยังไม่มีผล … จะเชื่อถือระบบเราได้ไง"
 * ช่องใบสมัครไม่เคยจดผลขาเข้า + ใบเดียวผิดรูป = ปฏิเสธทั้งชุด ⇒ ผลหายแล้วพิสูจน์ไม่ได้ว่าใครพลาด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitLumosResults } from '../../api/_lib/lumosResultInbox';

const read = (p: string) => readFileSync(p, 'utf8');
const isOk = (v: unknown): v is { outcome: string } =>
  typeof v === 'object' && v !== null && ['completed', 'unresponsive'].includes(String((v as { outcome?: unknown }).outcome));

describe('ผลจาก Lumos: ใบผิดรูปไม่ลากใบอื่นหาย', () => {
  it('แยกใบดี/ใบผิดรูป พร้อมลำดับ', () => {
    const r = splitLumosResults([{ outcome: 'completed' }, { outcome: 'voicemail' }, null, { outcome: 'unresponsive' }], isOk);
    expect(r.valid).toHaveLength(2);
    expect(r.invalid.map((x) => x.index)).toEqual([1, 2]);
  });
  it('ทั้งสองช่องจดทุกใบลงกล่องรับ (ใบผิดรูป = matched false) และไม่ตอบ 400 ทั้งชุดเพราะใบเดียว', () => {
    for (const [file, channel] of [
      ['api/_handlers/lumos-interview.ts', 'interview'],
      ['api/_handlers/lumos-reminder.ts', 'reminder'],
    ] as const) {
      const src = read(file);
      expect(src).toContain('splitLumosResults(results,');
      expect(src).toContain(`recordLumosResultInbox({ channel: '${channel}', ...readInboxFields(bad.item), matched: false`);
      expect(src).not.toMatch(/Item\[\$\{i\}\] is invalid/);
      expect(src).toContain('if (valid.length === 0)');
    }
    expect(read('api/_handlers/lumos-interview.ts')).toMatch(/recordLumosResultInbox\(\{\s*channel: 'interview',\s*\.\.\.readInboxFields\(r\),\s*matched: ok/);
  });
});

describe('มือถือ: ปุ่มช่องตัวเลือกห้ามซ้อนกัน (เจ้าของ 20 ต.ค. 2569 แท็บการติดต่อ)', () => {
  it('กล่องปุ่ม 2 คอลัมน์กว้างตามปุ่ม ไม่ให้ตารางบีบเหลือ 42px', () => {
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain('max-sm:grid max-sm:w-max max-sm:grid-cols-2');
  });
});

describe('แท็บติดตามนัดหมาย: เจ้าหน้าที่คนไหนนัด (เจ้าของ 20 ต.ค. 2569 "ยึดตามเมล์ที่เขา Login")', () => {
  it('อ่านจากบัญชีที่บันทึกนัด (ชื่อเล่น → ชื่อเต็ม → ชื่อที่จด → อีเมล) แล้วโชว์ใต้สถานที่นัด', () => {
    const sql = read('api/_lib/applicationContacts.ts');
    expect(sql).toContain('left join ${usersTable} u on u.id = c.created_by');
    expect(sql).toContain("nullif(btrim(u.nickname), '')");
    expect(read('api/_handlers/job-applications.ts')).toContain('appointment_by = fromLog.by');
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain('นัดโดย {r.appointment_by || EM_DASH}');
  });
});

describe('ของรกบนจอ (เจ้าของ 20 ต.ค. 2569)', () => {
  it('แถบแจ้งผลกดปุ่มหายเมื่อเปลี่ยนแท็บ/กล่อง ไม่ค้างทุกกล่อง', () => {
    expect(read('src/components/recruit-rm/RmWorkspace.tsx')).toMatch(
      /say\(null\);[\s\S]{0,120}\}, \[tab, listView, contactChip, appointmentChip\]\);/,
    );
  });
  it('เกณฑ์ความเร่งของใบนี้ พับไว้ กดถึงกาง', () => {
    const src = read('src/components/jobs/RequestLeadRulesCard.tsx');
    expect(src).toContain('defaultOpen = false');
    expect(src).toContain('<CollapsibleContent');
  });
});

describe('ลิงก์สมัคร: ปุ่มแก้ข้อความอยู่ข้างหัวข้อประกาศ ไม่ใช่ใต้ลิงก์สุดท้าย (เจ้าของ 20 ต.ค. 2569)', () => {
  it('ปุ่มมาก่อนรายการลิงก์', () => {
    const src = read('src/components/jobs/PostingLinksList.tsx');
    expect(src.indexOf('แก้ข้อความประกาศ\n')).toBeLessThan(src.indexOf('<LinkRow key={l.id}'));
  });
});

describe('ปุ่มเลือกใครโทร: ตัวที่เลือกต้องอ่านออก (เจ้าของ 20 ต.ค. 2569 "เกิดไรขึ้น")', () => {
  it('ห้ามทับสีตัวหนังสือเป็นสีหลัก เพราะพื้นตัวที่เลือกเป็นสีหลักแล้ว', () => {
    expect(read('src/components/ui/toggle.tsx')).toContain('data-[state=on]:bg-primary data-[state=on]:text-primary-foreground');
    for (const f of ['src/pages/follow/FollowPage.tsx']) expect(read(f)).not.toMatch(/state=on\]:text-primary(?!-)/);
  });
});

describe('หน้าต่างจับคู่งาน: shadcn + ขนาดตัวอักษรเท่ากัน (เจ้าของ 20 ต.ค. 2569)', () => {
  it('ช่องติ๊กเป็น Checkbox ของ shadcn · ไม่มีขนาดตัวอักษรสุ่ม 9–11px ในหน้าต่าง · ไม่มีประโยคอธิบายเดิม', () => {
    const src = read('src/pages/matching/MatchingPage.tsx');
    const a = src.indexOf('<SheetContent');
    const sheet = src.slice(a, src.indexOf('</SheetContent>', a));
    expect(sheet).not.toContain('type="checkbox"');
    expect(sheet).toContain('<Checkbox');
    expect(sheet).not.toMatch(/text-\[(9|10|11)px\]/);
    for (const old of ['สถานะ Matching ใช้ติดตามการทำงาน', 'รายชื่อด้านล่างคือผลแมทรอบล่าสุด', '1. คนของเรา', '2. คนที่ยังไม่สมัคร']) {
      expect(sheet).not.toContain(old);
    }
  });
});

describe('หน้าจับคู่: เก็บไปโทรเองแล้วมีที่ไปโทรบนจอ (เจ้าของ 20 ต.ค. 2569)', () => {
  it('แท็บ "การติดต่อ" ข้างจับคู่กับงาน → /matching/contact · ว่างแล้วไม่หาย · ข้อความบอกที่ไปตามชนิดคน', () => {
    expect(read('src/components/jobs/UnitSectionTabs.tsx')).toContain("{ id: 'contact', label: 'การติดต่อ', to: '/matching/contact' }");
    expect(read('src/pages/matching/SelectionContactPage.tsx')).toContain('<SelectionContactBoard />');
    expect(read('api/_lib/selectionContacts.ts')).toContain("h.release_reason in ('result', 'expired')");
    const page = read('src/pages/matching/MatchingPage.tsx');
    expect(page).toContain('คนของเราอยู่แท็บ "การติดต่อ" ข้างจับคู่กับงาน');
    expect(page).not.toContain('ของกล่องงาน`);');
  });
});
