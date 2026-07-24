import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError } from './logger.js';
import type { BoardMatchResult } from './boardCandidateMatcher.js';

const table = tableInAppSchema('board_match_results');

export type StoredBoardMatch = {
  jobId: string;
  result: BoardMatchResult;
  computedAt: string;
};

function toIso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

/** เก็บผลแมทลง DB (write-through) — พังแล้วไม่ล้มงานหลัก แค่ log */
export async function saveBoardMatchResult(jobId: string, result: BoardMatchResult): Promise<void> {
  try {
    await dbQuery(
      `insert into ${table} (job_id, request_no, result, computed_at)
       values ($1, $2, $3::jsonb, now())
       on conflict (job_id) do update
         set request_no = excluded.request_no, result = excluded.result, computed_at = excluded.computed_at`,
      [jobId, result.request_no ?? null, JSON.stringify(result)],
    );
  } catch (e) {
    logError('board-match.store.fail', { jobId, message: e instanceof Error ? e.message : String(e) });
  }
}

/** อ่านผลที่เก็บไว้ของใบเดียว — null เมื่อไม่เคยคิด/ตารางยังไม่ migrate */
export async function getStoredBoardMatch(jobId: string): Promise<StoredBoardMatch | null> {
  try {
    const { rows } = await dbQuery<{ job_id: string; result: BoardMatchResult; computed_at: string | Date }>(
      `select job_id, result, computed_at from ${table} where job_id = $1 limit 1`,
      [jobId],
    );
    const r = rows[0];
    if (!r || typeof r.result !== 'object') return null;
    return { jobId: r.job_id, result: r.result, computedAt: toIso(r.computed_at) };
  } catch {
    return null;
  }
}

export type BoardMatchTierEntry = {
  /** tier ต่อคน + card_id (ใช้กรอง "คนที่ยังพร้อม" ตอนนับป้าย/workflow filter บนลิสต์) */
  tiers: Array<{ tier: 'green' | 'yellow' | 'red'; cardId: number }>;
  computedAt: string;
};

/** อ่านผลทั้งหมดแบบเบา (tier + card_id ต่อคน + เวลาคิด) สำหรับ workflow filter/ป้ายบนลิสต์ */
export async function loadBoardMatchTierMap(): Promise<Map<string, BoardMatchTierEntry>> {
  const map = new Map<string, BoardMatchTierEntry>();
  try {
    const { rows } = await dbQuery<{ job_id: string; tiers: unknown; computed_at: string | Date }>(
      `select job_id, computed_at,
              coalesce((select jsonb_agg(jsonb_build_object('tier', m->>'tier', 'card_id', m->>'card_id'))
                        from jsonb_array_elements(result->'matches') m), '[]'::jsonb) as tiers
       from ${table}`,
    );
    for (const r of rows) {
      if (!Array.isArray(r.tiers)) continue;
      map.set(r.job_id, {
        computedAt: toIso(r.computed_at),
        tiers: (r.tiers as Array<{ tier?: string; card_id?: string }>).map((t) => ({
          tier: t?.tier === 'green' || t?.tier === 'red' ? t.tier : 'yellow',
          cardId: Number(String(t?.card_id ?? '').replace(/[^0-9]/g, '')) || 0,
        })),
      });
    }
  } catch (e) {
    logError('board-match.tiers.fail', { message: e instanceof Error ? e.message : String(e) });
  }
  return map;
}
