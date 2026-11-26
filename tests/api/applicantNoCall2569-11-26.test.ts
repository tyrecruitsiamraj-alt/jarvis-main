// @vitest-environment node
/**
 * ปุ่ม "ไม่โทร" + เหตุผล → ใบย้ายไปกล่องของเหตุผล (เจ้าของ 26 พ.ย. 2569
 * "เอาเป็นปุ่มคำว่าไม่โทรแล้วกัน แล้วเดี๋ยวพอเลือกเหตุผลจะได้โยนเข้ากล่องนั้นๆไป" · Choice "ตรง ทำเลย")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isNoCallView, noCallTarget, noCallViewOf, ownBoxReasons, type NoCallReason } from '../../src/lib/applicantNoCall';
import { aiSendBlockedReasonOf, isInRmListView, rmShownViewOf } from '../../src/lib/recruitRm';
import { rmRowStatusOf } from '../../src/lib/applicantAiAnswerText';
import { countScrapViews, type ScrapWorkRow } from '../../src/lib/scrapApplicants';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

const REASONS: NoCallReason[] = [
  { id: 1, label: 'เบอร์โทรผิด', box: 'bad_data', active: true, sort: 10 },
  { id: 4, label: 'ไม่ตรงคุณสมบัติ', box: 'own', active: true, sort: 40 },
  { id: 5, label: 'ไม่มีงานที่เหมาะ', box: 'own', active: true, sort: 50 },
  { id: 9, label: 'เลิกใช้แล้ว', box: 'own', active: false, sort: 90 },
];
const app = (x: Partial<PublicApplication>) =>
  ({ id: 'c41f0a52-7d3e-4b1a-9f60-2b8e5d7a1c22', full_name: 'นิรติย์ ฉายอรุณ', status: 'new', job_id: 'siamraj-sql:LAO6911009', created_at: '2026-11-26T06:13:00Z', ...x }) as PublicApplication;

describe('เหตุผล → กล่อง', () => {
  it('เหตุผลไปกล่องตัวเอง = nocall:<id> · ไปกล่องที่มีอยู่ = กล่องนั้น', () => {
    expect(noCallTarget(4, REASONS)).toBe('nocall:4');
    expect(noCallTarget(1, REASONS)).toBe('bad_data');
    expect(noCallTarget(99, REASONS)).toBe('nocall:99');
    expect(isNoCallView('nocall:4')).toBe(true);
    expect(isNoCallView('ready')).toBe(false);
    expect(ownBoxReasons(REASONS).map((r) => r.id)).toEqual([4, 5, 9]);
  });
});

describe('ใบที่กดไม่โทร', () => {
  const own = app({ no_call_reason_id: 4, no_call_label: 'ไม่ตรงคุณสมบัติ', no_call_box: 'own', no_call_by_name: 'แบงค์', no_call_at: '2026-11-26T08:00:00Z', last_call_outcome: 'confirmed', last_call_at: '2026-11-26T07:00:00Z' });
  const mapped = app({ no_call_reason_id: 1, no_call_label: 'เบอร์โทรผิด', no_call_box: 'bad_data' });
  it('อยู่กล่องของเหตุผลก่อนทุกอย่าง (แม้ AI บอกสนใจ) · คนเดียวอยู่กล่องเดียว', () => {
    expect(rmShownViewOf(own)).toBe(noCallViewOf(4));
    expect(isInRmListView(own, 'interested')).toBe(false);
    expect(isInRmListView(own, noCallViewOf(4))).toBe(true);
    expect(rmShownViewOf(mapped)).toBe('bad_data');
  });
  it('ส่ง AI ไม่ได้จนกว่ายกเลิกไม่โทร', () => {
    expect(aiSendBlockedReasonOf(own)).toMatch(/ยกเลิกไม่โทร/);
    expect(aiSendBlockedReasonOf(mapped)).toMatch(/ยกเลิกไม่โทร/);
  });
  it('บรรทัดบนแถว = เหตุผล · บรรทัดล่าง = ใครกด เมื่อไหร่', () => {
    const st = rmRowStatusOf(own);
    expect(st.title).toBe('ไม่ตรงคุณสมบัติ');
    expect(st.detail).toMatch(/^แบงค์ กดไม่โทร · /);
    expect(rmRowStatusOf(mapped)).toMatchObject({ title: 'เบอร์โทรผิด' });
  });
  it('แท็บ Scrap นับกล่องของเหตุผลได้ (ไม่ใช่ NaN)', () => {
    const c = countScrapViews([{ app: own, scrap: null, view: noCallViewOf(4), virtual: false } as ScrapWorkRow]);
    expect(c['nocall:4']).toBe(1);
    expect(c.all).toBe(1);
  });
});

describe('ทุกทางเคารพไม่โทร', () => {
  it('ตัวส่งซ้ำข้าม · ปุ่มส่ง AI ฝั่ง server ข้าม · ตั้งไม่โทรยกเลิกคิวค้าง', () => {
    expect(readFileSync('api/_lib/applicationDispatchRetry.ts', 'utf8')).toContain('and a.no_call_reason_id is null');
    expect(readFileSync('api/_handlers/application-call-choice.ts', 'utf8')).toContain('if (r.no_call_reason_id != null) {');
    expect(readFileSync('api/_lib/applicantNoCall.ts', 'utf8')).toContain('cancelLumosQueueItem(q.job_ref, q.channel, q.person_ref)');
  });
  it('migration เพิ่มอย่างเดียว · lock_timeout สั้น · เส้นลงทะเบียน', () => {
    const sql = readFileSync('migrations/200_applicant_no_call.sql', 'utf8');
    expect(sql).toContain("set lock_timeout = '5s';");
    expect(sql).not.toMatch(/\b(drop|delete|update)\b/i);
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/applicant-no-call': applicantNoCallHandler");
  });
  it('ปุ่มไม่โทรในแถวอยู่ข้างส่ง AI โทร · กดไว้แล้วเป็นยกเลิกไม่โทร', async () => {
    const { RM_ROW_ACTIONS } = await import('../../src/lib/recruitRm');
    expect(RM_ROW_ACTIONS.candidates.indexOf('nocall')).toBe(RM_ROW_ACTIONS.candidates.indexOf('ai') - 1);
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toContain("if (row.no_call_reason_id != null) void pickNoCall(null, [row.id]);");
  });
  it('ไม่มีปุ่มไม่โทรบนแถบเครื่องมือ (ถอด 26 พ.ย. 2569) — เหลือปุ่มในแถว', () => {
    const bar = readFileSync('src/components/recruit-rm/RmSearchBar.tsx', 'utf8');
    expect(bar).not.toContain('rm-no-call');
  });
  it('ป๊อปรายละเอียดผู้สมัครไม่มีกล่องส่งเอกสาร (ถอด 26 พ.ย. 2569) — ปุ่มบนแถวแท็บการติดต่อยังอยู่', () => {
    expect(readFileSync('src/components/recruit-rm/ApplicantContactDialog.tsx', 'utf8')).not.toContain('<SendDocumentsSection');
    expect(readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8')).toContain('<SendDocumentsSection applicationId={docsApp.id} autoCreate />');
  });
});

describe('26 พ.ย. 2569 (ต่อ)', () => {
  it('ป๊อปไม่โทรไม่มีส่วนจัดการเหตุผล — กดเหตุผลแล้วย้ายกล่องเลย', () => {
    const d = readFileSync('src/components/recruit-rm/NoCallDialog.tsx', 'utf8');
    expect(d).not.toContain('no-call-manage');
    expect(d).not.toMatch(/createNoCallReason|updateNoCallReason/);
  });
  it('ย้ายชื่อออกจากการติดต่อได้เฉพาะชื่อที่ยังไม่เคยกดโทร (จอ + server)', () => {
    const h = readFileSync('api/_handlers/application-call-choice.ts', 'utf8');
    expect(h).toContain("if (r.dialed_first_at) {");
    expect(h).toContain('a.no_call_reason_id, a.dialed_first_at');
    const t = readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8');
    expect(t).toContain("if (a === 'release' && r.dialed_first_at) {");
    // คนเก็บ + Supervisor ขึ้นไป ถอยได้ · ลูกทีมถอยใบคนอื่นไม่ได้ (ปุ่มบอกเหตุ)
    expect(t).toContain("} else if (a === 'release' && r.claimed && !r.claimed_by_me && !canReleaseOthers) {");
    expect(h).toContain("const canOthers = req.user.role === 'admin' || req.user.role === 'supervisor';");
    expect(h).toContain('await releaseApplicationCallHolds(r.id, r.claimed_by ?? req.user.sub);');
  });
});

