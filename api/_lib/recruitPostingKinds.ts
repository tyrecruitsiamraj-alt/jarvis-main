/**
 * ═══ ประเภทกล่องลอย — master ที่แก้จากหน้า "ตั้งค่าบอร์ด" (เจ้าของสั่ง 14 ต.ค. 2569) ═══
 * ตาราง `recruit_posting_kinds` (144) · ยังไม่ migrate = ใช้ชุดเดิมในโค้ด (`STANDALONE_POSTING_KINDS`) อ่านอย่างเดียว
 * ปิดใช้งานแทนการลบ (ประกาศเก่าอ้างรหัสอยู่) · รหัสสร้างเองตอนเพิ่ม ห้ามเปลี่ยน · แก้ได้แค่ชื่อ/เปิด-ปิด
 */
import { randomBytes } from 'node:crypto';
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { STANDALONE_POSTING_KINDS, type RecruitPostingKind } from '../../src/lib/recruitPostings.js';

const kindsTable = tableInAppSchema('recruit_posting_kinds');
const MAX_LABEL = 80;

type KindRow = { code: string; label: string; sort_order: number; is_active: boolean };

const map = (r: KindRow): RecruitPostingKind => ({
  code: r.code,
  label: r.label,
  sortOrder: Number(r.sort_order) || 0,
  isActive: !!r.is_active,
});

const FALLBACK: RecruitPostingKind[] = STANDALONE_POSTING_KINDS.map((k, i) => ({
  code: k.code,
  label: k.label,
  sortOrder: (i + 1) * 10,
  isActive: true,
}));

function cleanLabel(v: unknown): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  if (!s) throw new Error('ต้องระบุชื่อประเภทกล่อง');
  return s.slice(0, MAX_LABEL);
}

export async function listRecruitPostingKinds(opts: { includeInactive?: boolean } = {}): Promise<RecruitPostingKind[]> {
  try {
    const { rows } = await dbQuery<KindRow>(
      `select code, label, sort_order, is_active from ${kindsTable}
        ${opts.includeInactive ? '' : 'where is_active = true'}
        order by sort_order, created_at`,
    );
    return rows.map(map);
  } catch (e) {
    if (isPgUndefinedTable(e)) return FALLBACK;
    throw e;
  }
}

/** รหัสนี้เป็นประเภทที่เปิดใช้อยู่ไหม — ใช้ตอนสร้างประกาศลอย */
export async function isActivePostingKind(code: unknown): Promise<boolean> {
  if (typeof code !== 'string' || !code.trim()) return false;
  const kinds = await listRecruitPostingKinds();
  return kinds.some((k) => k.code === code.trim());
}

export async function createRecruitPostingKind(input: { label: unknown }, actor: string | null): Promise<RecruitPostingKind> {
  const label = cleanLabel(input.label);
  const existing = await listRecruitPostingKinds({ includeInactive: true });
  if (existing.some((k) => k.label === label)) throw new Error(`มีประเภทกล่องชื่อ "${label}" อยู่แล้ว`);
  const code = `k_${randomBytes(4).toString('hex')}`;
  const sort = existing.reduce((m, k) => Math.max(m, k.sortOrder), 0) + 10;
  const { rows } = await dbQuery<KindRow>(
    `insert into ${kindsTable} (code, label, sort_order, updated_by_name) values ($1, $2, $3, $4)
     returning code, label, sort_order, is_active`,
    [code, label, sort, actor],
  );
  return map(rows[0]);
}

export async function updateRecruitPostingKind(
  code: string,
  patch: { label?: unknown; isActive?: unknown },
  actor: string | null,
): Promise<RecruitPostingKind | null> {
  const sets: string[] = [];
  const params: unknown[] = [code];
  if (patch.label !== undefined) {
    const label = cleanLabel(patch.label);
    const existing = await listRecruitPostingKinds({ includeInactive: true });
    if (existing.some((k) => k.label === label && k.code !== code)) throw new Error(`มีประเภทกล่องชื่อ "${label}" อยู่แล้ว`);
    params.push(label);
    sets.push(`label = $${params.length}`);
  }
  if (typeof patch.isActive === 'boolean') {
    params.push(patch.isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (sets.length === 0) throw new Error('ไม่มีอะไรให้แก้');
  params.push(actor);
  const { rows } = await dbQuery<KindRow>(
    `update ${kindsTable} set ${sets.join(', ')}, updated_at = now(), updated_by_name = $${params.length}
      where code = $1 returning code, label, sort_order, is_active`,
    params,
  );
  return rows[0] ? map(rows[0]) : null;
}
