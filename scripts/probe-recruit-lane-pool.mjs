/**
 * ตรวจกองเลนสรรหา 3 แหล่ง (R2b) กับฐานจริง — **อ่านอย่างเดียว ไม่แตะคิว ไม่โทรหาใคร**
 * รัน: npx tsx scripts/probe-recruit-lane-pool.mjs [คีย์เวิร์ด...]
 */
import '../server/bootstrap-env.ts';
import { listRecruitCandidatesByKeywords } from '../api/_lib/recruitRegisterSql.ts';
import { listSoRecruitLeadsForMatch } from '../api/_lib/soRecruitLeadsSql.ts';
import { listBoardReadyCandidates, boardChecklistColumnId } from '../api/_lib/boardCandidatesSql.ts';
import { loadBoardPhoneSet } from '../api/_lib/applicationBoardLink.ts';
import { toE164Thai } from '../api/_lib/thaiPhone.ts';
import {
  countBySource,
  dedupePoolByPhone,
  fromChecklistCard,
  fromIrecruitCandidate,
  fromSoRecruitLead,
} from '../api/_lib/recruitLanePool.ts';
import { dropCandidatesAlreadyOnBoard } from '../api/_lib/recruitLaneMatcher.ts';

const keywords = process.argv.slice(2).length ? process.argv.slice(2) : ['ขับรถ', 'พนักงานขับรถ'];

const safe = async (label, fn) => {
  try {
    return { label, rows: await fn(), error: null };
  } catch (e) {
    return { label, rows: [], error: e instanceof Error ? e.message : String(e) };
  }
};

const [ir, leads, checklist, boardPhones] = await Promise.all([
  safe('iRecruit', () => listRecruitCandidatesByKeywords(keywords, { limit: 800 })),
  safe('ฐานใหม่', () => listSoRecruitLeadsForMatch(800)),
  safe('Checklist', () =>
    listBoardReadyCandidates({ columnIds: [boardChecklistColumnId()], limit: 1500, excludeInformed: true }),
  ),
  loadBoardPhoneSet(true).catch(() => null),
]);

for (const s of [ir, leads, checklist]) {
  console.log(`${s.label}: ${s.rows.length} คน${s.error ? ` ⚠️ ${s.error}` : ''}`);
}
console.log(`เบอร์บนบอร์ดทุกถัง: ${boardPhones ? `${boardPhones.size} เบอร์` : 'อ่านไม่ได้ (null)'}`);

const merged = [
  ...checklist.rows.map(fromChecklistCard),
  ...leads.rows.map(fromSoRecruitLead),
  ...ir.rows.map(fromIrecruitCandidate),
];
const { pool: deduped, droppedDuplicates } = dedupePoolByPhone(merged, toE164Thai);
const { kept, dropped } = dropCandidatesAlreadyOnBoard(deduped, boardPhones, toE164Thai);

console.log(`\nรวมก่อนตัด: ${merged.length}`);
console.log(`ตัดคนซ้ำข้ามแหล่ง: ${droppedDuplicates.length}`);
console.log(`ตัดคนที่ได้ใบสมัครแล้ว (อยู่บอร์ดถังอื่น): ${dropped}`);
console.log(`กองสุดท้าย: ${kept.length}`, countBySource(kept));

const callable = kept.filter((c) => toE164Thai(c.phone_number));
console.log(`เบอร์ที่ AI โทรได้จริง: ${callable.length}/${kept.length}`);
console.log('\nตัวอย่าง 5 คนแรก (ปิดชื่อ):');
for (const c of kept.slice(0, 5)) {
  console.log(`- [${c.source}] ${c.full_name.slice(0, 2)}*** | ${c.position_text || '-'} | ${c.location_label || '-'}`);
}
process.exit(0);
