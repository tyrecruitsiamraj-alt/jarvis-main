/**
 * ═══ หน้าหลัก: ตัวเลขบวกลบลงตัวทุกก้อน (เจ้าของ 21 ต.ค. 2569) ═══
 * > *"เช็คพวกตัวเลขทั้งระบบดีๆนะ อะไรบวกลบกันแล้วมันต้องเท่ากันนะ"*
 * โหวต 4 บทบาท: A ยอดหลักไม่นับยกเลิก · B เลขเดียวกันทุกหน้า · C กำกับ % · D+E แถบต้องทำเหนือแท็บ
 * วัดกับฐานจริง 6 ช่วง/BU: กล่อง = กราฟรายวัน = รายชื่อป๊อป = ผลโทรไม่นับยกเลิก (15–21 ต.ค. 1,192 · ยกเลิก 1,298)
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFollowAiShareSql } from '../../api/_lib/homeAiShareSql';
import { onlineApplicantKindOf, type OnlineApplicantRow } from '@/lib/homeOnline';
import { todoItemsOf } from '@/components/home-ai-share/HomeTodoStrip';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('A · สายยกเลิกไม่นับในยอดหัวข้อติดตาม — ชุดยกเลิกชุดเดียวกับการ์ดผลโทร', () => {
  it('ยอด/รายวัน/รายชื่อ ตัดด้วย id สายยกเลิก ($5) · ยกเลิกส่งแยก', () => {
    const total = buildFollowAiShareSql(true, 'follow');
    expect(total).toContain('(f.id::text = any($5::text[])) as is_cancelled');
    expect(total).toContain('count(*) filter (where not is_cancelled)::int');
    expect(total).toContain('count(*) filter (where is_cancelled)::int');
    expect(buildFollowAiShareSql(true, 'follow', 'byDayBu')).toContain('not is_cancelled');
    expect(buildFollowAiShareSql(true, 'follow', 'list', { key: 'total', limit: 20, offset: 0 })).toContain('(select * from f0 where not is_cancelled) f1');
    // ดูแลหลังเริ่มงาน / ผลโทร ไม่มี $5
    expect(buildFollowAiShareSql(true, 'aftercare')).not.toContain('$5');
    expect(buildFollowAiShareSql(true, 'follow', 'results')).not.toContain('$5');
  });
  it('ทุกตัวโหลดของหัวข้อติดตามส่ง id ยกเลิกจากตัวจัดช่องเดียวกับการ์ดผลโทร', () => {
    const h = read('api/_handlers/home-ai-share.ts');
    expect(h.match(/await followTail\(params, (lane|block)\)/g)?.length).toBe(3);
    expect(read('api/_lib/homeLumosSummarySql.ts')).toContain("rows.filter((r) => followLedgerBucket(r, derived) === 'cancelled')");
  });
  it('หน้าจอ: ยอด/ทีม/BU/ตาราง/ป๊อป ไม่นับยกเลิก · ยกเลิกบอกแยกว่า "ไม่นับ"', () => {
    const page = read('src/pages/HomeAiSharePage.tsx');
    expect(page).toContain("followAllCells.filter((c) => c.bucket !== 'cancelled')");
    expect(page).toContain("label: 'ยกเลิก · ไม่นับ'");
    expect(page).toContain('data-testid="home-results-cancelled"');
    const table = read('src/components/home-ai-share/AiShareLumosStats.tsx');
    expect(table).toContain('const all = split.ai.total - split.ai.cancelled + split.staff.total - split.staff.cancelled;');
    expect(table).toContain('{CANCELLED_COL.label} · ไม่นับ');
    const pop = read('src/components/home-ai-share/FollowCallerDialog.tsx');
    expect(pop).toContain('const liveOf = (t: (typeof topics)[number]) => t.rows.length - t.cols.cancelled.length;');
  });
});

describe('B · ส่งให้ AI นิยามเดียวสองแท็บ', () => {
  const row = (o: Partial<OnlineApplicantRow>): OnlineApplicantRow => ({
    bu: null, position: null, age: 30, queued: false, ai: false, staff: false, inQueue: false, aiOutcome: null, aiSummary: null, aiReply: null, ...o,
  });
  it('ใบไม่เข้าคิว AI แม้ AI เคยโทรเบอร์นี้จากใบอื่น = ไม่ได้ส่ง (เท่า `dispatchKindOf` แท็บงานสรรหา)', () => {
    expect(onlineApplicantKindOf(row({ ai: true }))).toBe('notSent');
    expect(onlineApplicantKindOf(row({ queued: true }))).toBe('sent');
    expect(onlineApplicantKindOf(row({ age: 60 }))).toBe('overAge');
  });
});

describe('C · เปอร์เซ็นต์บอกว่าเทียบกับอะไร', () => {
  it('ชิปทุกกล่องมีบรรทัดช่วงก่อน · แถบ % บอก "ของทั้งหมด" · AI เพิ่ม = ดี · ยังไม่โทรเพิ่ม = แย่', () => {
    const page = read('src/pages/HomeAiSharePage.tsx');
    expect(page).toContain('foot={prevFoot(prevCounts?.[k])}');
    expect(page).toContain("{ total: null, ai: true, staff: null, both: null, notCalled: false }");
    expect(read('src/components/home-ai-share/HomeKpis.tsx')).toContain('% ของทั้งหมด');
  });
});

describe('D+E · แถบต้องทำเหนือแท็บ', () => {
  it('5 เรื่อง ไปแท็บของตัวเอง · ไม่มีข้อมูล = "—" ไม่ใช่ 0', () => {
    const items = todoItemsOf(null);
    expect(items.map((i) => [i.label, i.tab])).toEqual([
      ['ยังไม่ประกาศ', 'online'],
      ['รอคนโทร', 'follow'],
      ['ไม่ได้ส่ง AI', 'applicants'],
      ['เขียวยังว่าง', 'matching'],
      ['รอโทรหลังเริ่มงาน', 'aftercare'],
    ]);
    expect(items.every((i) => i.value === null)).toBe(true);
  });
  it('เลขมาจากตัวนับเดียวกับแท็บ', () => {
    const h = read('api/_handlers/home-ai-share.ts');
    expect(h).toContain("loadTopicReport('applicants', start, end, bu)");
    expect(h).toContain('lumos.follow.staff.waiting');
    expect(h).toContain("(c.col === 'noResult' ? c.n : 0)");
    expect(read('api/_lib/homeOnlineSql.ts')).toContain("else if (onlineRequestStateOf(g) === 'open') out.notReleasedOpen += 1;");
    expect(read('src/pages/HomeAiSharePage.tsx')).toContain('<HomeTodoStrip q={winQ} tick={tick} onGo={goTodo} />');
  });
});

describe('F · ตาราง BU พับไว้ (Choice "พับไว้ กดเปิดเอง") · G คงกฎว่างแล้วห้ามหาย', () => {
  it('ทั้งสองการ์ดตาราง BU ใช้ FoldedBuTable · บรรทัดบวกเลขอยู่นอกส่วนพับ', () => {
    const fold = read('src/components/home-ai-share/HomeSections.tsx');
    expect(fold).toContain('const [open, setOpen] = React.useState(false);');
    expect(fold).toContain("{open ? 'ซ่อนตาราง' : 'ดูตาราง'}");
    expect(read('src/components/home-ai-share/AiShareLumosStats.tsx')).toContain('summary={<FollowResults split={split} cells={cells} unit={unit} part="sum" />}');
    expect(read('src/components/home-ai-share/TopicReportCard.tsx')).toContain('<FoldedBuTable title="ผลโทรราย BU" testId={`topic-report-${block}`} summary={sumLine}>');
  });
});
