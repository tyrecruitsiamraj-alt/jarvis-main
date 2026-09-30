// @vitest-environment node
/**
 * ═══ หน้าหลัก "ระบบไปกี่ %" — AI โทร vs คนโทร (เจ้าของเคาะ 30 ก.ย. 2569) ═══
 *
 * นิยามที่เคาะผ่าน Choice: โทรจริงที่มีผลบันทึก · ก้อน "ทั้งสองทาง" แยก (รวมกันได้ 100% พอดี) ·
 * เลขตัวใหญ่ = AI ÷ ที่โทรแล้ว · แถบ = 4 ก้อนจากทั้งหมด · ช่วงเลือกบนปฏิทิน ค่าตั้งต้น 7 วันล่าสุด ·
 * ดูแลหลังเริ่มงาน = สายที่ตั้งไว้ในระบบ · จับคู่งาน = คนต่อใบขอ
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. "โทรแล้ว" ของผู้สมัคร = หลักฐานชุดเดียวกับกล่องงาน แยกแค่ใครโทร (ชิ้นครบ ไม่ทับกัน)
 * 2. ติดตามกับดูแลหลังเริ่มงานเป็นแถวตารางเดียวกัน ⇒ ต้องแยกด้วยหัวข้อ ไม่งั้นนับซ้ำสองก้อน
 * 3. จับคู่งานต่อคิวเลน match + hold ของหน้านั้นเท่านั้น (hold ของใบสมัครอยู่ก้อนผู้สมัคร)
 * 4. % ที่ขึ้นจอรวมกันได้ 100 พอดี · ยังไม่มีงานที่โทรแล้ว = ไม่มี % (ห้าม 0% ปลอม)
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CALLED_BY_AI_SQL,
  CALLED_BY_STAFF_SQL,
  CALLED_EVIDENCE,
  CALLED_SQL,
} from '../../api/_lib/applicantOverviewSql.js';
import {
  FOLLOW_QUEUE_MATCH,
  MATCH_HOLD_WHERE,
  MATCH_QUEUE_WHERE,
  SEGMENT_WHERE,
  buildApplicantAiShareSql,
  buildFollowAiShareSql,
  buildMatchingAiShareSql,
} from '../../api/_lib/homeAiShareSql.js';
import { queuePayloadName, queuePayloadNameSql } from '../../api/_lib/lumosQueueDefs.js';
import {
  LIST_RESOURCE,
  buildAiShareDetail,
  buildAiShareList,
  buildHomeAiShare,
  canListAiShare,
} from '../../api/_handlers/home-ai-share.js';
import { queueLane } from '../../src/lib/officeTeam.js';
import {
  AI_SHARE_BUS,
  AI_SHARE_LIST_KEYS,
  AI_SHARE_LIST_MAX_PAGE,
  UNKNOWN_BU,
  aiShareBounds,
  bucketText,
  detailAverage,
  detailBreakdown,
  detailBuSeries,
  detailPeak,
  previousBounds,
  calledOf,
  defaultAiShareWindow,
  detailBuckets,
  detailSegments,
  detailTable,
  drillWindow,
  isAiShareListKey,
  isBalanced,
  parseAiShareWindow,
  parseListPage,
  roundToHundred,
  rowsInRange,
  segmentTotals,
  topKeys,
  segmentsOfTotal,
  sharesOfCalled,
  type AiShareDetailRow,
} from '../../src/lib/homeAiShare.js';

const ROOT = path.resolve(__dirname, '../..');
const NOW = new Date('2026-09-30T05:00:00Z'); // 12:00 น. เวลาไทย

describe('ช่วงวันที่บนปฏิทิน — ค่าตั้งต้น 7 วันล่าสุด (เจ้าของเปลี่ยนจาก 30 วัน รอบ 3)', () => {
  it('ค่าตั้งต้น = 7 วันรวมวันนี้ (ปฏิทินกรุงเทพ)', () => {
    expect(defaultAiShareWindow(NOW)).toEqual({ from: '2026-09-24', to: '2026-09-30' });
    // 23:30 น. UTC ของวันที่ 30 = 06:30 น. วันที่ 1 ต.ค. เวลาไทย
    expect(defaultAiShareWindow(new Date('2026-09-30T23:30:00Z'))).toEqual({ from: '2026-09-25', to: '2026-10-01' });
  });

  it('อ่านจาก query: วันที่อ่านไม่ออก = ไม่มีขอบฝั่งนั้น · ไม่ส่งทั้งคู่ = ทั้งหมด · กลับหัว = สลับให้', () => {
    expect(parseAiShareWindow({ from: '2026-09-01', to: '2026-09-30' })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(parseAiShareWindow({})).toEqual({ from: null, to: null });
    expect(parseAiShareWindow({ from: '2026-13-40', to: 'x' })).toEqual({ from: null, to: null });
    expect(parseAiShareWindow({ from: '2026-09-30', to: '2026-09-01' })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('ขอบเวลา: เริ่มเที่ยงคืนไทยของวันแรก · จบไม่เกินตอนนี้', () => {
    const b = aiShareBounds({ from: '2026-09-01', to: '2026-09-30' }, NOW);
    expect(b.start?.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(b.end.toISOString()).toBe(NOW.toISOString());
  });

  it('ช่วงในอดีต = จบเที่ยงคืนไทยหลังวันสุดท้าย · ทั้งหมด = ไม่มีจุดเริ่ม', () => {
    expect(aiShareBounds({ from: '2026-09-01', to: '2026-09-10' }, NOW).end.toISOString()).toBe('2026-09-10T17:00:00.000Z');
    const all = aiShareBounds({ from: null, to: null }, NOW);
    expect(all.start).toBeNull();
    expect(all.end.toISOString()).toBe(NOW.toISOString());
  });
});

describe('% รวมกันได้ 100 พอดี (เจ้าของเลือก "รวมกันได้ 100% พอดี")', () => {
  it.each([
    [[79, 0, 0, 15]],
    [[1, 1, 1]],
    [[541, 0, 2]],
    [[79, 4, 0, 18]],
    [[3, 3, 3, 3, 3, 3, 1]],
  ])('%j', (values) => {
    expect(roundToHundred(values).reduce((s, v) => s + v, 0)).toBe(100);
  });

  it('เศษเท่ากัน = ผลคงที่ (ตัวแรกได้เศษ)', () => {
    expect(roundToHundred([1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('ไม่มีอะไรเลย = 0 ทุกตัว ไม่ใช่ NaN', () => {
    expect(roundToHundred([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('เลขตัวใหญ่ = AI ÷ ที่โทรแล้ว', () => {
  it('เลขจริง 30 ก.ย. (30 วัน): ผู้สมัคร 94 ใบ AI 79 · คน 0 · ยังไม่โทร 15 ⇒ AI 100%', () => {
    const c = { total: 94, ai: 79, staff: 0, both: 0, notCalled: 15 };
    expect(isBalanced(c)).toBe(true);
    expect(calledOf(c)).toBe(79);
    expect(sharesOfCalled(c)).toEqual({ ai: 100, staff: 0, both: 0 });
  });

  it('เลขจริง (ทั้งหมด): AI 79 · คน 4 ⇒ AI 95% · คน 5% (รวม 100)', () => {
    expect(sharesOfCalled({ total: 101, ai: 79, staff: 4, both: 0, notCalled: 18 })).toEqual({ ai: 95, staff: 5, both: 0 });
  });

  it('🔴 ยังไม่มีงานที่โทรแล้ว = ไม่มี % (ห้ามขึ้น 0% ให้ดูเหมือนคนทำหมด)', () => {
    expect(sharesOfCalled({ total: 5, ai: 0, staff: 0, both: 0, notCalled: 5 })).toBeNull();
  });

  it('แถบ/ป้ายเรียง AI → คน → ทั้งสองทาง → ยังไม่โทร (ตามภาพที่เลือก) · % รวม 100', () => {
    const seg = segmentsOfTotal({ total: 101, ai: 79, staff: 4, both: 0, notCalled: 18 });
    expect(seg.map((s) => s.key)).toEqual(['ai', 'staff', 'both', 'notCalled']);
    expect(seg.map((s) => s.value)).toEqual([79, 4, 0, 18]);
    expect(seg.reduce((s, x) => s + x.pct, 0)).toBe(100);
  });
});

describe('ผู้สมัคร: "โทรแล้ว" = หลักฐานชุดเดียวกับกล่องงาน แยกแค่ใครโทร', () => {
  const ai = ['appQueue', 'phoneQueue'] as const;
  const staff = ['holdApp', 'contactLog', 'phoneHold'] as const;

  it('ทุกชิ้นหลักฐานอยู่ใน CALLED_SQL ของกล่องงาน', () => {
    for (const piece of Object.values(CALLED_EVIDENCE)) expect(CALLED_SQL).toContain(piece);
  });

  it('ฝั่ง AI = ผลจากคิว Lumos เท่านั้น', () => {
    for (const k of ai) expect(CALLED_BY_AI_SQL).toContain(CALLED_EVIDENCE[k]);
    for (const k of staff) expect(CALLED_BY_AI_SQL).not.toContain(CALLED_EVIDENCE[k]);
  });

  it('ฝั่งคน = ผลที่เจ้าหน้าที่บันทึกเท่านั้น', () => {
    for (const k of staff) expect(CALLED_BY_STAFF_SQL).toContain(CALLED_EVIDENCE[k]);
    for (const k of ai) expect(CALLED_BY_STAFF_SQL).not.toContain(CALLED_EVIDENCE[k]);
  });

  it('คิวรีใช้สองกองนั้น · ไม่นับ Lead · กดเบอร์อย่างเดียวไม่นับ · ช่วงปลายเปิด', () => {
    const sql = buildApplicantAiShareSql();
    expect(sql).toContain(CALLED_BY_AI_SQL);
    expect(sql).toContain(CALLED_BY_STAFF_SQL);
    expect(sql).toContain('not coalesce(a.is_lead, false)');
    expect(sql).toContain('a.created_at < $2::timestamptz');
    expect(sql).not.toContain('dialed_first_at');
    expect(sql).not.toMatch(/\ba\.status\b/);
  });
});

describe('ติดตาม / ดูแลหลังเริ่มงาน: แถวตารางเดียวกัน แยกด้วยหัวข้อ', () => {
  it('เงื่อนไขต่อคิวตรงกับ listFollow ทุกข้อ', () => {
    const src = fs.readFileSync(path.join(ROOT, 'api/_handlers/follow.ts'), 'utf8');
    expect(src).toContain("q.channel = 'reminder'");
    expect(src).toContain("q.job_ref = 'follow'");
    expect(src).toContain("q.person_ref = 'follow-' || f.id::text");
    expect(FOLLOW_QUEUE_MATCH).toBe(
      "q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text",
    );
  });

  it('🔴 สองก้อนแยกกันด้วยหัวข้อตัวเดียว (ไม่นับซ้ำ) — ติดตาม = ไม่ใช่หัวข้อหลังเริ่มงาน', () => {
    expect(buildFollowAiShareSql(true, 'follow')).toContain('f.topic is distinct from $4::text');
    expect(buildFollowAiShareSql(true, 'aftercare')).toContain('f.topic = $4::text');
  });

  it('ไม่นับที่ยกเลิก · นับรอบที่ถึงวันแล้ว · อ่านผลด้วย coalesce (ห้าม result is null)', () => {
    const sql = buildFollowAiShareSql(true, 'follow');
    expect(sql).toContain('f.cancelled_at is null');
    expect(sql).toContain('f.scheduled_at < $2::timestamptz');
    expect(sql).toContain("coalesce(q.last_outcome, q.result->>'outcome')");
    expect(sql).not.toMatch(/result\s+is\s+null/);
  });

  it('ฐานมีช่องลงผลแล้ว = นับคนโทรจากเวลาที่ลงผล · ยังไม่รัน 130 = ไม่อ้างคอลัมน์ใหม่เลย', () => {
    expect(buildFollowAiShareSql(true, 'aftercare')).toContain('f.staff_called_at is not null');
    const sql = buildFollowAiShareSql(false, 'aftercare');
    expect(sql).not.toContain('staff_called_at');
    expect(sql).toContain('false as staff');
  });
});

describe('จับคู่งาน: คิวเลน match + รับไปโทรเองของหน้านั้น', () => {
  it('เงื่อนไขคิวตรงกับ queueLane() = match', () => {
    expect(queueLane('card-1', 'siamraj-sql:LAO6909001')).toBe('match');
    expect(queueLane('ir-9', 'siamraj-sql:LAO6909001')).toBe('match');
    expect(MATCH_QUEUE_WHERE).toContain("q.person_ref like 'card-%'");
    expect(MATCH_QUEUE_WHERE).toContain("q.person_ref like 'ir-%'");
    expect(MATCH_QUEUE_WHERE).toContain("<> 'follow'");
  });

  it('🔴 hold ของใบสมัครไม่อยู่ก้อนนี้ (นับอยู่ก้อนผู้สมัครแล้ว)', () => {
    expect(MATCH_HOLD_WHERE).toBe("h.source in ('board', 'irecruit')");
    expect(MATCH_HOLD_WHERE).not.toContain('application');
  });

  it('ต่อสองแหล่งด้วยเบอร์ + ใบขอ · ไม่นับสายที่ยกเลิก · คนโทร = hold ที่ลงผล', () => {
    const sql = buildMatchingAiShareSql();
    expect(sql).toContain('group by person, job');
    expect(sql).toContain("coalesce(q.status = 'cancelled' or");
    expect(sql).toContain('(h.result_outcome is not null) as staff_done');
    expect(sql).toContain('count(*) filter (where ai and staff)::int');
  });
});

describe('เส้น /api/home-ai-share', () => {
  it('บัญชีที่ยังไม่ผูกแผนก = บอกเหตุทุกก้อน ไม่ขึ้น 0 ปลอม', async () => {
    const body = await buildHomeAiShare({ from: '2026-09-01', to: '2026-09-30' }, { mode: 'none' }, null, NOW);
    for (const k of ['follow', 'aftercare', 'applicants', 'matching'] as const) {
      expect(body[k]).toBeNull();
      expect(body.errors[k]).toMatch(/ผูกแผนก/);
    }
    expect(body.from).toBe('2026-09-01');
    expect(body.to).toBe('2026-09-30');
  });

  it('ลงทะเบียนเส้นแล้ว', () => {
    const reg = fs.readFileSync(path.join(ROOT, 'api/_handlers/registry.ts'), 'utf8');
    expect(reg).toContain("'/api/home-ai-share': homeAiShareHandler");
  });
});

describe('รายชื่อหลังเลขในกล่อง (รอบ 17 · "Visual พอกดแล้วเด้ง Popup แสดงรายชื่อมา")', () => {
  const opts = { key: 'ai' as const, limit: 20, offset: 40 };
  const pairs = () => [
    [buildFollowAiShareSql(true, 'follow'), buildFollowAiShareSql(true, 'follow', 'list', opts)],
    [buildFollowAiShareSql(false, 'aftercare'), buildFollowAiShareSql(false, 'aftercare', 'list', opts)],
    [buildApplicantAiShareSql(), buildApplicantAiShareSql('list', opts)],
    [buildMatchingAiShareSql(), buildMatchingAiShareSql('list', opts)],
  ];
  /** บรรทัดของ CTE (ก่อน select ท้ายสุด) */
  const cteLines = (sql: string) =>
    sql
      .slice(0, sql.lastIndexOf('\n  select '))
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

  it('🔴 รายชื่อใช้ CTE ตัวเดียวกับตัวนับทุกบรรทัด ⇒ จำนวนชื่อ = เลขในกล่อง', () => {
    for (const [count, list] of pairs()) {
      for (const line of cteLines(count)) expect(list).toContain(line);
    }
  });

  it('🔴 เงื่อนไขของแต่ละก้อนเป็นตัวเดียวกันทั้งตัวนับและรายชื่อ · 4 ก้อนไม่ทับกัน', () => {
    for (const [count] of pairs()) {
      for (const k of ['ai', 'staff', 'both', 'notCalled'] as const) {
        expect(count).toContain(`count(*) filter (where ${SEGMENT_WHERE[k]})::int`);
      }
    }
    for (const k of AI_SHARE_LIST_KEYS) {
      expect(buildApplicantAiShareSql('list', { key: k, limit: 20, offset: 0 })).toContain(`where ${SEGMENT_WHERE[k]}\n`);
    }
    // ทุกแถวตกก้อนเดียวพอดี (ai/staff เป็น boolean ครบ 4 แบบ)
    const truth = [
      [true, false, 'ai'],
      [false, true, 'staff'],
      [true, true, 'both'],
      [false, false, 'notCalled'],
    ] as const;
    /** เงื่อนไขเป็นรูป "x and not y" ล้วน — ประเมินเองได้โดยไม่ต้องมีฐาน */
    const evalWhere = (w: string, v: Record<'ai' | 'staff', boolean>) =>
      w.split(' and ').every((t) => (t.startsWith('not ') ? !v[t.slice(4) as 'ai' | 'staff'] : v[t as 'ai' | 'staff']));
    for (const [ai, staff, want] of truth) {
      const hits = (['ai', 'staff', 'both', 'notCalled'] as const).filter((k) => evalWhere(SEGMENT_WHERE[k], { ai, staff }));
      expect(hits).toEqual([want]);
    }
  });

  it('ใหม่สุดก่อน · หน้าละตามที่ขอ · นับทั้งก้อนมาด้วย · โหมดนับไม่แตะ (ไม่มีชื่อในคิวรีนับ)', () => {
    for (const [count, list] of pairs()) {
      expect(list).toContain('order by at desc, id desc');
      expect(list).toContain('limit 20 offset 40');
      expect(list).toContain('count(*) over ()::int as total_rows');
      expect(count).not.toContain(' as name');
      expect(count).not.toContain('total_rows');
    }
    expect(buildFollowAiShareSql(true, 'follow', 'list', opts)).toContain("nullif(btrim(f.recipient_name), '') as name");
    expect(buildApplicantAiShareSql('list', opts)).toContain("nullif(btrim(a.full_name), '') as name");
  });

  it('🔴 จับคู่งาน: กุญแจแถวเป็นค่าแฮช ไม่ส่งเบอร์ออก · ชื่อมาจาก payload ของคิว (นิยามเดียวกับ queuePayloadName) หรือชื่อบน hold', () => {
    const sql = buildMatchingAiShareSql('list', opts);
    expect(sql).toContain("md5(coalesce(person, '') || '|' || coalesce(job, '')) as id");
    expect(sql).toContain(`${queuePayloadNameSql('q')} as name`);
    expect(sql).toContain("nullif(btrim(h.candidate_name), '') as name");
    const out = sql.slice(sql.lastIndexOf('\n  select '));
    expect(out).not.toMatch(/person|phone/);
  });

  it('ชื่อในคิวแบบ SQL ใช้คีย์ชุดเดียวกับ queuePayloadName (ลำดับเดียวกัน)', () => {
    expect(queuePayloadNameSql('q')).toBe(
      "coalesce(nullif(btrim(q.payload->>'recipient_name'), ''), nullif(btrim(q.payload->>'candidate_name'), ''), nullif(btrim(q.payload->>'full_name'), ''))",
    );
    expect(queuePayloadName({ candidate_name: ' สมหญิง ', full_name: 'อื่น' })).toBe('สมหญิง');
  });

  it('🔴 ตัวเลขที่ฝังลง SQL ต้องเป็นจำนวนเต็มในช่วง · ก้อนที่ไม่รู้จัก/ไม่ส่งหน้ามา = โยนทิ้ง', () => {
    expect(() => buildApplicantAiShareSql('list', { key: 'ai', limit: 0, offset: 0 })).toThrow();
    expect(() => buildApplicantAiShareSql('list', { key: 'ai', limit: 20.5, offset: 0 })).toThrow();
    expect(() => buildApplicantAiShareSql('list', { key: 'ai', limit: 20, offset: -1 })).toThrow();
    expect(() => buildApplicantAiShareSql('list', { key: 'x; drop' as never, limit: 20, offset: 0 })).toThrow();
    expect(() => buildApplicantAiShareSql('list')).toThrow();
  });

  it('อ่านกล่อง/เลขหน้าจาก query', () => {
    expect(AI_SHARE_LIST_KEYS).toEqual(['total', 'ai', 'staff', 'both', 'notCalled']);
    expect(isAiShareListKey('notCalled')).toBe(true);
    expect(isAiShareListKey('everyone')).toBe(false);
    expect(parseListPage('3')).toBe(3);
    expect(parseListPage(undefined)).toBe(0);
    expect(parseListPage('-2')).toBe(0);
    expect(parseListPage('1.5')).toBe(0);
    expect(parseListPage('999999999')).toBe(AI_SHARE_LIST_MAX_PAGE);
  });

  it('🔴 สิทธิ์เท่าหน้าต้นทาง — ทรัพยากรตรงกับที่หน้านั้นใช้จริง', () => {
    const rbacOf = (file: string) =>
      /withRbac\(handler, '([^']+)'\)/.exec(fs.readFileSync(path.join(ROOT, 'api/_handlers', file), 'utf8'))?.[1];
    expect(LIST_RESOURCE.follow).toBe(rbacOf('follow.ts'));
    expect(LIST_RESOURCE.aftercare).toBe(rbacOf('aftercare.ts'));
    expect(LIST_RESOURCE.applicants).toBe(rbacOf('job-applications.ts'));
    expect(LIST_RESOURCE.matching).toBe(rbacOf('matching-call-holds.ts'));
    expect(canListAiShare('staff', 'follow')).toBe(true);
  });

  it('บัญชีที่ยังไม่ผูกแผนก = บอกเหตุ ไม่มีรายชื่อ', async () => {
    const l = await buildAiShareList('follow', 'total', 0, { from: '2026-09-24', to: '2026-09-30' }, { mode: 'none' }, null, NOW);
    expect(l.rows).toBeNull();
    expect(l.total).toBe(0);
    expect(l.error).toMatch(/ผูกแผนก/);
    expect(l.page_size).toBe(20);
  });
});

describe('กราฟยอดใช้งาน + แผงเลื่อนแยก BU (รอบ 3 → รอบ 5)', () => {
  const row = (day: string, bu: string | null, total: number, ai = total): AiShareDetailRow => ({
    day,
    bu,
    total,
    ai,
    staff: 0,
    both: 0,
    notCalled: total - ai,
  });

  it('หนึ่งแท่งต่อวันตลอดช่วง — เดือน = วันที่ 1–30 · สัปดาห์ = 7 วัน · รวมวันที่ยังไม่ถึง', () => {
    expect(detailBuckets({ from: '2026-09-01', to: '2026-09-30' }, [], '2026-09-30').buckets).toHaveLength(30);
    const week = detailBuckets({ from: '2026-09-28', to: '2026-10-04' }, [], '2026-09-30');
    expect(week.grain).toBe('day');
    expect(week.buckets.map((b) => b.key)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
  });

  it('ทั้งหมด = เริ่มวันแรกที่มีข้อมูล · ยาวเกิน 62 วัน = รายเดือน (รอบ 5: "ยอดใช้งานของแต่ละวัน แต่ละเดือน")', () => {
    const all = detailBuckets({ from: null, to: null }, [row('2026-09-20', 'LBD', 1)], '2026-09-30');
    expect(all.buckets[0].key).toBe('2026-09-20');
    expect(all.buckets).toHaveLength(11);
    const long = detailBuckets({ from: '2026-01-01', to: '2026-06-30' }, [], '2026-09-30');
    expect(long.grain).toBe('month');
    expect(long.buckets[0].from).toBe('2026-01-01');
    expect(long.buckets.at(-1)?.to).toBe('2026-06-30');
  });

  it('🔴 รอบ 17: แกนล่างไม่มี "ก.ย." — รายวันเหลือเลขวัน · รายเดือนเหลือชื่อเดือน (ปีต่อท้ายเฉพาะช่วงคร่อมปี)', () => {
    const week = detailBuckets({ from: '2026-08-28', to: '2026-09-03' }, [], '2026-09-30');
    expect(week.buckets.map((b) => b.label)).toEqual(['28', '29', '30', '31', '1', '2', '3']);
    const long = detailBuckets({ from: '2026-01-01', to: '2026-06-30' }, [], '2026-09-30');
    expect(long.buckets.map((b) => b.label)).toEqual(['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.']);
    const cross = detailBuckets({ from: '2025-11-01', to: '2026-02-28' }, [], '2026-09-30');
    expect(cross.buckets.map((b) => b.label)).toEqual(['พ.ย. 68', 'ธ.ค. 68', 'ม.ค. 69', 'ก.พ. 69']);
  });

  it('🔴 รอบ 18: เลือกหลายหน่วย = หนึ่งแท่งต่อหน่วย (ยอดรวม) · หน่วยเดียว = แท่งย่อยข้างในเหมือนเดิม', () => {
    const months = detailBuckets({ from: '2026-08-01', to: '2026-09-30', unit: 'month' }, [], '2026-09-30');
    expect(months.grain).toBe('month');
    expect(months.buckets.map((b) => [b.label, b.from, b.to])).toEqual([
      ['ส.ค.', '2026-08-01', '2026-08-31'],
      ['ก.ย.', '2026-09-01', '2026-09-30'],
    ]);
    // ไม่ใส่หน่วย (ช่วงวันธรรมดา 61 วัน) = ยังเป็นรายวัน
    expect(detailBuckets({ from: '2026-08-01', to: '2026-09-30' }, [], '2026-09-30').grain).toBe('day');
    // เดือนเดียว = วันที่ 1–30
    expect(detailBuckets({ from: '2026-09-01', to: '2026-09-30', unit: 'month' }, [], '2026-09-30').buckets).toHaveLength(30);
    const weeks = detailBuckets({ from: '2026-09-14', to: '2026-10-04', unit: 'week' }, [], '2026-09-30');
    expect(weeks.grain).toBe('week');
    expect(weeks.buckets.map((b) => b.label)).toEqual(['14–20', '21–27', '28–4']);
    expect(detailBuckets({ from: '2026-09-28', to: '2026-10-04', unit: 'week' }, [], '2026-09-30').grain).toBe('day');
    const years = detailBuckets({ from: '2025-01-01', to: '2026-12-31', unit: 'year' }, [], '2026-09-30');
    expect(years.grain).toBe('year');
    expect(years.buckets.map((b) => b.label)).toEqual(['2568', '2569']);
    // ปีเดียว = รายเดือน 12 แท่ง
    const oneYear = detailBuckets({ from: '2026-01-01', to: '2026-12-31', unit: 'year' }, [], '2026-09-30');
    expect([oneYear.grain, oneYear.buckets.length]).toEqual(['month', 12]);
  });

  it('🔴 รอบ 18: ยอดของแท่งหน่วยใหญ่ = ผลรวมของวันในหน่วยนั้น (แถวชุดเดียวกัน)', () => {
    const rows = [row('2026-08-05', 'LBD', 3), row('2026-09-01', 'LBD', 2), row('2026-09-30', 'LBA', 4, 1)];
    const { buckets } = detailBuckets({ from: '2026-08-01', to: '2026-09-30', unit: 'month' }, rows, '2026-09-30');
    const segs = detailSegments(rows, buckets);
    expect(segmentTotals(segs, buckets.length)).toEqual([3, 6]);
    expect(segs.notCalled).toEqual([0, 3]);
  });

  it('รอบ 18: กดแท่งหน่วยใหญ่ = ลงไปดูข้างใน · แท่งรายวันไม่มีข้างใน', () => {
    const sep = { key: '2026-09-01', label: 'ก.ย.', from: '2026-09-01', to: '2026-09-30' };
    expect(drillWindow(sep, 'month')).toEqual({ from: '2026-09-01', to: '2026-09-30', unit: 'day' });
    expect(drillWindow({ key: '2026-09-14', label: '14–20', from: '2026-09-14', to: '2026-09-20' }, 'week')).toEqual({
      from: '2026-09-14',
      to: '2026-09-20',
      unit: 'day',
    });
    const y = { key: '2025-01-01', label: '2568', from: '2025-01-01', to: '2025-12-31' };
    expect(drillWindow(y, 'year')).toEqual({ from: '2025-01-01', to: '2025-12-31', unit: 'month' });
    // ลงไปในปี = รายเดือน 12 แท่ง · ลงไปในเดือน = รายวัน
    expect(detailBuckets(drillWindow(y, 'year')!, [], '2026-09-30').buckets).toHaveLength(12);
    expect(detailBuckets(drillWindow(sep, 'month')!, [], '2026-09-30').grain).toBe('day');
    expect(drillWindow({ key: '2026-09-30', label: '30', from: '2026-09-30', to: '2026-09-30' }, 'day')).toBeNull();
  });

  it('รายเดือน: เดือนแรก/สุดท้ายตัดขอบให้อยู่ในช่วงจริง · ไม่ข้ามเดือน ไม่ทับกัน', () => {
    const { buckets, grain } = detailBuckets({ from: '2026-01-15', to: '2026-04-10' }, [], '2026-09-30');
    expect(grain).toBe('month');
    expect(buckets.map((b) => [b.from, b.to])).toEqual([
      ['2026-01-15', '2026-01-31'],
      ['2026-02-01', '2026-02-28'],
      ['2026-03-01', '2026-03-31'],
      ['2026-04-01', '2026-04-10'],
    ]);
    // 62 วันพอดียังเป็นรายวัน · 63 วันเป็นรายเดือน
    expect(detailBuckets({ from: '2026-08-01', to: '2026-10-01' }, [], '2026-09-30').grain).toBe('day');
    expect(detailBuckets({ from: '2026-08-01', to: '2026-10-02' }, [], '2026-09-30').grain).toBe('month');
  });

  it('แท่งซ้อน 4 ก้อนต่อช่วงย่อย · ความสูงทั้งแท่ง = ยอดใช้งาน · รวมทุกแท่ง = ยอดของการ์ด', () => {
    const rows: AiShareDetailRow[] = [
      { day: '2026-09-29', bu: 'LBD', total: 5, ai: 3, staff: 1, both: 0, notCalled: 1 },
      { day: '2026-09-30', bu: 'LBD', total: 2, ai: 2, staff: 0, both: 0, notCalled: 0 },
      { day: '2026-09-30', bu: null, total: 4, ai: 1, staff: 0, both: 2, notCalled: 1 },
    ];
    const { buckets } = detailBuckets({ from: '2026-09-29', to: '2026-10-01' }, rows, '2026-09-30');
    const segs = detailSegments(rows, buckets);
    expect(segs).toEqual({ ai: [3, 3, 0], staff: [1, 0, 0], both: [0, 2, 0], notCalled: [1, 1, 0] });
    const totals = segmentTotals(segs, buckets.length);
    expect(totals).toEqual([5, 6, 0]);
    expect(totals.reduce((s, v) => s + v, 0)).toBe(detailTable(rows).total.total);
  });

  it('สวิตช์ "แยก BU" (รอบ 7 → 17): ครบทุก BU ของบริษัทเสมอ · ลำดับชุดแผนก → รหัสอื่น → ไม่รู้ BU · รวมทุก BU = ยอดของแท่ง', () => {
    const rows: AiShareDetailRow[] = [
      { day: '2026-09-29', bu: 'LBA', total: 2, ai: 2, staff: 0, both: 0, notCalled: 0 },
      { day: '2026-09-29', bu: 'LBD', total: 3, ai: 1, staff: 1, both: 0, notCalled: 1 },
      { day: '2026-09-30', bu: 'HQ', total: 1, ai: 1, staff: 0, both: 0, notCalled: 0 },
      { day: '2026-09-30', bu: null, total: 4, ai: 1, staff: 0, both: 2, notCalled: 1 },
      { day: '2026-09-30', bu: 'LM', total: 0, ai: 0, staff: 0, both: 0, notCalled: 0 },
    ];
    const { buckets } = detailBuckets({ from: '2026-09-29', to: '2026-10-01' }, rows, '2026-09-30');
    const series = detailBuSeries(rows, buckets);
    // รอบ 17: "ทำสีของทุก BU อธิบายรอไว้เลย" ⇒ BU ที่ยังไม่มีงานก็อยู่ (ค่าเป็น 0) · รหัสอื่น/ไม่รู้ BU ขึ้นเมื่อมีงานจริง
    expect(series.map((x) => x.bu)).toEqual([...AI_SHARE_BUS, 'HQ', UNKNOWN_BU]);
    expect(series.find((x) => x.bu === 'LM')?.values).toEqual([0, 0, 0]);
    expect(series.find((x) => x.bu === 'LBD')?.values).toEqual([3, 0, 0]);
    expect(series.find((x) => x.bu === UNKNOWN_BU)?.values).toEqual([0, 4, 0]);
    const perBar = buckets.map((_, i) => series.reduce((s, x) => s + x.values[i], 0));
    expect(perBar).toEqual(segmentTotals(detailSegments(rows, buckets), buckets.length));
  });

  it('บัญชีที่ถูกล็อก BU: ป้ายสีขึ้นแค่ BU ของตัวเอง (ไม่ขึ้น BU ที่ดูไม่ได้)', () => {
    const rows: AiShareDetailRow[] = [{ day: '2026-09-30', bu: 'LM', total: 2, ai: 2, staff: 0, both: 0, notCalled: 0 }];
    const { buckets } = detailBuckets({ from: '2026-09-30', to: '2026-09-30' }, rows, '2026-09-30');
    expect(detailBuSeries(rows, buckets, ['LM']).map((x) => x.bu)).toEqual(['LM']);
    expect(detailBuSeries([], buckets, ['LM'])).toEqual([{ bu: 'LM', label: expect.any(String), values: [0] }]);
  });

  it('🔴 รหัส BU นอกชุดแผนกต้องไม่หายจากตาราง/แผงเลื่อน — รวมทุกแถว = ยอดทั้งหมด', () => {
    const rows = [row('2026-09-30', 'LBD', 3), row('2026-09-30', 'HQ', 2)];
    const t = detailTable(rows);
    expect(t.rows.map((r) => r.bu)).toEqual([...AI_SHARE_BUS, 'HQ']);
    expect(t.rows.reduce((s, r) => s + r.total, 0)).toBe(t.total.total);
    expect(detailBreakdown(rows).used.map((r) => r.bu)).toEqual(['LBD', 'HQ']);
  });

  it('กราฟเปรียบเทียบในแผงเลื่อน (รอบ 13): แท่งสูงสุด · เท่ากันติดทุกแท่ง · ทุกตัว 0 = ไม่มี', () => {
    expect(topKeys([{ key: 'ai', value: 52 }, { key: 'staff', value: 3 }, { key: 'notCalled', value: 0 }])).toEqual(['ai']);
    expect(topKeys([{ key: 'LBD', value: 4 }, { key: 'LBA', value: 4 }, { key: 'LM', value: 1 }])).toEqual(['LBD', 'LBA']);
    expect(topKeys([{ key: 'ai', value: 0 }, { key: 'staff', value: 0 }])).toEqual([]);
    expect(topKeys([])).toEqual([]);
  });

  it('กดแท่ง = แถวของช่วงนั้นเท่านั้น · ทั้งช่วง = ทุกแถว', () => {
    const rows = [row('2026-09-28', 'LBD', 1), row('2026-09-29', 'LBA', 2), row('2026-09-30', 'LBD', 3)];
    expect(rowsInRange(rows, '2026-09-29', '2026-09-29').map((r) => r.total)).toEqual([2]);
    expect(rowsInRange(rows, '2026-09-28', '2026-09-30')).toHaveLength(3);
    expect(rowsInRange(rows, '2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('แผงเลื่อน: BU ที่มีงานเรียงมากไปน้อย · BU ที่ยังไม่มีงานบอกเป็นบรรทัดเดียว · รวม = ยอดของแท่ง', () => {
    const rows: AiShareDetailRow[] = [
      { day: '2026-09-30', bu: 'LBA', total: 3, ai: 3, staff: 0, both: 0, notCalled: 0 },
      { day: '2026-09-30', bu: 'LBD', total: 8, ai: 5, staff: 2, both: 0, notCalled: 1 },
      { day: '2026-09-30', bu: 'LM', total: 3, ai: 0, staff: 3, both: 0, notCalled: 0 },
      { day: '2026-09-30', bu: null, total: 1, ai: 1, staff: 0, both: 0, notCalled: 0 },
    ];
    const b = detailBreakdown(rows);
    // เท่ากัน (LBA 3 · LM 3) = ตามลำดับ BU เดิมของบริษัท
    expect(b.used.map((r) => r.bu)).toEqual(['LBD', 'LBA', 'LM', UNKNOWN_BU]);
    expect(b.used[0]).toMatchObject({ total: 8, ai: 5, staff: 2, notCalled: 1 });
    expect(b.quiet).toEqual(AI_SHARE_BUS.filter((x) => !['LBD', 'LBA', 'LM'].includes(x)));
    expect(b.total).toEqual({ total: 15, ai: 9, staff: 5, both: 0, notCalled: 1 });
    expect(b.used.reduce((s, r) => s + r.total, 0)).toBe(b.total.total);
  });

  it('ชื่อช่วงย่อยแบบคนอ่าน — รายวันบอกวัน · รายเดือนเต็มบอกชื่อเดือน · เดือนที่ถูกตัดบอกช่วงวันจริง', () => {
    const day = { key: '2026-09-30', label: '30 ก.ย.', from: '2026-09-30', to: '2026-09-30' };
    expect(bucketText(day, 'day')).toBe('พ. 30 ก.ย.');
    expect(bucketText(day, 'day', 'long')).toBe('วันพุธ 30 ก.ย.');
    expect(bucketText({ key: '2026-09-01', label: 'ก.ย. 69', from: '2026-09-01', to: '2026-09-30' }, 'month')).toBe('กันยายน 2569');
    expect(bucketText({ key: '2026-01-01', label: 'ม.ค. 69', from: '2026-01-15', to: '2026-01-31' }, 'month')).toBe('15–31 ม.ค. 2569');
    // รอบ 18: รายสัปดาห์ = ช่วงวันจริง · รายปี = "ปี 2569"
    const wk = { key: '2026-09-14', label: '14–20', from: '2026-09-14', to: '2026-09-20' };
    expect(bucketText(wk, 'week')).toBe('14–20 ก.ย. 2569');
    expect(bucketText(wk, 'week', 'long')).toBe('สัปดาห์ 14–20 ก.ย. 2569');
    expect(bucketText({ key: '2026-01-01', label: '2569', from: '2026-01-01', to: '2026-12-31' }, 'year')).toBe('ปี 2569');
  });

  it('ตาราง BU ครบทุกตัว · แถวรวม = ผลรวม (เท่ายอดบนการ์ด)', () => {
    const rows = [row('2026-09-29', 'LBD', 3, 2), row('2026-09-30', 'LBA', 2, 2)];
    const t = detailTable(rows);
    expect(t.rows.map((r) => r.bu)).toEqual([...AI_SHARE_BUS]);
    expect(t.rows.find((r) => r.bu === 'LBD')).toMatchObject({ total: 3, ai: 2, notCalled: 1 });
    expect(t.total).toEqual({ total: 5, ai: 4, staff: 0, both: 0, notCalled: 1 });
  });

  it('SQL แยกวัน × BU ใช้ CTE ตัวเดียวกับยอดของการ์ด', () => {
    for (const sql of [
      buildFollowAiShareSql(true, 'follow', 'byDayBu'),
      buildApplicantAiShareSql('byDayBu'),
      buildMatchingAiShareSql('byDayBu'),
    ]) {
      expect(sql).toContain('group by day, bu');
      expect(sql).toContain("to_char(timezone('Asia/Bangkok'");
    }
    expect(buildFollowAiShareSql(true, 'follow')).not.toContain('group by day, bu');
    // คู่คน-ใบขอของจับคู่งานนับวันเดียว BU เดียว = งานแรกในช่วง
    expect(buildMatchingAiShareSql('byDayBu')).toContain('(array_agg(bu order by at))[1] as bu');
  });

  it('เส้น ?detail= : บัญชีไม่ผูกแผนก = บอกเหตุ', async () => {
    const d = await buildAiShareDetail('follow', { from: '2026-09-24', to: '2026-09-30' }, { mode: 'none' }, null, NOW);
    expect(d.rows).toBeNull();
    expect(d.error).toMatch(/ผูกแผนก/);
  });
});

describe('เทียบกับช่วงก่อน (รอบ 4) — ยาวเท่ากัน ณ จุดเดียวกันของช่วง', () => {
  it('7 วันล่าสุด → 7 วันก่อนหน้า จบที่เวลาเดียวกันเมื่อ 7 วันก่อน', () => {
    const p = previousBounds({ from: '2026-09-24', to: '2026-09-30' }, NOW);
    expect(p?.label).toBe('7 วันก่อนหน้า');
    expect(p?.from).toBe('2026-09-17');
    expect(p?.to).toBe('2026-09-23');
    expect(p?.end.toISOString()).toBe('2026-09-23T05:00:00.000Z');
  });

  it('สัปดาห์นี้ (ยังไม่จบ) → สัปดาห์ก่อนถึงจุดเดียวกัน ไม่เอาทั้งสัปดาห์มาเทียบ', () => {
    const p = previousBounds({ from: '2026-09-28', to: '2026-10-04' }, NOW);
    expect(p?.label).toBe('สัปดาห์ก่อน');
    expect(p?.start.toISOString()).toBe('2026-09-20T17:00:00.000Z');
    expect(p?.end.toISOString()).toBe('2026-09-23T05:00:00.000Z');
  });

  it('ทั้งเดือน → เดือนก่อนตั้งแต่วันที่ 1 เท่าเวลาที่ผ่านไป (ไม่ล้นเข้าเดือนนี้)', () => {
    const p = previousBounds({ from: '2026-09-01', to: '2026-09-30' }, NOW);
    expect(p?.label).toBe('เดือนก่อน');
    expect(p?.from).toBe('2026-08-01');
    expect(p?.end.getTime()).toBeLessThanOrEqual(new Date('2026-09-01T00:00:00+07:00').getTime());
  });

  it('รอบ 17 ทั้งปี → ปีก่อนตั้งแต่ 1 ม.ค. เท่าเวลาที่ผ่านไป (ไม่ล้นเข้าปีนี้)', () => {
    const p = previousBounds({ from: '2026-01-01', to: '2026-12-31' }, NOW);
    expect(p?.label).toBe('ปีก่อน');
    expect(p?.from).toBe('2025-01-01');
    expect(p?.to).toBe('2025-09-30');
    expect(p?.end.toISOString()).toBe('2025-09-30T05:00:00.000Z');
  });

  it('รอบ 18 หลายเดือน/ปี/สัปดาห์ → ถอยไปเท่าจำนวนหน่วยตามปฏิทิน', () => {
    const m = previousBounds({ from: '2026-08-01', to: '2026-09-30' }, NOW);
    expect(m?.label).toBe('2 เดือนก่อนหน้า');
    expect(m?.from).toBe('2026-06-01');
    expect(m?.end.getTime()).toBeLessThanOrEqual(new Date('2026-08-01T00:00:00+07:00').getTime());
    const y = previousBounds({ from: '2025-01-01', to: '2026-12-31' }, NOW);
    expect(y?.label).toBe('2 ปีก่อนหน้า');
    expect(y?.from).toBe('2023-01-01');
    const w = previousBounds({ from: '2026-09-14', to: '2026-10-04' }, NOW);
    expect(w?.label).toBe('3 สัปดาห์ก่อนหน้า');
    expect(w?.from).toBe('2026-08-24');
    // ข้ามปีตอนถอยเดือน
    expect(previousBounds({ from: '2026-01-01', to: '2026-02-28' }, NOW)?.from).toBe('2025-11-01');
  });

  it('วันนี้ → เมื่อวาน · ทั้งหมด → ไม่เทียบ', () => {
    expect(previousBounds({ from: '2026-09-30', to: '2026-09-30' }, NOW)?.label).toBe('เมื่อวาน');
    expect(previousBounds({ from: '2026-09-20', to: '2026-09-20' }, NOW)?.label).toBe('วันก่อนหน้า');
    expect(previousBounds({ from: null, to: null }, NOW)).toBeNull();
  });
});

describe('วันที่มากสุด + เส้นเฉลี่ย (รอบ 4)', () => {
  const buckets = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'].map((d) => ({ key: d, label: d, from: d, to: d }));
  const segments = { ai: [3, 5, 1, 0], staff: [0, 1, 0, 0], both: [0, 0, 0, 0], notCalled: [0, 0, 0, 0] };

  it('รวม 4 ก้อนต่อวัน · มากสุด = วันที่รวมสูงสุด', () => {
    const totals = segmentTotals(segments, buckets.length);
    expect(totals).toEqual([3, 6, 1, 0]);
    expect(detailPeak(buckets, totals)).toEqual({ bucket: buckets[1], value: 6 });
    expect(detailPeak(buckets, [0, 0, 0, 0])).toBeNull();
  });

  it('เฉลี่ยหารเฉพาะวันที่ถึงแล้ว (วันที่ยังไม่ถึงไม่ทำให้ค่าเฉลี่ยต่ำหลอก)', () => {
    expect(detailAverage(buckets, [3, 6, 1, 0], '2026-09-30')).toBeCloseTo(10 / 3);
    expect(detailAverage(buckets, [3, 6, 1, 0], '2026-09-27')).toBeNull();
  });
});
