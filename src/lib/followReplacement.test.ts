/**
 * แท็บ "ติดตามส่งคนแทน" (เจ้าของสั่ง 1 ต.ค. 2569: *"ทำงานเหมือนกันแค่คนละทีม · ต้องเหมือนกันนะ"*)
 * 🔴 ด่าน: แยกกองด้วยทีม (follow_team) ไม่ใช่เรื่อง · สองแท็บไม่ทับ ไม่หาย · หน้าตา/ฟอร์มเหมือนกันทุกอย่าง ·
 *    แท็บรายชื่อติดตามไม่ส่งคีย์ทีม (พฤติกรรมเดิม) · รอบที่เพิ่มในกล่องแก้ไขตามทีมเดิม
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FOLLOW_TEAM_REPLACEMENT, followScopeEntries, followTeamForScope, isReplacementFollow } from './followReplacement';

describe('ทีมส่งคนแทน = follow_team replacement', () => {
  it('ค่าตัวเดียว · ไม่มีคีย์/ค่าอื่น = ทีมติดตาม (ของเดิมทุกแถว)', () => {
    expect(FOLLOW_TEAM_REPLACEMENT).toBe('replacement');
    expect(isReplacementFollow({ follow_team: 'replacement' })).toBe(true);
    expect(isReplacementFollow({ follow_team: null })).toBe(false);
    expect(isReplacementFollow({})).toBe(false);
    expect(isReplacementFollow({ follow_team: 'other' })).toBe(false);
  });

  it('🔴 สองแท็บแยกกันพอดี: ไม่มีรายการไหนอยู่สองที่ และรวมกันได้ครบ · เรื่องไม่เกี่ยว', () => {
    const items = [
      { id: 'a', topic: 'ติดตามเริ่มงาน', follow_team: null },
      { id: 'b', topic: 'ติดตามเริ่มงาน', follow_team: 'replacement' as const },
      { id: 'c', topic: 'ติดตามเบิกเบี้ยเลี้ยง' },
      { id: 'd', topic: 'ติดตามเบิกเบี้ยเลี้ยง', follow_team: 'replacement' as const },
    ];
    const main = followScopeEntries(items, 'main').map((x) => x.id);
    const repl = followScopeEntries(items, 'replacement').map((x) => x.id);
    expect(main).toEqual(['a', 'c']);
    expect(repl).toEqual(['b', 'd']);
    expect([...main, ...repl].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('กดเพิ่มจากแท็บไหน = ทีมของแท็บนั้น · แท็บรายชื่อติดตามไม่ส่งคีย์', () => {
    expect(followTeamForScope('replacement')).toBe('replacement');
    expect(followTeamForScope('main')).toBeUndefined();
  });
});

describe('หน้าการติดตาม: สองแท็บเหมือนกันทุกอย่าง แค่คนละทีม', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
  const page = read('pages/follow/FollowPage.tsx');
  const edit = read('components/follow/FollowEditDialog.tsx');

  it('มีแท็บ ติดตามส่งคนแทน คั่นระหว่างติดตามคนเริ่มงานกับ Dashboard', () => {
    // className ของแท็บเปลี่ยนตามจอได้ (4 ต.ค. 2569 จัดหน้ารองรับมือถือ) — เช็คค่า+คำ+ลำดับ ไม่ผูกคลาส
    const order = [
      /<TabsTrigger value="list"[^>]*>ติดตามคนเริ่มงาน<\/TabsTrigger>/,
      /<TabsTrigger value="replace"[^>]*>ติดตามส่งคนแทน<\/TabsTrigger>/,
      /<TabsTrigger value="dashboard"[^>]*>Dashboard<\/TabsTrigger>/,
    ].map((re) => page.search(re));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });

  it('🔴 ไม่มีป้าย/ฟอร์มเฉพาะแท็บ — ปุ่ม หัวป๊อป ช่องเรื่อง หน้าว่าง ชุดเดียวกัน (แท็บบอกแค่ "กองไหน" กับ "ทีมไหน")', () => {
    for (const gone of ['เพิ่มคนที่จะไปแทนงาน', 'ยังไม่มีคนที่ส่งไปแทนงาน', 'REPLACEMENT_TOPIC', 'effectiveTopic']) {
      expect(page, gone).not.toContain(gone);
    }
    // 2 = ทีม · กอง — แถบ iRecruit ถอดแล้ว (เจ้าของ 6 ต.ค. 2569 "เอาออกไม่ต้องโชว์ เหลือไว้แค่ปุ่ม ดึงตอนนี้")
    expect(page.match(/replaceView \?/g)?.length).toBe(2);
    expect(page).not.toContain('IrecruitReplaceSyncBar');
    // ข้อยกเว้นเดียวของแท็บนี้ = ปุ่ม "ดึงตอนนี้" แทนปุ่มรีเฟรช (หัวหน้างานขึ้นไป)
    expect(page).toMatch(/followView === 'replace' \? \(\s*canManageMasters \? \(/);
    expect(page).toContain("{pulling ? 'กำลังดึง…' : 'ดึงตอนนี้'}");
    expect(page).toContain("followTeamForScope(replaceView ? 'replacement' : 'main')");
    expect(page).toContain('<TopicField id="followTopic" value={topic} onChange={setTopic} reloadSignal={topicsRev} />');
  });

  it('🔴 จออ่านจากชุดของแท็บ · ตัวกันนัดซ้ำเทียบทั้งก้อน · สร้างทุกทางส่งทีมของแท็บ · รอบเพิ่มทีหลังตามทีมเดิม', () => {
    expect(page).toContain("followScopeEntries(items, replaceView ? 'replacement' : 'main')");
    // 6 ต.ค. 2569: ตัวกรอง EX/คนใน กรองต่อจากชุดของแท็บ (`kindScopedItems`) — ทั้งแท็บเดิมยังเท่าเดิมเพราะไม่กรองเมื่อไม่ใช่แท็บส่งคนแทน
    expect(page).toContain('filterFollowEntries(kindScopedItems,');
    expect(page).toContain('entries={kindScopedItems}');
    expect(page).toContain("followView === 'replace' && replaceKind !== 'all' ? scopeItems.filter((e) => replaceKindOf(e) === replaceKind) : scopeItems");
    // ตัวกันนัดซ้ำทั้งสองโหมดเทียบกับ `items` ทั้งก้อน (ทุกทีม) — โหมดตารางเทียบทุกสาย ไม่ใช่แค่สายแรกของวัน
    expect(page).toMatch(/findScheduleDuplicates\(\s*phone,\s*calls\.map\(\(c\) => c\.scheduledAt\),\s*items,?\s*\)/);
    expect(page).toContain('findScheduleDuplicates(phone, isoTimes, items)');
    expect(page.match(/follow_team: followTeam,/g)?.length).toBe(2);
    expect(edit).toContain("follow_team: entry.follow_team === 'replacement' ? 'replacement' : undefined,");
  });
});

/**
 * 🔴 หัวการ์ด "ขั้นตอนของสาย" (แก้ 3 ต.ค. 2569 — เจ้าของสั่ง "เอาออก" ทีละตัวระหว่างไล่ Journey):
 * เม็ดเลขต่อสาย **ทั้งหมด / สายที่ 1 / สายที่ 2 / สายที่ 3** เห็นเลขเลยไม่พับใน dropdown
 * (*"มันต้องบอก ทั้งหมดเท่าไหร่ สาย1เท่าไหร่ สาย2เท่าไหร่ สายที่3 เท่าไหร่"*) ·
 * ตัวกรองเหลือ "ใครโทร" ตัวเดียว — "นับช่วง" (แผงเดินตามแท็บรายวัน/รายเดือนแทน) ·
 * "งานจบหรือยัง" (ลิสต์ยืนที่กำลังตาม) · บรรทัดแยก AI/คน ถูกถอดทั้งสาม ห้ามเติมกลับ
 */
describe('หน้าการติดตาม: หัวการ์ด Call Pipeline (ฉบับ 3 ต.ค. 2569)', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
  const page = read('pages/follow/FollowPage.tsx');
  const panel = read('components/follow/FollowCallRoundsPanel.tsx');

  it('สายที่ = dropdown (3 ต.ค. 2569 "เอาพวกนี้รวมกันเป็น Dropdown") · ตัวเลขเป็นเลขใหญ่แถวเดียวแบบโล่ง (เจ้าของเลือก)', () => {
    // dropdown สายที่ ย้ายไปแถวแท็บรายวัน/รายเดือน (5 ต.ค. 2569) — FollowFilterGroup
    expect(read('components/follow/FollowFilterGroup.tsx')).toContain('ariaLabel="ดูเฉพาะสายที่"');
    expect(page).toContain('<FollowFilterGroup');
    expect(panel).toContain('data-testid="call-summary"');
    expect(panel).not.toContain('data-testid="call-matrix"');
    // 🔴 ไม่มีหลอดสัดส่วนใต้เลข (เจ้าของสั่ง 3 ต.ค. 2569 "เอาหลอดออก")
    const summary = panel.slice(panel.indexOf('data-testid="call-summary"'), panel.indexOf('แถวสัญญาณท้ายการ์ด'));
    expect(summary.length).toBeGreaterThan(100);
    expect(summary).not.toContain('bg-secondary');
    expect(summary).not.toContain('width: `');
    // AI โทร / คนโทร ของสายที่เลือก (3 ต.ค. 2569 "บอกเพิ่มด้วยว่า AI เท่าไหร่ คนเท่าไหร่ แบบทั้งหมดและแต่ละสาย")
    expect(panel).toContain("{ key: 'ai', label: 'AI โทร', list: aiList }");
    expect(panel).toContain("{ key: 'manual', label: 'คนโทร', list: manualList }");
  });

  it('🔴 แถวบนสุด = ย้อนกลับ + แท็บ + ปุ่มของหน้า · ชื่อหน้าไม่โชว์บนจอ (3 ต.ค. 2569)', () => {
    expect(page).not.toContain('<PageHeader');
    expect(page).toContain('<h1 className="sr-only">{conveyorLabel(\'follow\')}</h1>');
    expect(page).toContain('{headerButtons}');
    const calendar = read('components/follow/FollowPlanningCalendar.tsx');
    expect(calendar).not.toContain('>ปฏิทินติดตาม</h2>');
    expect(calendar).not.toContain('headerAction');
    expect(panel).toContain('buildFollowCallMatrix(entries)');
    // แถวตัวกรองย้ายจากหัวแผงไปแถวแท็บรายวัน/รายเดือน (5 ต.ค. 2569) — ปฏิทินวางหนึ่งที่ แผงไม่มีแล้ว
    expect(panel).not.toContain('filtersSlot');
    expect(calendar.match(/\{filtersSlot\}/g)?.length).toBe(1);
    // 🔴 ไม่หุบการ์ดตอนว่างแล้ว (เจ้าของสั่ง 1 ต.ค. 2569 "ถ้าไม่มีข้อมูลก็เป็น 0 ไป") — ห้ามกลับไปหุบ
    expect(panel).not.toContain('const allEmpty');
    expect(panel).not.toContain('ยังไม่มีสายในระบบ');
  });

  it('🔴 การ์ดตัวเลข 4 ใบถูกถอด — เลขชุดเดียวกันห้ามอยู่สองที่อีก (3 ต.ค. 2569)', () => {
    const calendar = read('components/follow/FollowPlanningCalendar.tsx');
    expect(calendar).not.toContain('<StatCard');
    expect(calendar).not.toContain('data-stat=');
  });

  it('ตัวกรองเหลือ "ใครโทร" ตัวเดียว — นับช่วง/งานจบหรือยัง/บรรทัดแยก AI-คน ถูกถอด (3 ต.ค. 2569)', () => {
    expect(page).toContain('filtersSlot={');
    expect(page).toContain('ariaLabel="ใครโทร"');
    expect(page).not.toContain('ariaLabel="งานจบหรือยัง"');
    expect(page).not.toContain('ariaLabel="แผงนับช่วงไหน"');
    expect(page).not.toContain('data-testid="caller-stats"');
  });

  it('ช่วงที่แผงนับเดินตามแท็บรายวัน/รายเดือนของปฏิทิน (ไม่มีปุ่มซ้ำ)', () => {
    expect(page).toContain('onViewChange={setPanelRange}');
    const calendar = read('components/follow/FollowPlanningCalendar.tsx');
    expect(calendar).toContain('onViewChange?.(v as View);');
  });

  it('🔴 ไม่มีประโยคใต้ชื่อหน้า "ลงรายชื่อคนที่ต้องติดตาม แล้ว AI จะโทรตามให้" (เจ้าของสั่งเอาออก 1 ต.ค. 2569)', () => {
    expect(page).not.toContain('subtitle="ลงรายชื่อคนที่ต้องติดตาม');
    expect(page).not.toMatch(/<PageHeader[^>]*subtitle=/);
  });

  it('🔴 สลับแท็บทีม = ตัวกรองกลับค่าเริ่มต้น (กัน "ดูเฉพาะ" ค้างตอนแท็บว่างหุบหัวการ์ด)', () => {
    // "งานจบหรือยัง" ถูกถอด 3 ต.ค. 2569 — เหลือรีเซ็ตรอบ + ใครโทร (ลิสต์ยืนที่กำลังตามเสมอ)
    // + กล่องผลที่เลือก (5 ต.ค. 2569 "ชื่อย้ายไปตามกล่อง") ก็กลับเป็นทุกคน
    expect(page).toMatch(/if \(filterScope !== replaceView\) \{\s*setFilterScope\(replaceView\);\s*setActiveRound\('all'\);\s*setResultBox\(null\);\s*setCaller\('all'\);/);
  });
});
