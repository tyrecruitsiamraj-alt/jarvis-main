/**
 * ═══ ตรวจเลขหัวข้อติดตามบนหน้าหลัก (อ่านอย่างเดียว · เจ้าของ 7 ต.ค. 2569) ═══
 * เจ้าของ: *"ขอ query ก่อน … ทั้งหมดเท่าไหร่ Ai เท่าไหร่ คนเท่าไหร่ ผลแต่ละอัน … ขอมั่นใจว่าบวกลบแล้วเท่ากัน"*
 *
 * ทำ 2 ทางแล้วเทียบกัน:
 *   ก. SQL ดิบ — นับรายชื่อ ทั้งหมด / AI / คน ตรง ๆ จากตาราง (ใครโทร = call_mode เท่านั้น ไม่ต้องอ่านผล)
 *   ข. ตรรกะของหน้าจอ — `loadFollowJourney` (ชุดแถวเดียวกับการ์ด + ช่องของการ์ด `r.bucket` · 10 ต.ค. 2569)
 *   ค. ช่องของป๊อป = ช่องของการ์ด `loadHomeLumosSummary` ทุกช่อง (QA 10 ต.ค. 2569 เคยไป 781 ≠ 667)
 * แล้วเช็ค: ก = ข · ทุกแถว AI + คน = รวม · ผลทุกช่องรวมกัน = ทั้งหมด (ทั้งคอลัมน์ AI / คน / รวม)
 * ใช้: npx tsx scripts/follow-numbers-check.ts [from YYYY-MM-DD] [to YYYY-MM-DD]   (ไม่ใส่ = ทั้งหมด)
 */
import fs from 'node:fs';
for (const name of ['.env', '.env.local']) {
  if (!fs.existsSync(name)) continue;
  for (const line of fs.readFileSync(name, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const [from = null, to = null] = process.argv.slice(2);

async function main() {
  const { dbQuery } = await import('../api/_lib/postgres.js');
  const { tableInAppSchema } = await import('../api/_lib/schema.js');
  const { loadFollowJourney } = await import('../api/_handlers/home-ai-share.js');
  const { loadHomeLumosSummary } = await import('../api/_lib/homeLumosSummarySql.js');
  const { followPlanBounds } = await import('../src/lib/homeAiShare.js');
  const { AFTERCARE_TOPIC } = await import('../src/lib/aftercareRounds.js');

  const { start, end } = followPlanBounds({ from, to });
  const params = [start ? start.toISOString() : null, end ? end.toISOString() : null, null] as [string | null, string | null, null];

  // ก. SQL ดิบ
  const raw = await dbQuery<{ team: string; ai: string; manual: string; total: string }>(
    `select case when f.follow_team = 'replacement' then 'replacement' else 'main' end as team,
            count(*) filter (where f.call_mode is distinct from 'manual') as ai,
            count(*) filter (where f.call_mode = 'manual') as manual,
            count(*) as total
       from ${tableInAppSchema('follow_entries')} f
      where f.topic is distinct from $3::text
        and ($1::timestamptz is null or f.scheduled_at >= $1::timestamptz)
        and ($2::timestamptz is null or f.scheduled_at < $2::timestamptz)
      group by 1`,
    [params[0], params[1], AFTERCARE_TOPIC],
  );

  // ข. ตรรกะของหน้าจอ
  const { rows } = await loadFollowJourney(params);

  const COLS = ['went', 'notWent', 'reschedule', 'unclear', 'failed', 'cancelled', 'waiting'] as const;
  const LABEL: Record<(typeof COLS)[number], string> = {
    went: 'ไป',
    notWent: 'ไม่ไป',
    reschedule: 'ขอเลื่อน',
    unclear: 'สรุปไม่ได้',
    failed: 'ล้มเหลว',
    cancelled: 'ยกเลิก',
    waiting: 'รอโทร',
  };
  const problems: string[] = [];
  const pad = (s: string | number, n: number) => String(s).padStart(n);
  const padE = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - [...s].length));

  console.log(`\nช่วง: ${from ?? 'ทั้งหมด'} – ${to ?? 'ทั้งหมด'} (นับตามวันที่โทร · หน่วย = รายชื่อ/สาย)\n`);

  for (const team of ['all', 'main', 'replacement'] as const) {
    const mine = team === 'all' ? rows : rows.filter((r) => r.team === team);
    const title = team === 'all' ? 'รวม 2 แท็บ' : team === 'main' ? 'ติดตามคนเริ่มงาน' : 'ติดตามส่งคนแทน';
    const rawRows = team === 'all' ? raw.rows : raw.rows.filter((r) => r.team === team);
    const rawTotal = rawRows.reduce((n, r) => n + Number(r.total), 0);
    const rawAi = rawRows.reduce((n, r) => n + Number(r.ai), 0);
    const rawManual = rawRows.reduce((n, r) => n + Number(r.manual), 0);

    const cell = (col: (typeof COLS)[number] | null, caller: 'ai' | 'manual' | null) =>
      mine.filter((r) => (col === null || r.bucket === col) && (caller === null || r.caller === caller)).length;

    console.log(`── ${title} ──`);
    console.log(`${padE('', 14)}${pad('รวม', 8)}${pad('AI', 8)}${pad('คน', 8)}`);
    const line = (label: string, all: number, ai: number, man: number) => {
      console.log(`${padE(label, 14)}${pad(all, 8)}${pad(ai, 8)}${pad(man, 8)}`);
      if (ai + man !== all) problems.push(`${title} · ${label}: AI ${ai} + คน ${man} ≠ ${all}`);
    };
    line('ทั้งหมด', cell(null, null), cell(null, 'ai'), cell(null, 'manual'));
    for (const c of COLS) line(LABEL[c], cell(c, null), cell(c, 'ai'), cell(c, 'manual'));
    const sum = (caller: 'ai' | 'manual' | null) => COLS.reduce((n, c) => n + cell(c, caller), 0);
    console.log(`${padE('ผลรวมทุกช่อง', 14)}${pad(sum(null), 8)}${pad(sum('ai'), 8)}${pad(sum('manual'), 8)}`);
    for (const k of [null, 'ai', 'manual'] as const) {
      if (sum(k) !== cell(null, k)) problems.push(`${title} · ผลรวมทุกช่อง (${k ?? 'รวม'}) ${sum(k)} ≠ ทั้งหมด ${cell(null, k)}`);
    }
    console.log(`${padE('SQL ดิบ', 14)}${pad(rawTotal, 8)}${pad(rawAi, 8)}${pad(rawManual, 8)}`);
    if (rawTotal !== cell(null, null)) problems.push(`${title} · SQL ดิบ ${rawTotal} ≠ หน้าจอ ${cell(null, null)}`);
    if (rawAi !== cell(null, 'ai')) problems.push(`${title} · AI SQL ดิบ ${rawAi} ≠ หน้าจอ ${cell(null, 'ai')}`);
    if (rawManual !== cell(null, 'manual')) problems.push(`${title} · คน SQL ดิบ ${rawManual} ≠ หน้าจอ ${cell(null, 'manual')}`);
    console.log('');
  }

  // ค. ป๊อป (ข) = การ์ด/ตาราง BU ทุกช่อง × ใครโทร
  const card = await loadHomeLumosSummary(params[0] ? new Date(params[0]) : null, params[1] ? new Date(params[1]) : null, null);
  for (const caller of ['ai', 'manual'] as const) {
    const b = caller === 'ai' ? card.follow.ai : card.follow.staff;
    for (const c of COLS) {
      const popup = rows.filter((r) => r.caller === caller && r.bucket === c).length;
      if (popup !== b[c]) problems.push(`ป๊อป ${caller} · ${LABEL[c]} ${popup} ≠ การ์ด ${b[c]}`);
    }
  }

  if (problems.length) {
    console.log('❌ ไม่ลงตัว:\n' + problems.map((p) => '  - ' + p).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('✅ ลงตัวทุกแถว: AI + คน = รวม · ผลทุกช่องรวมกัน = ทั้งหมด · SQL ดิบ = หน้าจอ');
  }
  process.exit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
