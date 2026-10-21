// @vitest-environment node
/**
 * ═══ ฟอร์ม "เพิ่มข้อมูลผู้สมัคร" (เจ้าของ 21 ต.ค. 2569) ═══
 * 1. ตำแหน่งงานที่สนใจ = เลือกจากใบขอ (ผูก job_id ให้ AI คุยได้) · มี "ยังไม่ระบุ — หาล่วงหน้า"
 * 2. ต้องเลือก ส่ง AI โทร / ไม่ส่ง (ไม่ส่ง = เก็บให้คนคีย์ → แท็บการติดต่อ · AI ไม่โทร)
 * 3. บังคับแค่ชื่อ + เบอร์ ("บางคนแค่มาเม้น ชื่อ เบอร์โทรไว้") · นำเข้า Excel ยังกติกาเดิม
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStaffApplication } from '@/lib/staffApplicationInput';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('บังคับแค่ชื่อ + เบอร์ (ฟอร์มเพิ่มผู้สมัคร)', () => {
  it('🔴 ชื่อ + เบอร์อย่างเดียว = บันทึกได้ (อายุ/เพศ/นามสกุลว่าง)', () => {
    const r = parseStaffApplication({ first_name: 'สมชาย', phone: '0812345678' }, { minimal: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.age).toBeNull();
      expect(r.value.gender).toBeNull();
      expect(r.value.full_name).toBe('สมชาย');
    }
  });

  it('ไม่มีชื่อ / เบอร์ไม่ครบ = ไม่ได้', () => {
    expect(parseStaffApplication({ phone: '0812345678' }, { minimal: true }).ok).toBe(false);
    expect(parseStaffApplication({ first_name: 'ก', phone: '0812' }, { minimal: true }).ok).toBe(false);
  });

  it('กรอกอายุมาแต่ผิดช่วง ยังเตือน (คีย์ปีเกิดผิดช่อง)', () => {
    const r = parseStaffApplication({ first_name: 'ก', phone: '0812345678', age: '2540' }, { minimal: true });
    expect(r).toEqual({ ok: false, message: 'อายุต้องอยู่ระหว่าง 15–80 ปี' });
  });

  it('นำเข้า Excel (ไม่ส่ง minimal) ยังบังคับครบแบบเดิม', () => {
    expect(parseStaffApplication({ first_name: 'ก', phone: '0812345678' })).toEqual({ ok: false, message: 'กรุณากรอกนามสกุล' });
  });

  it('API ฟอร์มเพิ่มผู้สมัครใช้ minimal', () => {
    expect(read('api/_handlers/job-applications.ts')).toContain('parseStaffApplication(b, { minimal: true })');
  });
});

describe('ส่ง AI / ไม่ส่ง', () => {
  const api = read('api/_handlers/job-applications.ts');
  const form = read('src/components/recruit-rm/AddApplicantDialog.tsx');

  it('🔴 ไม่ส่ง = เก็บให้คนคีย์ + call_choice manual ในธุรกรรมเดียวกับ insert (ตัวส่งซ้ำข้าม)', () => {
    const fn = api.slice(api.indexOf('async function createByStaff'));
    const tx = fn.slice(fn.indexOf('dbTransaction'), fn.indexOf('if (repeat)'));
    expect(tx).toContain("claimed_by = case when $2 = 'manual' then $4::uuid");
    expect(tx).toContain('set call_choice = $2');
    expect(read('api/_lib/applicationDispatchRetry.ts')).toContain("(a.call_choice is null or a.call_choice in ('ai', 'auto_ai'))");
  });

  it('ฟอร์มต้องเลือกก่อนบันทึก · มี 2 ตัวเลือก', () => {
    expect(form).toContain("if (!callMode) return setError('เลือกว่าจะส่ง AI โทร หรือเก็บไปโทรเอง');");
    expect(form).toContain("<ToggleGroupItem value=\"ai\">{jobPick === NO_JOB ? 'ส่ง AI โทรเบื้องต้น' : 'ส่ง AI โทร'}</ToggleGroupItem>");
    expect(form).toContain('<ToggleGroupItem value="manual">ไม่ส่ง · เก็บไปโทรเอง</ToggleGroupItem>');
    expect(form).toContain('call_mode: callMode,');
  });

  it('ตำแหน่งงานเลือกจากใบขอ + หาล่วงหน้า · ไม่มีช่องพิมพ์ตำแหน่งเองแล้ว', () => {
    expect(form).toContain("{ value: NO_JOB, label: 'ยังไม่ระบุ — หาล่วงหน้า' }");
    expect(form).toContain('fetchSiamrajUnitRequests(500)');
    expect(form).not.toContain('<JobTitleField');
    expect(form).toContain('job_id: picked?.id ?? fromProp?.id ?? null,');
  });
});
