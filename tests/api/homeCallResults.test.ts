// @vitest-environment node
/**
 * ═══ แผง "ผลโทร" ของหน้าหลัก (รอบ 18 · 30 ก.ย. 2569) ═══
 * เจ้าของ: *"กราฟที่บอกว่าการโทรเนี่ยโทรไปแล้วผลเป็นไง โทรแล้วไป รับแล้ววาง รับแล้วไม่ไปไรงี้ … ซ่อนไว้ เอามาก่อนใครอยู่ในระบบ"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. งานที่นับ = CTE ตัวเดียวกับกล่องตัวเลข (ทุกบรรทัดของ CTE เดิมอยู่ครบ) — ไม่มีขอบเขตใหม่
 * 2. ฝั่ง AI ของผู้สมัคร = หลักฐานชุดเดียวกับ `CALLED_BY_AI_SQL` (คิวของใบ + คิวบนเบอร์หลังกรอกใบ) · ฝั่งคน = hold ที่มีรหัสผล
 * 3. ป้ายถัง = พจนานุกรมเมตริก `lumos.result.*` · ติดตามถามว่า "ไปไหม" · ที่เหลือถามว่า "สนใจไหม"
 * 4. % รวมกันได้ 100 พอดี · แผงเป็นตัวนับล้วน (ไม่มีชื่อ/เบอร์ในคำตอบ)
 */
import { describe, expect, it } from 'vitest';
import {
  LATEST_AI_RESULT_LATERAL,
  LATEST_STAFF_RESULT_LATERAL,
} from '../../api/_lib/applicantOverviewSql.js';
import {
  buildApplicantAiShareSql,
  buildFollowAiShareSql,
  buildMatchingAiShareSql,
} from '../../api/_lib/homeAiShareSql.js';
import { buildAiShareResults } from '../../api/_handlers/home-ai-share.js';
import { classifyCallMicro, FOLLOW_VOCAB } from '../../src/lib/callMicroOutcome.js';
import { METRICS } from '../../src/lib/metricDictionary.js';
import {
  CALL_RESULT_ORDER,
  callResultLabel,
  callResultRows,
  emptyCallResultCounts,
  tallyCallResults,
  vocabOfBlock,
  type CallResultSourceRow,
} from '../../src/lib/homeCallResults.js';

const NOW = new Date('2026-09-30T05:00:00Z');

/** บรรทัดของ CTE (ก่อน select ท้ายสุด) */
const cteLines = (sql: string) =>
  sql
    .slice(0, sql.lastIndexOf('\n  select '))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

describe('SQL โหมดผลโทร — ขอบเขตเดียวกับกล่องตัวเลข', () => {
  const pairs = () => [
    [buildFollowAiShareSql(true, 'follow'), buildFollowAiShareSql(true, 'follow', 'results')],
    [buildFollowAiShareSql(false, 'aftercare'), buildFollowAiShareSql(false, 'aftercare', 'results')],
    [buildApplicantAiShareSql(), buildApplicantAiShareSql('results')],
    [buildMatchingAiShareSql(), buildMatchingAiShareSql('results')],
  ];

  it('🔴 ทุกบรรทัดของ CTE ตัวนับอยู่ครบในโหมดผลโทร · ท้ายคิวรีเอาเฉพาะงานที่มีผล', () => {
    for (const [count, results] of pairs()) {
      for (const line of cteLines(count)) expect(results).toContain(line);
      expect(results).toContain('select ai_outcome, ai_summary, ai_reply, ai_at, staff_outcome, staff_at');
      expect(results).toContain('where ai_outcome is not null or staff_outcome is not null');
      // โหมดนับไม่แตะ
      expect(count).not.toContain('ai_outcome');
    }
  });

  it('ติดตาม: ผล AI = คิวของรอบนั้น (ไม่นับยกเลิก) · ผลคน = ช่องลงผล 130 (ยังไม่รัน 130 = ไม่อ้างคอลัมน์ใหม่)', () => {
    const sql = buildFollowAiShareSql(true, 'follow', 'results');
    expect(sql).toContain("q.person_ref = 'follow-' || f.id::text");
    expect(sql).toContain("<> 'cancelled'");
    expect(sql).toContain('f.staff_call_outcome');
    expect(buildFollowAiShareSql(false, 'follow', 'results')).not.toContain('staff_call');
  });

  it('🔴 ผู้สมัคร: ผล AI = หลักฐานชุดเดียวกับ "AI โทรแล้ว" (คิวของใบ + เบอร์เดียวกันหลังกรอกใบ) · ผลคน = hold ที่มีรหัสผล', () => {
    const sql = buildApplicantAiShareSql('results');
    expect(sql).toContain(LATEST_AI_RESULT_LATERAL);
    expect(sql).toContain(LATEST_STAFF_RESULT_LATERAL);
    expect(LATEST_AI_RESULT_LATERAL).toContain("q.person_ref = 'app-' || a.id::text");
    expect(LATEST_AI_RESULT_LATERAL).toContain('>= a.created_at');
    expect(LATEST_STAFF_RESULT_LATERAL).toContain("h.source = 'application' and h.candidate_ref = a.id::text");
    expect(LATEST_STAFF_RESULT_LATERAL).toContain('h.result_outcome is not null');
  });

  it('จับคู่งาน: ผลล่าสุดต่อคู่ (เบอร์ + ใบขอ) แยกฝั่ง AI (คิว) กับคน (hold) · ไม่ส่งเบอร์ออก', () => {
    const sql = buildMatchingAiShareSql('results');
    expect(sql).toContain('filter (where ai_done))[1] as ai_outcome');
    expect(sql).toContain('filter (where staff_done))[1] as staff_outcome');
    expect(sql.slice(sql.lastIndexOf('\n  select '))).not.toMatch(/person|phone/);
  });
});

describe('ถังผลและป้าย', () => {
  it('ติดตาม/ดูแลหลังเริ่มงานถาม "ไปไหม" · ผู้สมัคร/จับคู่งานถาม "สนใจไหม"', () => {
    expect(vocabOfBlock('follow')).toBe('follow');
    expect(vocabOfBlock('aftercare')).toBe('follow');
    expect(vocabOfBlock('applicants')).toBe('interest');
    expect(vocabOfBlock('matching')).toBe('interest');
  });

  it('🔴 ป้ายมาจากพจนานุกรมเมตริก — "รับแล้ววาง" ของเจ้าของ = ถัง "รับแล้วเงียบ"', () => {
    expect(callResultLabel('follow', 'said_yes')).toBe(METRICS['lumos.result.went'].label);
    expect(callResultLabel('follow', 'said_no')).toBe(METRICS['lumos.result.not_went'].label);
    expect(callResultLabel('interest', 'said_yes')).toBe(METRICS['lumos.result.interested'].label);
    expect(callResultLabel('follow', 'picked_silent')).toBe('รับแล้วเงียบ');
  });

  it('ลำดับบนจอตามที่เจ้าของไล่: โทรแล้วไป → รับแล้ววาง → รับแล้วไม่ไป → ที่เหลือ · ครบทุกถัง', () => {
    expect(CALL_RESULT_ORDER.slice(0, 3)).toEqual(['said_yes', 'picked_silent', 'said_no']);
    expect([...CALL_RESULT_ORDER].sort()).toEqual(Object.keys(emptyCallResultCounts()).sort());
  });

  it('แถวของแผง: รวม AI + คน · % รวมกันได้ 100 · ทั้งหมด 0 = ทุกแถว 0%', () => {
    const ai = { ...emptyCallResultCounts(), said_yes: 153, no_pickup: 15, talked_unclear: 33, picked_silent: 1, said_no: 3, not_yet: 2 };
    const staff = { ...emptyCallResultCounts(), said_yes: 4, no_pickup: 1 };
    const t = callResultRows({ vocab: 'follow', ai, staff });
    expect(t.total).toBe(212);
    expect(t.rows[0]).toMatchObject({ key: 'said_yes', label: 'บอกว่าไป', ai: 153, staff: 4, total: 157 });
    expect(t.rows.reduce((s, r) => s + r.pct, 0)).toBe(100);
    const empty = callResultRows({ vocab: 'interest', ai: emptyCallResultCounts(), staff: emptyCallResultCounts() });
    expect(empty.total).toBe(0);
    expect(empty.rows.every((r) => r.pct === 0)).toBe(true);
  });

  it('ผลของคนมีแต่รหัส — ตัดสินจากรหัสได้ทุกค่าที่ลงได้ ไม่ตกถังเดา', () => {
    for (const [code, want] of [
      ['confirmed', 'said_yes'],
      ['declined', 'said_no'],
      ['reschedule_requested', 'said_no'],
      ['no_answer', 'no_pickup'],
      ['wrong_person', 'wrong_person'],
    ] as const) {
      expect(classifyCallMicro({ outcome: code, summary: null, reply: null }, FOLLOW_VOCAB)).toBe(want);
    }
  });
});

describe('🔴 หนึ่งรายชื่อ = หนึ่งผล (รอบ 18 · เจ้าของ: "เรานับจากรายชื่อ ต้องเป็นรายชื่อหมดเลย")', () => {
  const row = (over: Partial<CallResultSourceRow>): CallResultSourceRow => ({
    ai_outcome: null,
    ai_summary: null,
    ai_reply: null,
    ai_at: null,
    staff_outcome: null,
    staff_at: null,
    ...over,
  });

  it('รายชื่อที่ทั้ง AI และคนโทร = นับครั้งเดียว ตามฝั่งที่โทรทีหลัง', () => {
    const rows = [
      // AI ไม่รับสายก่อน แล้วคนโทรต่อได้ว่าไป ⇒ นับที่คน "บอกว่าไป"
      row({ ai_outcome: 'no_answer', ai_at: '2026-09-29T02:00:00Z', staff_outcome: 'confirmed', staff_at: '2026-09-29T05:00:00Z' }),
      // คนโทรก่อน แล้ว AI โทรทีหลัง ⇒ นับที่ AI
      row({ ai_outcome: 'confirmed', ai_at: new Date('2026-09-30T05:00:00Z'), staff_outcome: 'declined', staff_at: new Date('2026-09-29T05:00:00Z') }),
      // เวลาเท่ากัน = คน
      row({ ai_outcome: 'no_answer', ai_at: '2026-09-30T01:00:00Z', staff_outcome: 'declined', staff_at: '2026-09-30T01:00:00Z' }),
    ];
    const { ai, staff } = tallyCallResults(rows, 'follow');
    const sum = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
    expect(sum(ai) + sum(staff)).toBe(rows.length);
    expect(staff.said_yes).toBe(1);
    expect(ai.said_yes).toBe(1);
    expect(staff.said_no).toBe(1);
    expect(ai.no_pickup).toBe(0);
  });

  it('ฝั่งเดียว = นับฝั่งนั้น · AI อ่านคำพูดได้ (รหัสไม่ชี้ขาด) · ไม่มีเวลาก็ยังนับ', () => {
    const { ai, staff } = tallyCallResults(
      [
        row({ ai_outcome: 'acknowledged', ai_summary: 'ผู้รับสายยืนยันว่าจะไปทำงานตามนัด', ai_at: null }),
        row({ staff_outcome: 'no_answer' }),
      ],
      'follow',
    );
    expect(ai.said_yes).toBe(1);
    expect(staff.no_pickup).toBe(1);
  });
});

describe('เส้น ?results=', () => {
  it('บัญชีที่ยังไม่ผูกแผนก = บอกเหตุ เลขเป็น 0 ทั้งหมด (ตัวนับล้วน ไม่มีชื่อ)', async () => {
    const r = await buildAiShareResults('follow', { from: '2026-09-24', to: '2026-09-30' }, { mode: 'none' }, null, NOW);
    expect(r.error).toMatch(/ผูกแผนก/);
    expect(r.vocab).toBe('follow');
    expect(Object.values(r.ai).every((v) => v === 0)).toBe(true);
    expect(Object.keys(r)).not.toContain('rows');
  });
});
