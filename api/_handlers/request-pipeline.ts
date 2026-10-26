/**
 * ═══ GET /api/request-pipeline — ข้อมูลดิบของเส้นใบขอ 12 ขั้น (หน้าหลัก แท็บใบขอ · เจ้าของ 22 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ทุกใบต้องบอกได้ว่า ใบขอ ก ผ่านมาแล้วกี่วัน มีคนสนใจใบนี้กี่คน ติดตรงไหนปิดไม่ได้ … เคยส่งคนแทนไหม
 * ถ้าเคยส่งมาแล้วกี่วัน เพื่อเอาวันที่ผ่านมาเนี่ยมาดูว่ามีค่าปรับเท่าไหร่"* + ช่องทาง Facebook/TikTok/ออฟไลน์ กดลึกได้
 *
 * อ่านอย่างเดียว · ส่งข้อเท็จจริง หน้าเว็บนับเอง (`src/lib/requestPipeline.ts`) ให้ "ผ่านมา" เป็นตัวเดียวกับเมนูใบขอ
 * - ใบขอ = รายการใบเปิดชุดเดียวกับเมนูใบขอ (`readUnitRequestListThroughCache` limit 500 · ขอบเขตแผนกของผู้ใช้)
 * - ผู้สมัคร = `loadFactsForJobs` (นิยามเดียวกับภาพรวมงานสรรหา)
 * - ส่งคนแทน = สายของหน้าติดตามส่งคนแทน · วันเข้างาน `replaceWorkYmd` · หนึ่งคนต่อวันต่อไซต์ · ไม่นับที่ยกเลิก
 * - ติดตามคนเริ่มงาน / ดูแลหลังเริ่มงาน = ชุดติดตาม (group) ที่ผูกรหัสไซต์ · วันเริ่ม = สายแรกของชุด
 * ก้อนไหนล้ม = null + เหตุ (ก้อนอื่นยังขึ้น)
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from "../_lib/http.js";
import { dbQuery } from "../_lib/postgres.js";
import { tableInAppSchema } from "../_lib/schema.js";
import {
  loadMatchingBuScope,
  loadUserDepartmentScope,
  type DepartmentScope,
} from "../_lib/departmentScope.js";
import { normalizeTrendBu } from "../../src/lib/trends/bu.js";
import { pickDashboardBu } from "../_lib/homeBuSql.js";
import { logError } from "../_lib/logger.js";
import { readUnitRequestListThroughCache } from "./siamraj-unit-requests.js";
import { loadFactsForJobs } from "./recruit-overview.js";
import { loadChannelPlacement } from "../_lib/channelPlacementSql.js";
import { AFTERCARE_TOPIC } from "../../src/lib/aftercareRounds.js";
import { replaceWorkYmd } from "../../src/lib/irecruitReplaceSync.js";
import { FOLLOW_TEAM_REPLACEMENT } from "../../src/lib/followReplacement.js";
import type { RequestPipelineResponse } from "../../src/lib/requestPipelineTypes.js";

const FOLLOW = tableInAppSchema("follow_entries");
const RELEASES = tableInAppSchema("job_public_releases");

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const BKK_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ymdOf = (v: unknown): string | null => {
  const t = v instanceof Date ? v.getTime() : Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? BKK_YMD.format(new Date(t)) : null;
};
const shiftYmd = (ymd: string, days: number) =>
  BKK_YMD.format(
    new Date(Date.parse(`${ymd}T12:00:00+07:00`) + days * 86_400_000),
  );

/** คนแทนหนึ่งคน = รหัสงาน + คีย์คน (สาย confirm/lead60/lead15 ของคนเดียวกันนับครั้งเดียว) */
const REPLACE_PERSON =
  /^(?:irecruit|manual)-replace:([^:]+)(?::(?:confirm|lead60|lead15):([^:]+))?/;

async function step<T>(
  errors: RequestPipelineResponse["errors"],
  key: keyof RequestPipelineResponse["errors"],
  what: string,
  run: () => Promise<T>,
): Promise<T | null> {
  try {
    return await run();
  } catch (e) {
    logError(`request-pipeline: ${key}`, e);
    errors[key] = `อ่าน${what}ไม่ได้`;
    return null;
  }
}

/** ส่งคนแทน: ไซต์ → วัน → จำนวนคน */
export function groupReplacements(
  rows: ReadonlyArray<{
    site: string | null;
    source_ref: string | null;
    scheduled_at: unknown;
    note: string | null;
  }>,
): { bySite: Record<string, Array<[string, number]>>; since: string | null } {
  const people = new Map<string, Set<string>>();
  let since: string | null = null;
  for (const r of rows) {
    const site = (r.site ?? "").trim();
    const m = REPLACE_PERSON.exec(r.source_ref ?? "");
    if (!site || !m) continue;
    const ymd = replaceWorkYmd({
      source_ref: r.source_ref,
      scheduled_at:
        r.scheduled_at instanceof Date
          ? r.scheduled_at.toISOString()
          : String(r.scheduled_at ?? ""),
      note: r.note,
    });
    if (!ymd) continue;
    if (!since || ymd < since) since = ymd;
    const key = `${site}|${ymd}`;
    const set = people.get(key) ?? new Set<string>();
    set.add(`${m[1]}:${m[2] ?? ""}`);
    people.set(key, set);
  }
  const bySite: Record<string, Array<[string, number]>> = {};
  for (const [key, set] of people) {
    const [site, ymd] = key.split("|");
    (bySite[site] ??= []).push([ymd, set.size]);
  }
  for (const list of Object.values(bySite))
    list.sort((a, b) => a[0].localeCompare(b[0]));
  return { bySite, since };
}

export async function buildRequestPipeline(
  departmentScope: DepartmentScope,
  bu: string | null,
  q: { from?: unknown; to?: unknown },
  now: Date = new Date(),
): Promise<RequestPipelineResponse> {
  const today = BKK_YMD.format(now);
  const to = typeof q.to === "string" && YMD.test(q.to) ? q.to : today;
  const from =
    typeof q.from === "string" && YMD.test(q.from) ? q.from : shiftYmd(to, -29);
  const errors: RequestPipelineResponse["errors"] = {};
  const body: RequestPipelineResponse = {
    generatedAt: now.toISOString(),
    today,
    window: { from, to },
    facts: null,
    releasedJobIds: null,
    replacementBySite: null,
    replacementSince: null,
    followStartsBySite: null,
    aftercareBySite: null,
    channels: null,
    errors,
  };

  const jobs = await step(
    errors,
    "requests",
    "รายการใบขอ",
    async () =>
      (await readUnitRequestListThroughCache({ limit: 500, departmentScope }))
        .value,
  );
  const jobIds = (jobs ?? []).map((j) => String(j.id));
  const sites = [
    ...new Set(
      (jobs ?? []).map((j) => (j.site_code ?? "").trim()).filter(Boolean),
    ),
  ];

  const [facts, released, repl, follow, channels] = await Promise.all([
    step(errors, "facts", "ผู้สมัคร", () => loadFactsForJobs(jobIds, bu)),
    step(errors, "releases", "การประกาศ", async () =>
      jobIds.length === 0
        ? []
        : (
            await dbQuery<{ job_id: string }>(
              `select distinct job_id from ${RELEASES} where job_id = any($1::text[])`,
              [jobIds],
            )
          ).rows.map((r) => r.job_id),
    ),
    step(errors, "replacement", "ส่งคนแทน", async () =>
      sites.length === 0
        ? { bySite: {}, since: null }
        : groupReplacements(
            (
              await dbQuery<{
                site: string | null;
                source_ref: string | null;
                scheduled_at: unknown;
                note: string | null;
              }>(
                `select coalesce(nullif(btrim(site_code), ''), nullif(btrim(irecruit_site_code), '')) as site, source_ref, scheduled_at, note
                     from ${FOLLOW}
                    where follow_team = $1 and cancelled_at is null
                      and coalesce(nullif(btrim(site_code), ''), nullif(btrim(irecruit_site_code), '')) = any($2::text[])`,
                [FOLLOW_TEAM_REPLACEMENT, sites],
              )
            ).rows,
          ),
    ),
    step(errors, "follow", "ติดตามคนเริ่มงาน", async () => {
      if (sites.length === 0) return { starts: {}, care: {} };
      const { rows } = await dbQuery<{
        site: string;
        aftercare: boolean;
        first_at: unknown;
      }>(
        `select btrim(site_code) as site, (topic = $2) as aftercare, min(scheduled_at) as first_at
             from ${FOLLOW}
            where follow_team is distinct from $1 and cancelled_at is null and btrim(site_code) = any($3::text[])
            group by btrim(site_code), (topic = $2), coalesce(group_id::text, id::text)`,
        [FOLLOW_TEAM_REPLACEMENT, AFTERCARE_TOPIC, sites],
      );
      const starts: Record<string, string[]> = {};
      const care: Record<string, string[]> = {};
      for (const r of rows) {
        const ymd = ymdOf(r.first_at);
        if (!ymd) continue;
        ((r.aftercare ? care : starts)[r.site] ??= []).push(ymd);
      }
      return { starts, care };
    }),
    step(errors, "channels", "ช่องทาง", () =>
      loadChannelPlacement({ from, to }),
    ),
  ]);

  body.facts = facts;
  body.releasedJobIds = released;
  body.replacementBySite = repl?.bySite ?? null;
  body.replacementSince = repl?.since ?? null;
  body.followStartsBySite = follow?.starts ?? null;
  body.aftercareBySite = follow?.care ?? null;
  body.channels = channels;
  return body;
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader?.("Allow", "GET");
    return sendError(res, 405, "Method not allowed");
  }
  try {
    const [departmentScope, buScope] = await Promise.all([
      loadUserDepartmentScope(req.user),
      loadMatchingBuScope(req.user),
    ]);
    // หลาย BU (26 ต.ค. 2569): เลือกทีละ BU ในสิทธิ์ · แอดมินไม่ล็อก (null) เหมือนเดิม
    const bu = buScope.mode === "code" ? pickDashboardBu(buScope, req.query?.bu).bu : null;
    const body = await buildRequestPipeline(
      departmentScope,
      bu,
      req.query ?? {},
    );
    res.setHeader?.("Cache-Control", "no-store");
    return res.status(200).json(body);
  } catch (e) {
    return handleApiError(res, e, "request-pipeline", {
      userId: req.user?.sub,
    });
  }
}

export default withRbac(handler, "job-applications");
