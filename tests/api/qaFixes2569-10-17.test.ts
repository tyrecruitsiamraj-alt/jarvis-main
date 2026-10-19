// @vitest-environment node
/**
 * แก้ 9 ข้อจาก QA ทั้งระบบ 17 ต.ค. 2569 (docs/qa-2569-10-17.md + -r2.md) — เจ้าของ "แก้ 9 ข้อนี้"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applicationsJobKey } from '../../src/lib/siamrajUnitRequestsApi';
import { withCurrentColumnLabels } from '../../src/lib/boardMatchAvailability';
import { buildFollowPrefillPath, prefillPhone, readFollowPrefill } from '../../src/lib/followPrefill';
import { workStatusPercentBase } from '../../src/lib/dashboard/buildDashboardData';
import { publicWorkSchedule } from '../../src/lib/publicJobPrivacy';

const read = (p: string) => readFileSync(p, 'utf8');

describe('1 · แท็บผู้สมัคร/การติดต่อของใบขอ ค้นด้วยคีย์เต็ม', () => {
  it('ใช้ id ของใบขอที่โหลดได้ก่อน · ไม่มีก็เติม siamraj-sql: ให้เลขเปล่า · คีย์ที่มี prefix แล้วไม่แตะ', () => {
    expect(applicationsJobKey('OPL6909071', 'siamraj-sql:OPL6909071')).toBe('siamraj-sql:OPL6909071');
    expect(applicationsJobKey('OPL6909071', null)).toBe('siamraj-sql:OPL6909071');
    expect(applicationsJobKey('siamraj-pre:ABC1', null)).toBe('siamraj-pre:ABC1');
  });
  it('หน้าแท็บไม่ส่ง id จาก URL ไปค้นใบสมัครตรง ๆ แล้ว', () => {
    const src = read('src/pages/jobs/UnitRequestTabPage.tsx');
    expect(src).not.toContain('fetchJobApplications(id)');
    expect(src).toContain('fetchJobApplications(applicationsJobKey(id, j?.id))');
  });
});

describe('2 · แท็บ AI Match ใช้กองใหม่ + ป้ายถังปัจจุบัน', () => {
  it('หัวไม่พูดถึง To do แล้ว', () => {
    const src = read('src/pages/jobs/UnitRequestTabPage.tsx');
    expect(src).not.toContain('(To do · ไม่มีงาน)');
    expect(src).toContain('(ไม่มีงาน · Re Use · Drop)');
  });
  it('ป้ายถังในผลแมทเก่าถูกทับด้วยถังปัจจุบัน · ไม่รู้ = คงเดิม', () => {
    const ctx = {
      availableCardIds: new Set([1, 2]),
      activeJobByCardId: new Map<number, string>(),
      columnLabelByCardId: new Map([[1, 'Drop']]),
    };
    const out = withCurrentColumnLabels([{ card_id: 1, column_label: 'To do' }, { card_id: 2, column_label: 'Re Use' }], ctx);
    expect(out.map((m) => m.column_label)).toEqual(['Drop', 'Re Use']);
    expect(read('api/_handlers/matching-board-candidates.ts')).toContain('withCurrentColumnLabels(filterAvailableBoardMatches(');
  });
});

describe('3 · ดูแลหลังเริ่มงาน → ฟอร์มติดตาม', () => {
  it('เบอร์ +66 กลายเป็น 0xxxxxxxxx · ส่งวันเริ่มงานต่อ · อ่านกลับได้', () => {
    expect(prefillPhone('+66812345678')).toBe('0812345678');
    expect(prefillPhone('66812345678')).toBe('0812345678');
    expect(prefillPhone('081-234-5678')).toBe('0812345678');
    const path = buildFollowPrefillPath({ name: 'คนที่ 1', phone: '+66812345678', startDate: '2026-10-01' });
    const back = readFollowPrefill(path.split('?')[1]);
    expect(back.phone).toBe('0812345678');
    expect(back.startDate).toBe('2026-10-01');
    expect(readFollowPrefill('pf_start=1/10/2569').startDate).toBeUndefined();
  });
  it('หน้าดูแลส่ง start_date · ฟอร์มรับวันเริ่มงาน · เรื่อง "ถามความเป็นอยู่หลังเริ่มงาน" อยู่ในตัวเลือก', () => {
    // 19 ต.ค. 2569 ตั้งรอบในป๊อปบนหน้าดูแล — วันเริ่มงานของแถวเป็นค่าเริ่มของป๊อป
    expect(read('src/components/aftercare/AftercareScheduleDialog.tsx')).toContain('person?.start_date ?? startYmdOfRounds(pending)');
    expect(read('src/pages/follow/FollowPage.tsx')).toContain('if (prefill.startDate) setStartDate(prefill.startDate);');
    expect(read('src/components/follow/TopicField.tsx')).toContain('load={listTopicsWithSystem}');
    expect(read('src/pages/aftercare/AftercarePage.tsx')).toContain('aftercareMissingStartDate(open, calls)');
  });
});

describe('4 · Dashboard % สถานะทำงาน', () => {
  it('ตัวหารไม่รวมการ์ด "ทั้งหมด"', () => {
    const list = [
      { id: 'work_status_total', value: 482 },
      { id: 'work_status_in_progress', value: 329 },
      { id: 'work_status_waiting_inform', value: 87 },
      { id: 'work_status_on_hold', value: 66 },
    ];
    const base = workStatusPercentBase(list);
    expect(base).toBe(482);
    expect(Math.round((329 / base) * 100)).toBe(68);
    expect(read('src/components/dashboard/analytics/DashboardShell.tsx')).toContain('const total = workStatusPercentBase(list);');
  });
});

describe('5 · หน้าสาธารณะไม่โชว์คำสั่งงานภายใน', () => {
  it.each([
    ['วันจันทร์ - วันศุกร์  ( หรือปฏิบัติงานตามตารางนาย โดย OPL จะเป็นผู้สรุป ) • 08.30 - 17.30 น.', 'วันจันทร์ - วันศุกร์ • 08.30 - 17.30 น.'],
    ['ปฏิบัติงานทุกวัน, พขร ปฏิบัติงาน 6 วัน/สัปดาห์ • เวลา 07.00 น. – 18.00 น. (กะละ 9 ชม รวมพัก)  ขอให้แผนก OPL ทำการแจ้งตารางกะให้กับผู้ที่เกี่ยวข้องด้วย', 'ปฏิบัติงานทุกวัน, พขร ปฏิบัติงาน 6 วัน/สัปดาห์ • เวลา 07.00 น. – 18.00 น. (กะละ 9 ชม รวมพัก)'],
    ['6 วัน/สัปดาห์ ตามตารางกะ ( ขอให้เแผนก  OPL ทำการจัดตารางกะ แจ้งให้ผู้ที่เกี่ยวข้องทราบ ) • กะละ 9 ชม./วัน', '6 วัน/สัปดาห์ ตามตารางกะ • กะละ 9 ชม./วัน'],
    ['วันจันทร์ - วันศุกร์ • (พนักงานทำงานกะละ 9 ชม. รวมพัก) กะที่ 1 เวลา 06.00 - 15.00 น., กะที่ 2 เวลา 12.00 - 21.00 น หรือตามตารางกะที่ OPL จัดตามหน้างาน', 'วันจันทร์ - วันศุกร์ • (พนักงานทำงานกะละ 9 ชม. รวมพัก) กะที่ 1 เวลา 06.00 - 15.00 น., กะที่ 2 เวลา 12.00 - 21.00 น'],
    // "แผนการ" มีตัวอักษร แผนก ซ้อนอยู่ — ห้ามตัด
    ['ตามแผนการจดหน่วย • 06:00 - 15:00 น.', 'ตามแผนการจดหน่วย • 06:00 - 15:00 น.'],
  ])('%s', (raw, want) => {
    expect(publicWorkSchedule(raw)).toBe(want);
  });
  it('ใช้ทั้งเส้นสาธารณะและการ์ดตัวอย่าง', () => {
    expect(read('api/_handlers/public/jobs.ts')).toContain('work_schedule: publicWorkSchedule(r.work_schedule) || undefined');
    expect(read('src/components/jobs/JobPublicFacts.tsx')).toContain('const schedule = publicWorkSchedule(job.work_schedule);');
  });
});

describe('6 · ฟอร์มเพิ่มคน (/matching/candidates/add) ต้องยินยอม PDPA', () => {
  it('หน้าจอมีช่องติ๊ก + บังคับก่อนบันทึก · API ตอบ 400 ถ้าไม่ยินยอม และจดฉบับข้อความไว้', () => {
    const page = read('src/pages/matching/AddCandidatePage.tsx');
    expect(page).toContain('<PdpaConsentCheck checked={pdpaConsent} onChange={setPdpaConsent} text={PDPA_CONSENT_TEXT_STAFF} />');
    expect(page).toContain('if (!pdpaConsent) return setError(PDPA_CONSENT_REQUIRED_MESSAGE_STAFF);');
    expect(page).toContain('pdpa_consent: true,');
    const api = read('api/_handlers/candidates.ts');
    expect(api).toContain("if (raw.pdpa_consent !== true) return sendError(res, 400, 'Bad request', PDPA_CONSENT_REQUIRED_MESSAGE_STAFF);");
    expect(api).toContain("pdpa_consent: { source: 'staff', version: PDPA_CONSENT_VERSION }");
  });
});

describe('8 · ข้อความ AI ล้มไม่โชว์ที่อยู่เซิร์ฟเวอร์ · ลองใหม่ไม่บังคับคิดใหม่', () => {
  it('ไม่มี baseUrl / คำสั่งตั้งค่าในข้อความที่ส่งถึงจอ', () => {
    const src = read('api/_lib/ollamaClient.ts');
    expect(src).not.toContain('เชื่อมต่อ Ollama ไม่ได้ที่ ${cfg.baseUrl}');
    expect(src).not.toContain('OLLAMA_BASE_URL=http://127.0.0.1');
    const page = read('src/pages/matching/PreCheckPage.tsx');
    expect(page).not.toContain('npm run dev');
    expect(page).toContain('onClick={() => void fetchIrecruitMatch(jobDetail.id, false)}');
  });
});

describe('9 · มือถือ 375', () => {
  it('ป๊อปคนของเราเรียงซ้อนบนจอแคบ · ช่องน้ำหนักไม่ถูกบีบ · ชิปเบอร์ซ่อนบนจอแคบ', () => {
    expect(read('src/pages/matching/MatchingPage.tsx')).toContain('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between');
    expect(read('src/pages/settings/MatchPriorityWeightsTab.tsx')).toContain('<span className="w-[72px] shrink-0">');
    const people = read('src/pages/matching/OurPeoplePage.tsx');
    expect(people).toContain('<span className="hidden shrink-0 sm:inline-flex">');
    expect(people).toContain('sm:hidden');
  });
});
