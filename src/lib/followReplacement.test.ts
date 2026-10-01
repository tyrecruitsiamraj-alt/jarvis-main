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

  it('มีแท็บ ติดตามส่งคนแทน คั่นระหว่างรายชื่อติดตามกับ Dashboard', () => {
    const order = ['<TabsTrigger value="list">รายชื่อติดตาม</TabsTrigger>', '<TabsTrigger value="replace">ติดตามส่งคนแทน</TabsTrigger>', '<TabsTrigger value="dashboard">Dashboard</TabsTrigger>'].map((t) => page.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });

  it('🔴 ไม่มีป้าย/ฟอร์มเฉพาะแท็บ — ปุ่ม หัวป๊อป ช่องเรื่อง หน้าว่าง ชุดเดียวกัน (แท็บบอกแค่ "กองไหน" กับ "ทีมไหน")', () => {
    for (const gone of ['เพิ่มคนที่จะไปแทนงาน', 'ยังไม่มีคนที่ส่งไปแทนงาน', 'REPLACEMENT_TOPIC', 'effectiveTopic']) {
      expect(page, gone).not.toContain(gone);
    }
    expect(page.match(/replaceView \?/g)?.length).toBe(2);
    expect(page).toContain("followTeamForScope(replaceView ? 'replacement' : 'main')");
    expect(page).toContain('<TopicField id="followTopic" value={topic} onChange={setTopic} reloadSignal={topicsRev} />');
  });

  it('🔴 จออ่านจากชุดของแท็บ · ตัวกันนัดซ้ำเทียบทั้งก้อน · สร้างทุกทางส่งทีมของแท็บ · รอบเพิ่มทีหลังตามทีมเดิม', () => {
    expect(page).toContain("followScopeEntries(items, replaceView ? 'replacement' : 'main')");
    expect(page).toContain('filterFollowEntries(scopeItems,');
    expect(page).toContain('entries={scopeItems}');
    // ตัวกันนัดซ้ำทั้งสองโหมดเทียบกับ `items` ทั้งก้อน (ทุกทีม) — โหมดตารางเทียบทุกสาย ไม่ใช่แค่สายแรกของวัน
    expect(page).toMatch(/findScheduleDuplicates\(\s*phone,\s*calls\.map\(\(c\) => c\.scheduledAt\),\s*items,?\s*\)/);
    expect(page).toContain('findScheduleDuplicates(phone, isoTimes, items)');
    expect(page.match(/follow_team: followTeam,/g)?.length).toBe(2);
    expect(edit).toContain("follow_team: entry.follow_team === 'replacement' ? 'replacement' : undefined,");
  });
});

/**
 * 🔴 เจ้าของสั่ง 1 ต.ค. 2569: *"งานจบหรือยัง ทำเป็น Dropdown แล้วย้ายไปไว้ กับตรง ดูเฉพาะ แล้ว ดูเฉพาะก็ทำเป็น Dropdown"*
 * ทั้งสองตัวอยู่บนหัวการ์ด "ขั้นตอนของสาย" คู่กัน · แถวชิปด้านล่างถอดแล้ว · ใช้ทั้งสองแท็บ (โค้ดชุดเดียว)
 */
describe('หน้าการติดตาม: ดูเฉพาะ + งานจบหรือยัง เป็น dropdown คู่กัน', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
  const page = read('pages/follow/FollowPage.tsx');
  const panel = read('components/follow/FollowCallRoundsPanel.tsx');

  it('ดูเฉพาะ = ChoiceDropdown บนหัวการ์ด ไม่ใช่ชิปรอบ · วางตัวกรองของหน้าแม่ไว้ข้างกัน', () => {
    expect(panel).toContain('<ChoiceDropdown');
    expect(panel).toContain('ariaLabel="ดูเฉพาะสายที่"');
    expect(panel).not.toContain('aria-label="ตัวกรองรอบ"');
    expect(panel.match(/\{filtersSlot\}/g)?.length).toBe(1);
    // 🔴 ไม่หุบการ์ดตอนว่างแล้ว (เจ้าของสั่ง 1 ต.ค. 2569 "ถ้าไม่มีข้อมูลก็เป็น 0 ไป") — ห้ามกลับไปหุบ
    expect(panel).not.toContain('const allEmpty');
    expect(panel).not.toContain('ยังไม่มีสายในระบบ');
  });

  it('งานจบหรือยัง = ChoiceDropdown ที่ส่งเข้า filtersSlot · แถวชิปเดิมด้านล่างหายแล้ว', () => {
    expect(page).toContain('filtersSlot={');
    expect(page).toContain('ariaLabel="งานจบหรือยัง"');
    expect(page).not.toContain('>งานจบหรือยัง ·<');
    expect(page).not.toMatch(/FOLLOW_TABS\.map\(\(t\) => \(\s*<button/);
  });

  it('🔴 ไม่มีประโยคใต้ชื่อหน้า "ลงรายชื่อคนที่ต้องติดตาม แล้ว AI จะโทรตามให้" (เจ้าของสั่งเอาออก 1 ต.ค. 2569)', () => {
    expect(page).not.toContain('subtitle="ลงรายชื่อคนที่ต้องติดตาม');
    expect(page).not.toMatch(/<PageHeader[^>]*subtitle=/);
  });

  it('🔴 สลับแท็บทีม = ตัวกรองกลับค่าเริ่มต้น (กัน "ดูเฉพาะ" ค้างตอนแท็บว่างหุบหัวการ์ด)', () => {
    expect(page).toMatch(/if \(filterScope !== replaceView\) \{\s*setFilterScope\(replaceView\);\s*setActiveRound\('all'\);\s*setTab\('active'\);/);
  });
});
