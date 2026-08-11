import { randomBytes } from 'node:crypto';

import { dbQuery, isPgUniqueViolation } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import {
  isStandalonePostingKind,
  validatePostingInput,
  type RecruitChannel,
  type RecruitChannelMatch,
  type RecruitPosting,
  type RecruitPostingLink,
} from '../../src/lib/recruitPostings.js';
import { isRmFormType, isRmSpecificType } from '../../src/lib/recruitRmMasters.js';

const channelsTable = tableInAppSchema('recruit_channels');
const postingsTable = tableInAppSchema('recruit_postings');
const linksTable = tableInAppSchema('recruit_posting_links');
const applicationsTable = tableInAppSchema('public_job_applications');

const MAX_TEXT = 200;
const MAX_LONG_TEXT = 4000;

function trimTo(value: unknown, max: number): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  return s.slice(0, max);
}

/** โค้ดลิงก์ — ตัวอักษรที่อ่าน/พิมพ์ตามไม่สับสน (ตัด 0/O/1/I/l ออก) */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function makeLinkCode(length = 7): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// ── ช่องทาง ───────────────────────────────────────────────────────────

type ChannelRow = {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
};

function mapChannel(r: ChannelRow): RecruitChannel {
  return {
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    sortOrder: Number(r.sort_order) || 0,
    isActive: !!r.is_active,
  };
}

/** คืนช่องทางเป็นทรี 2 ระดับ (หลัก → รอง) */
export async function listRecruitChannels(includeInactive = false): Promise<RecruitChannel[]> {
  const { rows } = await dbQuery<ChannelRow>(
    `SELECT id, parent_id, name, sort_order, is_active
       FROM ${channelsTable}
      ${includeInactive ? '' : 'WHERE is_active = true'}
      ORDER BY sort_order, lower(name)`,
  );
  const all = rows.map(mapChannel);
  const parents = all.filter((c) => !c.parentId);
  const byParent = new Map<string, RecruitChannel[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  return parents.map((p) => ({ ...p, children: byParent.get(p.id) ?? [] }));
}

/**
 * ช่องทางหลักอย่างเดียว + จำนวนลูก — ใช้ตอนกางตัวจัดการช่องทาง
 * ⚠️ ทรีเต็มมี 4,390 แถวหลังยกของจากระบบเดิม ส่งทั้งก้อนทุกครั้งที่เปิด dialog ไม่ไหว
 */
export async function listRecruitChannelRoots(includeInactive = false): Promise<RecruitChannel[]> {
  const { rows } = await dbQuery<ChannelRow & { child_count: string }>(
    `SELECT c.id, c.parent_id, c.name, c.sort_order, c.is_active,
            (SELECT count(*) FROM ${channelsTable} k
              WHERE k.parent_id = c.id ${includeInactive ? '' : 'AND k.is_active = true'}) AS child_count
       FROM ${channelsTable} c
      WHERE c.parent_id IS NULL ${includeInactive ? '' : 'AND c.is_active = true'}
      ORDER BY c.sort_order, lower(c.name)`,
  );
  return rows.map((r) => ({ ...mapChannel(r), childCount: Number(r.child_count) || 0 }));
}

/** เพดานผลลัพธ์ต่อครั้ง — พ่อบางตัวมีลูก 4,187 ตัว ส่งหมดไม่ไหว */
export const RECRUIT_CHANNEL_PAGE_MAX = 200;

function clampLimit(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), RECRUIT_CHANNEL_PAGE_MAX);
}

/** ช่องทางรองของพ่อหนึ่งตัว แบ่งหน้า — คืน total ด้วยเพื่อให้หน้าเว็บบอกได้ว่าเหลืออีกกี่ตัว */
export async function listRecruitChannelChildren(
  parentId: string,
  options: { includeInactive?: boolean; limit?: number; offset?: number; q?: string } = {},
): Promise<{ items: RecruitChannel[]; total: number }> {
  const includeInactive = !!options.includeInactive;
  const limit = clampLimit(options.limit, 50);
  const offset = Math.max(0, Math.trunc(Number(options.offset) || 0));
  const q = trimTo(options.q, MAX_TEXT);
  const params: unknown[] = [parentId];
  let where = 'parent_id = $1';
  if (!includeInactive) where += ' AND is_active = true';
  if (q) {
    params.push(`%${q}%`);
    where += ` AND name ILIKE $${params.length}`;
  }
  const totalRes = await dbQuery<{ n: string }>(
    `SELECT count(*) AS n FROM ${channelsTable} WHERE ${where}`,
    params,
  );
  // ⚠️ อย่า push ทับ params ตัวเดิม — คิวรีนับใช้อยู่ ต่อท้ายแล้วจะอ่านย้อนหลังไม่ตรง
  const pageParams = [...params, limit, offset];
  const { rows } = await dbQuery<ChannelRow>(
    `SELECT id, parent_id, name, sort_order, is_active
       FROM ${channelsTable}
      WHERE ${where}
      ORDER BY sort_order, lower(name)
      LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );
  return { items: rows.map(mapChannel), total: Number(totalRes.rows[0]?.n) || 0 };
}

type MatchRow = ChannelRow & { parent_name: string | null };

/**
 * ค้นหาช่องทางด้วยข้อความ — ค้นทั้งชื่อลูกและชื่อพ่อ
 * ค้นชื่อพ่อด้วยเพราะคนพิมพ์ "Facebook" แล้วคาดว่าจะเจอกลุ่มทั้งหมดใต้ Facebook Group
 */
export async function searchRecruitChannels(
  q: string,
  options: { includeInactive?: boolean; limit?: number } = {},
): Promise<RecruitChannelMatch[]> {
  const term = trimTo(q, MAX_TEXT);
  if (!term) return [];
  const includeInactive = !!options.includeInactive;
  const limit = clampLimit(options.limit, 50);
  const activeFilter = includeInactive ? '' : 'AND c.is_active = true';
  const { rows } = await dbQuery<MatchRow>(
    `SELECT c.id, c.parent_id, c.name, c.sort_order, c.is_active, p.name AS parent_name
       FROM ${channelsTable} c
       LEFT JOIN ${channelsTable} p ON p.id = c.parent_id
      WHERE (c.name ILIKE $1 OR p.name ILIKE $1) ${activeFilter}
      ORDER BY (c.name ILIKE $1) DESC, lower(coalesce(p.name, '')), c.sort_order, lower(c.name)
      LIMIT $2`,
    [`%${term}%`, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    parentName: r.parent_name,
    isActive: !!r.is_active,
  }));
}

export async function createRecruitChannel(input: {
  parentId?: string | null;
  name: string;
  sortOrder?: number;
}): Promise<RecruitChannel> {
  const name = trimTo(input.name, MAX_TEXT);
  if (!name) throw new Error('ต้องระบุชื่อช่องทาง');
  const parentId = trimTo(input.parentId, 64);
  if (parentId) {
    // กันทำช่องทางรองซ้อนรอง — รองรับแค่ 2 ระดับตามที่ตกลงไว้
    const { rows } = await dbQuery<{ parent_id: string | null }>(
      `SELECT parent_id FROM ${channelsTable} WHERE id = $1`,
      [parentId],
    );
    if (rows.length === 0) throw new Error('ไม่พบช่องทางหลักที่อ้างถึง');
    if (rows[0].parent_id) throw new Error('ช่องทางรองซ้อนช่องทางรองไม่ได้');
  }
  try {
    const { rows } = await dbQuery<ChannelRow>(
      `INSERT INTO ${channelsTable} (parent_id, name, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, parent_id, name, sort_order, is_active`,
      [parentId, name, Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 100],
    );
    return mapChannel(rows[0]);
  } catch (e) {
    if (isPgUniqueViolation(e)) throw new Error('มีช่องทางชื่อนี้อยู่แล้ว');
    throw e;
  }
}

export async function updateRecruitChannel(
  id: string,
  patch: { name?: string; sortOrder?: number; isActive?: boolean },
): Promise<RecruitChannel | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const name = patch.name === undefined ? null : trimTo(patch.name, MAX_TEXT);
  if (patch.name !== undefined) {
    if (!name) throw new Error('ชื่อช่องทางว่างไม่ได้');
    params.push(name);
    sets.push(`name = $${params.length}`);
  }
  if (patch.sortOrder !== undefined) {
    params.push(Number(patch.sortOrder) || 0);
    sets.push(`sort_order = $${params.length}`);
  }
  if (patch.isActive !== undefined) {
    params.push(!!patch.isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (sets.length === 0) return null;
  params.push(id);
  try {
    const { rows } = await dbQuery<ChannelRow>(
      `UPDATE ${channelsTable} SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${params.length}
        RETURNING id, parent_id, name, sort_order, is_active`,
      params,
    );
    return rows[0] ? mapChannel(rows[0]) : null;
  } catch (e) {
    if (isPgUniqueViolation(e)) throw new Error('มีช่องทางชื่อนี้อยู่แล้ว');
    throw e;
  }
}

/** ลบช่องทาง — ลิงก์ที่เคยสร้างไว้ยังใช้ได้ (channel_id เป็น null แต่ channel_label ยังอยู่) */
export async function deleteRecruitChannel(id: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `DELETE FROM ${channelsTable} WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

// ── ประกาศ ────────────────────────────────────────────────────────────

type PostingRow = {
  id: string;
  job_id: string | null;
  standalone_kind: string | null;
  department_code: string | null;
  title: string;
  detail: string | null;
  location_text: string | null;
  salary_text: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  position_name: string | null;
  province: string | null;
  responsible_name: string | null;
  specific_type: string | null;
  form_type: string | null;
  status: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  application_count?: string | number | null;
};

type LinkRow = {
  id: string;
  posting_id: string;
  channel_id: string | null;
  channel_label: string | null;
  code: string;
  note: string | null;
  hit_count: number;
  created_at: string;
  application_count?: string | number | null;
};

function mapLink(r: LinkRow): RecruitPostingLink {
  return {
    id: r.id,
    channelId: r.channel_id,
    channelLabel: r.channel_label,
    code: r.code,
    note: r.note,
    hitCount: Number(r.hit_count) || 0,
    createdAt: r.created_at,
    applicationCount: r.application_count == null ? undefined : Number(r.application_count) || 0,
  };
}

function mapPosting(r: PostingRow, links: RecruitPostingLink[]): RecruitPosting {
  return {
    id: r.id,
    jobId: r.job_id,
    standaloneKind: isStandalonePostingKind(r.standalone_kind) ? r.standalone_kind : null,
    departmentCode: r.department_code,
    title: r.title,
    detail: r.detail,
    locationText: r.location_text,
    salaryText: r.salary_text,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    positionName: r.position_name ?? null,
    province: r.province ?? null,
    responsibleName: r.responsible_name ?? null,
    specificType: r.specific_type ?? null,
    // ประกาศเก่าที่สร้างก่อน migration 074 อ่านเป็น "ทั่วไป" ตามพฤติกรรมเดิม
    formType: isRmFormType(r.form_type) ? r.form_type : 'rm',
    status: r.status === 'closed' ? 'closed' : 'open',
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    links,
    applicationCount: r.application_count == null ? undefined : Number(r.application_count) || 0,
  };
}

const POSTING_COLUMNS = `p.id, p.job_id, p.standalone_kind, p.department_code, p.title, p.detail,
  p.location_text, p.salary_text, p.contact_name, p.contact_phone,
  p.position_name, p.province, p.responsible_name, p.specific_type, p.form_type, p.status,
  p.created_by_name, p.created_at, p.updated_at,
  (SELECT count(*) FROM ${applicationsTable} a WHERE a.posting_id = p.id) AS application_count`;

/**
 * ชุดคอลัมน์แบบยังไม่ได้รัน migration 074
 * ⚠️ **ห้ามลบจนกว่าทุก environment รัน 074 แล้ว** — ฐาน local ของเจ้าของชี้ production
 * ตัวเดียวกัน โค้ดขึ้นก่อน migration แล้ว select คอลัมน์ที่ยังไม่มี = บอร์ดรับสมัครพังทั้งหน้า
 */
const POSTING_COLUMNS_LEGACY = `p.id, p.job_id, p.standalone_kind, p.department_code, p.title, p.detail,
  p.location_text, p.salary_text, p.contact_name, p.contact_phone,
  null::text AS position_name, null::text AS province, null::text AS responsible_name,
  null::text AS specific_type, null::text AS form_type, p.status,
  p.created_by_name, p.created_at, p.updated_at,
  (SELECT count(*) FROM ${applicationsTable} a WHERE a.posting_id = p.id) AS application_count`;

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 074 */
function isUndefinedColumn(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703'
  );
}

/** ยิงชุดใหม่ก่อน · ยังไม่ migrate ถอยไปชุดเก่า (ฟิลด์ใหม่อ่านเป็น null) */
async function postingQuery(sql: string, params: unknown[] = []): Promise<PostingRow[]> {
  try {
    const { rows } = await dbQuery<PostingRow>(sql.replace(/\{\{cols\}\}/g, POSTING_COLUMNS), params);
    return rows;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    const { rows } = await dbQuery<PostingRow>(
      sql.replace(/\{\{cols\}\}/g, POSTING_COLUMNS_LEGACY),
      params,
    );
    return rows;
  }
}

async function attachLinks(postings: PostingRow[]): Promise<RecruitPosting[]> {
  if (postings.length === 0) return [];
  const ids = postings.map((p) => p.id);
  const { rows } = await dbQuery<LinkRow>(
    `SELECT l.id, l.posting_id, l.channel_id, l.channel_label, l.code, l.note, l.hit_count, l.created_at,
            (SELECT count(*) FROM ${applicationsTable} a WHERE a.link_id = l.id) AS application_count
       FROM ${linksTable} l
      WHERE l.posting_id = ANY($1::uuid[])
      ORDER BY l.created_at`,
    [ids],
  );
  const byPosting = new Map<string, RecruitPostingLink[]>();
  for (const r of rows) {
    const list = byPosting.get(r.posting_id) ?? [];
    list.push(mapLink(r));
    byPosting.set(r.posting_id, list);
  }
  return postings.map((p) => mapPosting(p, byPosting.get(p.id) ?? []));
}

export async function listRecruitPostings(options: {
  jobId?: string | null;
  standaloneOnly?: boolean;
  departmentCodes?: string[] | null;
}): Promise<RecruitPosting[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.jobId) {
    params.push(options.jobId);
    where.push(`p.job_id = $${params.length}`);
  }
  if (options.standaloneOnly) where.push('p.job_id IS NULL');

  // scope ตาม BU: ประกาศลอยกรองด้วย department_code ตรง ๆ
  // ส่วนประกาศที่ผูกใบขอ ตัวกรอง BU ทำที่ชั้นใบขอ (handler ส่ง jobId ที่ scope แล้วมา)
  const depts = (options.departmentCodes ?? []).filter(Boolean);
  if (depts.length > 0) {
    params.push(depts);
    where.push(`(p.job_id IS NOT NULL OR p.department_code = ANY($${params.length}::text[]))`);
  }

  const rows = await postingQuery(
    `SELECT {{cols}}
       FROM ${postingsTable} p
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.created_at DESC
      LIMIT 500`,
    params,
  );
  return attachLinks(rows);
}

export async function getRecruitPosting(id: string): Promise<RecruitPosting | null> {
  const rows = await postingQuery(`SELECT {{cols}} FROM ${postingsTable} p WHERE p.id = $1`, [id]);
  if (rows.length === 0) return null;
  return (await attachLinks(rows))[0] ?? null;
}

/** resolve ลิงก์สาธารณะ — คืนประกาศ + ลิงก์ที่ใช้เข้ามา */
export async function getPostingByLinkCode(
  code: string,
): Promise<{ posting: RecruitPosting; link: RecruitPostingLink } | null> {
  const clean = (code || '').trim().toLowerCase();
  if (!clean) return null;
  const { rows } = await dbQuery<LinkRow>(
    `SELECT id, posting_id, channel_id, channel_label, code, note, hit_count, created_at
       FROM ${linksTable} WHERE lower(code) = $1`,
    [clean],
  );
  if (rows.length === 0) return null;
  const link = rows[0];
  const posting = await getRecruitPosting(link.posting_id);
  if (!posting) return null;
  // นับคลิก — พลาดไม่เป็นไร ไม่ให้ล้มการเปิดหน้า
  void dbQuery(`UPDATE ${linksTable} SET hit_count = hit_count + 1 WHERE id = $1`, [link.id]).catch(
    () => undefined,
  );
  return { posting, link: mapLink(link) };
}

export type CreatePostingInput = {
  jobId?: string | null;
  standaloneKind?: string | null;
  departmentCode?: string | null;
  title: string;
  detail?: string | null;
  locationText?: string | null;
  salaryText?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  positionName?: string | null;
  province?: string | null;
  responsibleName?: string | null;
  responsibleUserId?: string | null;
  specificType?: string | null;
  formType?: string | null;
  /** ช่องทางที่จะสร้างลิงก์ให้ — 1 ช่องทาง = 1 ลิงก์ */
  channels?: Array<{ channelId?: string | null; label?: string | null; note?: string | null }>;
  createdByUserId?: string | null;
  createdByName?: string | null;
};

export async function createRecruitPosting(input: CreatePostingInput): Promise<RecruitPosting> {
  const invalid = validatePostingInput(input);
  if (invalid) throw new Error(invalid);

  const jobId = trimTo(input.jobId, 128);
  let rows: PostingRow[];
  try {
    ({ rows } = await dbQuery<PostingRow>(
      `INSERT INTO ${postingsTable}
       (job_id, standalone_kind, department_code, title, detail, location_text, salary_text,
        contact_name, contact_phone, position_name, province, responsible_name,
        responsible_user_id, specific_type, form_type, created_by_user_id, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id, job_id, standalone_kind, department_code, title, detail, location_text,
               salary_text, contact_name, contact_phone, position_name, province,
               responsible_name, specific_type, form_type, status, created_by_name,
               created_at, updated_at`,
      [
      jobId,
      jobId ? null : trimTo(input.standaloneKind, 64),
      trimTo(input.departmentCode, 32),
      trimTo(input.title, MAX_TEXT),
      trimTo(input.detail, MAX_LONG_TEXT),
      trimTo(input.locationText, MAX_TEXT),
      trimTo(input.salaryText, MAX_TEXT),
      trimTo(input.contactName, MAX_TEXT),
      trimTo(input.contactPhone, 64),
      trimTo(input.positionName, MAX_TEXT),
      trimTo(input.province, 128),
      trimTo(input.responsibleName, MAX_TEXT),
      trimTo(input.responsibleUserId, 64),
      // ⚠️ ข้อมูลเจาะจงรับได้แค่ค่าใน master — ค่าอื่นทิ้งเป็น null ไม่เก็บขยะที่เทียบข้ามระบบไม่ได้
      isRmSpecificType(input.specificType) ? input.specificType : null,
        isRmFormType(input.formType) ? input.formType : 'rm',
        trimTo(input.createdByUserId, 64),
        trimTo(input.createdByName, MAX_TEXT),
      ],
    ));
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    // ⚠️ ยังไม่รัน migration 074 — ยังสร้างประกาศ+ลิงก์ได้ตามเดิม แต่ตำแหน่ง/จังหวัด/
    // ผู้รับผิดชอบ/ข้อมูลเจาะจง/ประเภทฟอร์มยังไม่ถูกเก็บ (อ่านกลับมาเป็น null)
    // เลือกทางนี้เพราะ "ส่งลิงก์ออกไม่ได้เลย" เจ็บกว่า "ลิงก์ออกได้แต่ยังไม่มีข้อมูลเสริม"
    ({ rows } = await dbQuery<PostingRow>(
      `INSERT INTO ${postingsTable}
         (job_id, standalone_kind, department_code, title, detail, location_text, salary_text,
          contact_name, contact_phone, created_by_user_id, created_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, job_id, standalone_kind, department_code, title, detail, location_text,
                 salary_text, contact_name, contact_phone,
                 null::text AS position_name, null::text AS province,
                 null::text AS responsible_name, null::text AS specific_type,
                 null::text AS form_type, status, created_by_name, created_at, updated_at`,
      [
        jobId,
        jobId ? null : trimTo(input.standaloneKind, 64),
        trimTo(input.departmentCode, 32),
        trimTo(input.title, MAX_TEXT),
        trimTo(input.detail, MAX_LONG_TEXT),
        trimTo(input.locationText, MAX_TEXT),
        trimTo(input.salaryText, MAX_TEXT),
        trimTo(input.contactName, MAX_TEXT),
        trimTo(input.contactPhone, 64),
        trimTo(input.createdByUserId, 64),
        trimTo(input.createdByName, MAX_TEXT),
      ],
    ));
  }
  const posting = rows[0];

  const channels = (input.channels ?? []).slice(0, 20);
  // ไม่เลือกช่องทางเลย = ยังได้ 1 ลิงก์กลาง (ไม่ระบุช่องทาง) จะได้ส่งออกได้ทันที
  const wanted = channels.length > 0 ? channels : [{ channelId: null, label: null, note: null }];
  const links: RecruitPostingLink[] = [];
  for (const ch of wanted) {
    links.push(
      await createPostingLink(posting.id, {
        channelId: ch.channelId ?? null,
        label: ch.label ?? null,
        note: ch.note ?? null,
      }),
    );
  }
  return mapPosting(posting, links);
}

export async function createPostingLink(
  postingId: string,
  input: { channelId?: string | null; label?: string | null; note?: string | null },
): Promise<RecruitPostingLink> {
  // โค้ดสุ่มอาจชนกันได้ — ลองใหม่ไม่กี่ครั้งแทนที่จะปล่อยพัง
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { rows } = await dbQuery<LinkRow>(
        `INSERT INTO ${linksTable} (posting_id, channel_id, channel_label, code, note)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, posting_id, channel_id, channel_label, code, note, hit_count, created_at`,
        [
          postingId,
          trimTo(input.channelId, 64),
          trimTo(input.label, MAX_TEXT),
          makeLinkCode(),
          trimTo(input.note, MAX_TEXT),
        ],
      );
      return mapLink(rows[0]);
    } catch (e) {
      if (isPgUniqueViolation(e) && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error('สร้างลิงก์ไม่สำเร็จ');
}

/** ฟิลด์เนื้อหาที่แก้ไขได้ — ดู updateRecruitPosting ว่าทำไมไม่มี jobId/standaloneKind/departmentCode */
export type UpdatePostingPatch = {
  title?: string;
  detail?: string | null;
  locationText?: string | null;
  salaryText?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
};

/** ฟิลด์เนื้อหาที่แก้ไขได้ → คอลัมน์ · ที่เดียวที่ตัดสินว่าอะไรแก้ได้ */
const EDITABLE_POSTING_COLUMNS = {
  title: 'title',
  detail: 'detail',
  locationText: 'location_text',
  salaryText: 'salary_text',
  contactName: 'contact_name',
  contactPhone: 'contact_phone',
} as const satisfies Record<keyof UpdatePostingPatch, string>;

/** ความยาวสูงสุดของแต่ละฟิลด์ — ต้องตรงกับตอน createRecruitPosting */
const POSTING_FIELD_MAX: Record<keyof UpdatePostingPatch, number> = {
  title: MAX_TEXT,
  detail: MAX_LONG_TEXT,
  locationText: MAX_TEXT,
  salaryText: MAX_TEXT,
  contactName: MAX_TEXT,
  contactPhone: 64,
};

/**
 * แก้เนื้อหาประกาศ (mockup rev.3 ข้อ 04 — ปุ่ม "แก้ไข" บนการ์ด)
 *
 * แก้ได้เฉพาะ "เนื้อหาที่ผู้สมัครเห็น" — **jobId / standaloneKind / departmentCode แก้ไม่ได้**
 * เพราะสามตัวนั้นเป็นตัวกำหนดสิทธิ์การมองเห็น (BU scope) ถ้าเปิดให้แก้ จะย้ายประกาศ
 * ข้าม BU ได้ผ่านการ PATCH ทั้งที่ตอนสร้างมีการกันไว้แล้วที่ handler
 * อยากย้าย BU ให้ปิดประกาศเดิมแล้วสร้างใหม่
 *
 * ส่งฟิลด์ไหนมาแก้เฉพาะฟิลด์นั้น (undefined = ไม่แตะ) · title ว่างไม่ได้
 * คืน null เมื่อไม่มีฟิลด์ให้แก้ หรือหา id ไม่เจอ
 */
export async function updateRecruitPosting(
  id: string,
  patch: UpdatePostingPatch,
): Promise<RecruitPosting | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, column] of Object.entries(EDITABLE_POSTING_COLUMNS) as Array<
    [keyof UpdatePostingPatch, string]
  >) {
    const value = patch[key];
    if (value === undefined) continue;
    const cleaned = trimTo(value, POSTING_FIELD_MAX[key]);
    // หัวข้อเป็นชื่อประกาศที่ผู้สมัครเห็น ปล่อยว่างแล้วการ์ดจะไม่มีชื่อ
    if (key === 'title' && !cleaned) throw new Error('ต้องระบุหัวข้อประกาศ');
    params.push(cleaned);
    sets.push(`${column} = $${params.length}`);
  }

  if (sets.length === 0) return null;
  params.push(id);
  const { rows } = await dbQuery<{ id: string }>(
    `UPDATE ${postingsTable} SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $${params.length}
      RETURNING id`,
    params,
  );
  if (rows.length === 0) return null;
  // อ่านกลับผ่าน getRecruitPosting เพื่อให้ได้ links + applicationCount ครบเหมือนเส้นอื่น
  return getRecruitPosting(id);
}

export async function setPostingStatus(id: string, status: 'open' | 'closed'): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `UPDATE ${postingsTable} SET status = $2, updated_at = now() WHERE id = $1 RETURNING id`,
    [id, status],
  );
  return rows.length > 0;
}
