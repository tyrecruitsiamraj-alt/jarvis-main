import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appointmentOutcome, buildAppointmentHistory, type ApplicantAppointmentHistoryItem } from '../../src/lib/appointmentHistory';
import { buildClaimerUnclaimNotice } from '../../src/lib/callChoiceGuard';
import { declinedSuppressUntil } from '../../api/_lib/callFollowup';
import { stepError, blankForm } from '../../src/lib/documents/applicantForm';
import type { ContactLog } from '../../src/lib/applicationContactsApi';

/**
 * Journey ผู้สมัคร (เจ้าของเคาะ 24 พ.ย. 2569)
 * 1. นำเข้า Excel ไม่ติ๊กส่ง AI = AI ไม่โทร · 2. ไม่มา/ไม่ผ่าน = กลับแท็บผู้สมัคร + ประวัตินัดหมายบอกหน่วยงานและผล
 * 3. นัดได้จากถังโทร = ใบเป็นนัดแล้ว · 4. ไม่สนใจ = AI ไม่โทร 30 วัน (คนโทรได้) · 5. คืนรายชื่อที่เก็บไว้ = แจ้งคนเก็บ
 * 6. ภาพบัตรเบลอ/มืด/แสงสะท้อน = กดถัดไปไม่ได้
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('นำเข้า Excel', () => {
  it('ไม่ติ๊ก = จด call_choice manual ในธุรกรรมเดียวกับการบันทึก (ตัวส่งรอบ 5 นาทีข้าม)', () => {
    const h = read('api/_handlers/job-applications-import.ts');
    expect(h).toContain('const wantAi = raw?.send_ai === true;');
    expect(h).toContain("if (ins[0]?.id && !wantAi) {");
    expect(h).toContain("set call_choice = 'manual'");
    expect(read('src/lib/applicationImportApi.ts')).toContain('send_ai: input.sendAi === true,');
  });
  it('ป๊อปมีช่องติ๊ก เริ่มที่ไม่ติ๊ก', () => {
    const d = read('src/components/recruit-rm/ImportApplicantsDialog.tsx');
    expect(d).toContain('const [sendAi, setSendAi] = useState(false);');
    expect(d).toContain('data-testid="import-send-ai"');
  });
});

describe('ไม่มา / ไม่ผ่าน ⇒ กลับแท็บผู้สมัคร', () => {
  it('ออกจากแท็บนัดหมาย ปลดคนเก็บ + Lead + ล็อกเบอร์ · AI ไม่โทรเอง', () => {
    const s = read('api/_lib/appointmentReturn.ts');
    expect(s).toContain("set status = 'contacted',");
    expect(s).toContain('claimed_by = null');
    expect(s).toContain('is_lead = false');
    expect(s).toContain("call_choice = coalesce(call_choice, 'manual')");
    expect(s).toContain("where id = $1 and status = 'converted'");
    const h = read('api/_handlers/application-attendance.ts');
    expect(h).toContain("if (result === 'no_show' || result === 'not_passed') {");
    expect(h.match(/await applyAppointmentOutcome\(/g)).toHaveLength(2);
  });
});

describe('ประวัตินัดหมายข้ามทุกใบ', () => {
  const item = (o: Partial<ApplicantAppointmentHistoryItem>): ApplicantAppointmentHistoryItem => ({
    id: '9f1c2b7a-0000-4000-8000-000000000001',
    application_id: 'a1b2c3d4-0000-4000-8000-000000000001',
    appointment_at: '2026-10-30T04:00:00.000Z',
    place: 'สำนักงานใหญ่ สยามราชธานี',
    unit_name: 'บริษัท พลังงานบริสุทธิ์ จำกัด (มหาชน)',
    job_title: 'พนักงานขับรถผู้บริหาร',
    job_label: 'LBD6910123',
    by_name: 'อ้น',
    created_at: '2026-10-29T03:00:00.000Z',
    attendance: null,
    screening: null,
    is_current: false,
    ...o,
  });
  it('ผล: ผ่าน/ไม่ผ่าน ก่อน → มา/ไม่มา/เลื่อนนัด → รอผล', () => {
    expect(appointmentOutcome('showed', 'not_passed')).toEqual({ label: 'ไม่ผ่าน', tone: 'danger' });
    expect(appointmentOutcome('no_show', null)).toEqual({ label: 'ไม่มา', tone: 'danger' });
    expect(appointmentOutcome('rescheduled', null)).toEqual({ label: 'เลื่อนนัด', tone: 'warn' });
    expect(appointmentOutcome(null, null)).toEqual({ label: 'รอผล', tone: 'neutral' });
  });
  it('รวมนัดทุกใบ + นัดหมายไม่สำเร็จของใบนี้ · ล่าสุดก่อน · บอกหน่วยงาน', () => {
    const failed: ContactLog = {
      id: 'c-77', applicationId: 'cur', ok: true, reasonId: 'r1', reasonLabel: 'ผู้สมัครไม่สะดวกวันนัด',
      appointmentAt: null, appointmentPlace: null, jobId: null, jobLabel: null, note: null, createdByName: 'มาย', createdAt: '2026-11-20T03:00:00.000Z',
    };
    const rows = buildAppointmentHistory(
      [item({ attendance: 'no_show' }), item({ id: 'x2', appointment_at: '2026-11-10T03:00:00.000Z', is_current: true, unit_name: 'ธนาคารกรุงศรีอยุธยา', job_title: null })],
      [failed],
    );
    expect(rows.map((r) => r.outcome)).toEqual(['นัดหมายไม่สำเร็จ', 'รอผล', 'ไม่มา']);
    expect(rows[2].unit).toBe('บริษัท พลังงานบริสุทธิ์ จำกัด (มหาชน) · พนักงานขับรถผู้บริหาร');
    expect(rows[1]).toMatchObject({ unit: 'ธนาคารกรุงศรีอยุธยา', isCurrent: true });
  });
  it('API แนบประวัตินัดของใบที่ผู้ดูมีสิทธิ์ · ป๊อปใช้ตารางใหม่', () => {
    expect(read('api/_handlers/job-applications.ts')).toContain('await loadAppointmentHistory([id, ...history.map((h) => String(h.id))])');
    expect(read('src/components/recruit-rm/ApplicantContactDialog.tsx')).toContain('<AppointmentHistoryTable rows={buildAppointmentHistory(extras.appointmentHistory ?? [], logs)} />');
  });
});

describe('นัดได้จากถังโทร ⇒ ใบเป็นนัดแล้ว', () => {
  it('ผลยืนยัน + มีวันนัด + เป็นใบสมัคร ⇒ createContactLog (ตัวเดียวกับแท็บการติดต่อ)', () => {
    const h = read('api/_handlers/matching-call-holds.ts');
    expect(h).toContain("if (saved.source === 'application' && saved.appointmentAt && saved.resultOutcome === 'confirmed') {");
    expect(h).toContain('await createContactLog({');
  });
});

describe('ไม่สนใจ ⇒ AI ไม่โทร 30 วัน', () => {
  it('นับจากวันที่ตอบ', () => {
    expect(declinedSuppressUntil(new Date('2026-11-24T03:00:00.000Z'), 30)).toBe('2026-12-24T03:00:00.000Z');
  });
});

describe('คืนรายชื่อที่เก็บไว้ ⇒ แจ้งคนเก็บ', () => {
  it('ข้อความบอกชื่อ + ไปอยู่ไหน', () => {
    expect(buildClaimerUnclaimNotice(['นายสมชาย ใจดี', 'นางสาวกรทิชา มุขดา', 'นายชวโรจน์ นาคสาทา', 'นายสิทธิพงษ์ จุนยุเสน'])).toEqual({
      title: 'คืนรายชื่อที่คุณเก็บไว้ 4 คน',
      body: 'นายสมชาย ใจดี · นางสาวกรทิชา มุขดา · นายชวโรจน์ นาคสาทา และอีก 1 คน — เก็บไว้เกิน 1 วันยังไม่ได้โทร ตอนนี้อยู่แท็บผู้สมัคร',
    });
    expect(buildClaimerUnclaimNotice([])).toBeNull();
    expect(read('api/_lib/callChoiceWorker.ts')).toContain("type: 'claim_idle_released_mine',");
  });
});

describe('ภาพเอกสารไม่ชัด ⇒ กดถัดไปไม่ได้', () => {
  it('มีคำเตือนคุณภาพภาพ = ขั้นแนบภาพไม่ผ่าน', () => {
    const f = blankForm();
    f.noticeAccepted = true;
    const file = { id: 'f1', kind: 'id', name: 'id.jpg' } as never;
    f.slots = {
      id: { file, status: 'done', result: null, imageConfirmed: true, quality: ['ภาพเบลอ ถือเครื่องให้นิ่งแล้วถ่ายใหม่'] },
      license: { file, status: 'done', result: null, imageConfirmed: true, quality: [] },
      house: { file, status: 'manual', result: null, imageConfirmed: true, quality: [] },
    } as never;
    expect(stepError(f, 0, { today: '2026-11-24', documents: [] })).toBe('บัตรประชาชน ด้านหน้า: ภาพเบลอ ถือเครื่องให้นิ่งแล้วถ่ายใหม่');
    (f.slots as Record<string, { quality: string[] }>).id.quality = [];
    expect(stepError(f, 0, { today: '2026-11-24', documents: [] })).toBeNull();
  });
});
