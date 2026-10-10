/**
 * ═══ ตรวจเลขหน้าหลักทั้งหน้า (อ่านอย่างเดียว · เจ้าของ 7 ต.ค. 2569 "บวกลบกันต้องตรงกันนะ ทุกอย่างเลย") ═══
 *
 * ทุกหัวข้อ (ติดตาม · ดูแลหลังเริ่มงาน · งานสรรหา · จับคู่งาน) × หลายช่วง × ทุก BU + แยกรายBU:
 *   ① กล่อง: ทั้งหมด = AI โทร + คนโทร + ทั้งสองทาง + ยังไม่โทร
 *   ② กราฟรายวัน (วัน × BU) รวมกัน = กล่อง ทุกช่อง
 *   ③ ป๊อปรายชื่อของทุกกล่อง (ยอดรวมรายชื่อ) = เลขบนกล่อง
 *   ④ ผลโทร
 *      - ติดตาม: AI/คน ของการ์ดผลโทร = กล่อง · ผลทุกช่องรวม = ทั้งหมดของแถว · ก้อน BU รวม = ทั้งหมด · แถวในก้อนรวม = ก้อน
 *      - หัวข้ออื่น: ก้อน BU รวม = กล่อง · ก้อน (AI/คน/สองทาง/ยังไม่โทร) = กล่อง · ผลทุกช่องรวม = ก้อน · เส้นทาง "ติดต่อแล้ว" = AI+คน+สองทาง
 *   ⑤ กรอง BU ทีละ BU: กล่องของ BU นั้น = ก้อน BU นั้นในผลโทร
 * ไม่ลงตัวตัวเดียว = exit 1 · ใช้: npx tsx scripts/home-numbers-check.ts
 */
import fs from 'node:fs';
for (const name of ['.env', '.env.local']) {
  if (!fs.existsSync(name)) continue;
  for (const line of fs.readFileSync(name, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

type Win = { from: string | null; to: string | null };

async function main() {
  const home = await import('../api/_handlers/home-ai-share.js');
  const { loadHomeLumosSummary } = await import('../api/_lib/homeLumosSummarySql.js');
  const { loadTopicReport } = await import('../api/_lib/homeTopicReportSql.js');
  const { aiShareBounds, followPlanBounds, AI_SHARE_SEGMENTS } = await import('../src/lib/homeAiShare.js');
  const { followBuBlocks, followBucketAddsUp, FOLLOW_BUCKET_KEYS } = await import('../src/lib/homeLumosSummary.js');
  const { reportBuBlocks, REPORT_SEGS } = await import('../src/lib/homeTopicReport.js');
  const { toYmdBangkok } = await import('../src/lib/dateTh.js');
  const { loadOnlineRequestRows } = await import('../api/_lib/homeOnlineSql.js');
  const { buildOnlineReport } = await import('../src/lib/homeOnline.js');
  const { onlineRequestYmdRange } = await import('../src/lib/homeAiShare.js');

  const now = new Date();
  const today = toYmdBangkok(now);
  const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const wins: Array<[string, Win]> = [
    ['วันนี้', { from: today, to: today }],
    ['7 วันล่าสุด', { from: addDays(today, -6), to: today }],
    ['เดือนนี้', { from: `${today.slice(0, 7)}-01`, to: today }],
    ['30 วันล่าสุด', { from: addDays(today, -29), to: today }],
  ];
  // ปุ่ม "เดือนนี้" บนปฏิทิน = ทั้งเดือน (รวมวันข้างหน้า) · เดือนก่อนเต็มเดือน
  const first = `${today.slice(0, 7)}-01`;
  const nextFirst = addDays(first, 32).slice(0, 7) + '-01';
  const prevFirst = addDays(first, -1).slice(0, 7) + '-01';
  wins.push(['เดือนนี้ทั้งเดือน', { from: first, to: addDays(nextFirst, -1) }]);
  wins.push(['เดือนก่อน', { from: prevFirst, to: addDays(first, -1) }]);
  const scope = { mode: 'all' } as never;
  const problems: string[] = [];
  let checks = 0;
  const eq = (label: string, a: number, b: number) => {
    checks += 1;
    if (a !== b) problems.push(`${label}: ${a} ≠ ${b}`);
  };

  const blocks = ['follow', 'aftercare', 'applicants', 'matching'] as const;

  async function checkWindow(wl: string, win: Win, bu: string | null) {
    const tag = `${wl}${bu ? ` · ${bu}` : ''}`;
    const card = await home.buildHomeAiShare(win, scope, bu, now);
    for (const block of blocks) {
      const c = card[block] as { total: number; ai: number; staff: number; both: number; notCalled: number } | null;
      if (!c) {
        problems.push(`${tag} · ${block}: กล่องโหลดไม่ขึ้น`);
        continue;
      }
      const t = `${tag} · ${block}`;
      // ①
      eq(`${t} · กล่อง ทั้งหมด = AI + คน + สองทาง + ยังไม่โทร`, c.total, c.ai + c.staff + c.both + c.notCalled);
      // ②
      const det = await home.buildAiShareDetail(block, win, scope, bu, now);
      const rows = det.rows ?? [];
      for (const k of ['total', 'ai', 'staff', 'both', 'notCalled'] as const) {
        eq(
          `${t} · กราฟรายวันรวม ${k}`,
          rows.reduce((n, r) => n + (r as Record<string, number>)[k], 0),
          c[k],
        );
      }
      // ③ (เฉพาะทุก BU — ป๊อปรายชื่อใช้ BU ของบัญชี)
      if (!bu) {
        for (const k of ['total', ...AI_SHARE_SEGMENTS] as const) {
          const l = await home.buildAiShareList(block, k, 0, win, scope, null, now);
          if (l.error) continue;
          eq(`${t} · ป๊อปรายชื่อ ${k}`, l.total, c[k]);
        }
      }
      // ④
      if (block === 'follow') {
        const { start, end } = followPlanBounds(win);
        const s = await loadHomeLumosSummary(start, end, bu);
        eq(`${t} · ผลโทร AI = กล่อง AI`, s.follow.ai.total, c.ai);
        eq(`${t} · ผลโทร คน = กล่อง คน`, s.follow.staff.total, c.staff);
        for (const [who, b] of [
          ['AI', s.follow.ai],
          ['คน', s.follow.staff],
        ] as const) {
          checks += 1;
          if (!followBucketAddsUp(b)) problems.push(`${t} · ผลโทร ${who} ผลทุกช่องรวม ≠ ทั้งหมด`);
        }
        const bb = followBuBlocks(s.followByBu);
        eq(
          `${t} · ผลโทร ก้อน BU รวม = กล่องทั้งหมด`,
          bb.reduce((n, x) => n + x.sum.total, 0),
          c.total,
        );
        for (const x of bb) {
          eq(
            `${t} · ${x.bu} แถวในก้อนรวม = ก้อน`,
            x.rows.reduce((n, r) => n + r.total, 0),
            x.sum.total,
          );
          for (const r of x.rows) {
            eq(
              `${t} · ${x.bu} ${r.team}/${r.caller} ผลทุกช่องรวม`,
              FOLLOW_BUCKET_KEYS.reduce((n, k) => n + r.buckets[k], 0),
              r.total,
            );
          }
          eq(`${t} · ${x.bu} AI + คน = ก้อน`, x.sum.ai + x.sum.staff, x.sum.total);
        }
      } else {
        const { start, end } = aiShareBounds(win, now);
        const r = await loadTopicReport(block, start, end, bu);
        const bb = reportBuBlocks(r);
        eq(
          `${t} · ผลโทร ก้อน BU รวม = กล่องทั้งหมด`,
          bb.reduce((n, x) => n + x.total, 0),
          c.total,
        );
        eq(`${t} · เส้นทาง ทั้งหมด = กล่อง`, r.funnel.find((f) => f.key === 'total')?.value ?? -1, c.total);
        eq(`${t} · เส้นทาง ติดต่อแล้ว = AI + คน + สองทาง`, r.funnel.find((f) => f.key === 'called')?.value ?? -1, c.ai + c.staff + c.both);
        if (block === 'matching') {
          const fv = (k: string) => r.funnel.find((f) => f.key === k)?.value ?? -1;
          const tierParts = r.funnel.find((f) => f.key === 'matched')?.parts ?? [];
          const tiers = tierParts.reduce((n, i) => n + i.value, 0);
          eq(`${t} · จับคู่รอ เขียว + เหลือง + แดง = คนที่จับคู่รอ`, tiers, fv('matched'));
          const act = Object.fromEntries((r.extra.find((x) => x.title === 'ต้องสั่งงาน')?.items ?? []).map((i) => [i.key, i.value]));
          eq(`${t} · มีคนแนะนำ + ไม่มีคนเหมาะ = AI จับคู่แล้ว`, fv('jobsRecommend') + (act.jobsNone ?? 0), fv('jobsMatched'));
          checks += 1;
          if (fv('jobsMatched') > fv('jobsIn')) problems.push(`${t} · AI จับคู่แล้ว ${fv('jobsMatched')} > ใบขอเข้ามา ${fv('jobsIn')}`);
          const green = tierParts.find((i) => i.key === 'green')?.value ?? 0;
          checks += 1;
          if ((act.greenUncontacted ?? 0) > green) problems.push(`${t} · เขียวยังไม่มีใครโทร > เขียวทั้งหมด`);
        }
        // ทุกขั้นที่แยก AI/คน: แยกรวมกัน = เลขของขั้น · ขั้น "โทรแล้ว" แยก = กล่อง AI / คน / สองทาง
        for (const f of r.funnel) {
          if (!f.parts) continue;
          eq(
            `${t} · ขั้น ${f.label} แยกรวม = เลขของขั้น`,
            f.parts.reduce((n, p) => n + p.value, 0),
            f.value,
          );
        }
        const calledParts = Object.fromEntries((r.funnel.find((f) => f.key === 'called')?.parts ?? []).map((p) => [p.key, p.value]));
        if (block !== 'aftercare') {
          eq(`${t} · ขั้นโทรแล้ว AI = กล่อง AI`, calledParts.ai ?? -1, c.ai);
          eq(`${t} · ขั้นโทรแล้ว คน = กล่อง คน`, calledParts.staff ?? -1, c.staff);
          eq(`${t} · ขั้นโทรแล้ว สองทาง = กล่อง สองทาง`, calledParts.both ?? -1, c.both);
        }
        if (block === 'applicants') {
          const fv = (k: string) => r.funnel.find((f) => f.key === k)?.value ?? -1;
          eq(`${t} · ใบสมัคร (AI ส่งเอง + คนสั่ง + อายุเกิน + ไม่ได้ส่ง) = กล่อง`, fv('total'), c.total);
          checks += 1;
          if (fv('fast') > fv('called')) problems.push(`${t} · โทรภายใน 15 นาที ${fv('fast')} > โทรแล้ว ${fv('called')}`);
          // 🔴 ใบขอเข้ามา · ประกาศแล้ว = ตัวเดียวกับแท็บทีม Online (QA 10 ต.ค. 2569 เคย 55 · 44 ≠ 54 · 4)
          const rr = onlineRequestYmdRange(start, end);
          const online = buildOnlineReport(await loadOnlineRequestRows({ ...rr, bu, departmentScope: scope }), rr);
          eq(`${t} · ใบขอเข้ามา = ทีม Online`, fv('jobsIn'), online.requests.total);
          eq(`${t} · ประกาศแล้ว = ทีม Online`, fv('published'), online.posting.released);
        }
        for (const s of REPORT_SEGS) {
          eq(
            `${t} · ผลโทร ก้อน ${s.key} = กล่อง`,
            bb.reduce((n, x) => n + x.bySeg[s.key].total, 0),
            c[s.key],
          );
        }
        for (const x of bb) {
          for (const s of REPORT_SEGS) {
            eq(
              `${t} · ${x.bu} ${s.key} ผลทุกช่องรวม`,
              Object.values(x.bySeg[s.key].cols).reduce((n, v) => n + v, 0),
              x.bySeg[s.key].total,
            );
          }
          eq(
            `${t} · ${x.bu} แถวรวม = ก้อน`,
            Object.values(x.sum).reduce((n, v) => n + v, 0),
            x.total,
          );
        }
      }
    }
    return card;
  }

  for (const [wl, win] of wins) {
    await checkWindow(wl, win, null);
    // ⑤ ทีละ BU ที่มีงานในช่วงนี้
    const { start, end } = followPlanBounds(win);
    const s = await loadHomeLumosSummary(start, end, null);
    const bus = new Set(
      followBuBlocks(s.followByBu)
        .map((b) => b.bu)
        .filter((b): b is string => !!b),
    );
    const ab = aiShareBounds(win, now);
    for (const block of ['applicants'] as const) {
      const r = await loadTopicReport(block, ab.start, ab.end, null);
      for (const b of reportBuBlocks(r)) if (b.bu) bus.add(b.bu);
    }
    for (const bu of bus) {
      const card = await checkWindow(wl, win, bu);
      // ก้อน BU นั้นตอนดูทุก BU = กล่องตอนกรอง BU นั้น
      const fb = followBuBlocks(s.followByBu).find((b) => b.bu === bu);
      eq(`${wl} · ${bu} · ติดตาม ก้อนตอนดูทุก BU = กล่องตอนกรอง BU`, fb?.sum.total ?? 0, card.follow?.total ?? 0);
      const r = await loadTopicReport('applicants', ab.start, ab.end, null);
      const ab2 = reportBuBlocks(r).find((b) => b.bu === bu);
      eq(`${wl} · ${bu} · งานสรรหา ก้อนตอนดูทุก BU = กล่องตอนกรอง BU`, ab2?.total ?? 0, card.applicants?.total ?? 0);
    }
    console.log(`✓ ${wl} (${win.from} – ${win.to}) · BU ${[...bus].join(', ') || '-'}`);
  }

  console.log(`\nตรวจ ${checks} จุด`);
  if (problems.length) {
    console.log(`❌ ไม่ลงตัว ${problems.length} จุด:\n` + problems.map((p) => '  - ' + p).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('✅ ลงตัวทุกจุด');
  }
  process.exit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
