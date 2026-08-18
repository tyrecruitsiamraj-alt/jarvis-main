import { describe, it, expect } from 'vitest';
import { buildFollowReminderPayload } from '../../api/_lib/lumosDispatch';
import { parseFollowInput, parseFollowEditInput } from '../../api/_handlers/follow';
import { checkApiAccess } from '../../api/_lib/rbac';
import { APP_FUNCTIONS, primaryFunctionForPath, OPL_READ_FUNCTIONS } from '../../src/lib/roleFunctions';

const WHEN = new Date('2026-08-15T09:30:00+07:00');

describe('parseFollowInput', () => {
  const NOW = new Date('2026-07-30T15:00:00+07:00');

  it('ช่องไม่บังคับหายไปทั้งหมดก็ต้องผ่าน (เคยพัง 500 เพราะเว้น note ว่าง)', () => {
    const r = parseFollowInput(
      { recipient_name: 'สมชาย ใจดี', recipient_phone: '0812345678', topic: 'ตามเอกสาร' },
      NOW,
    );
    expect(r.error).toBeNull();
    expect(r.value).not.toBeNull();
    expect(r.value!.note).toBeNull();
    expect(r.value!.phone).toBe('+66812345678');
    expect(r.value!.when.toISOString()).toBe(NOW.toISOString());
  });

  it('note/scheduled_at เป็นค่าว่างหรือชนิดผิด ก็ไม่ throw', () => {
    for (const extra of [{ note: '' }, { note: null }, { note: 123 }, { scheduled_at: '' }, { scheduled_at: null }]) {
      const r = parseFollowInput(
        { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข', ...extra },
        NOW,
      );
      expect(r.error).toBeNull();
      expect(r.value).not.toBeNull();
    }
  });

  it('ตารางโทร (092): group_id uuid + call_times กรอง HH:MM + dedupe + เพดาน 5 รอบ', () => {
    const gid = 'a506aa87-7502-4886-8607-ccbb799b215c';
    const r = parseFollowInput(
      {
        recipient_name: 'ก',
        recipient_phone: '0800000000',
        topic: 'ข',
        group_id: gid,
        call_times: ['07:00', '08:00', '07:00', 'บ่าย', ''],
      },
      NOW,
    );
    expect(r.error).toBeNull();
    expect(r.value!.groupId).toBe(gid);
    expect(r.value!.callTimes).toEqual(['07:00', '08:00']); // dedupe + กรองรูปผิด
  });

  it('ตารางโทร: group_id ผิดรูป → error · call_times เกิน 5 → error', () => {
    expect(
      parseFollowInput(
        { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข', group_id: 'not-uuid' },
        NOW,
      ).error,
    ).toBeTruthy();
    expect(
      parseFollowInput(
        {
          recipient_name: 'ก',
          recipient_phone: '0800000000',
          topic: 'ข',
          call_times: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00'],
        },
        NOW,
      ).error,
    ).toBeTruthy();
  });

  it('ไม่ส่ง group_id/call_times → null ทั้งคู่ (รอบเดี่ยวแบบเดิม)', () => {
    const r = parseFollowInput({ recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข' }, NOW);
    expect(r.value!.groupId).toBeNull();
    expect(r.value!.callTimes).toBeNull();
  });

  it('เก็บ note ที่กรอกมาและ trim ให้', () => {
    const r = parseFollowInput(
      { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข', note: '  ถามวันสะดวก  ' },
      NOW,
    );
    expect(r.value!.note).toBe('ถามวันสะดวก');
  });

  it('ปฏิเสธเมื่อขาดชื่อ / เรื่อง / เบอร์ไม่ถูกต้อง / วันเวลาเพี้ยน', () => {
    expect(parseFollowInput({ recipient_phone: '0812345678', topic: 'ก' }, NOW).error).toContain('ชื่อ');
    expect(parseFollowInput({ recipient_name: 'ก', recipient_phone: '0812345678' }, NOW).error).toContain('เรื่อง');
    expect(parseFollowInput({ recipient_name: 'ก', recipient_phone: '02-123-4567', topic: 'ข' }, NOW).error).toContain('เบอร์');
    expect(
      parseFollowInput(
        { recipient_name: 'ก', recipient_phone: '0812345678', topic: 'ข', scheduled_at: 'ไม่ใช่วันที่' },
        NOW,
      ).error,
    ).toContain('วันเวลา');
    expect(parseFollowInput(null, NOW).error).toBe('Invalid JSON body');
  });

  it('เบอร์เจ้าหน้าที่: ไม่กรอกก็ผ่าน · กรอกแล้วเก็บตามที่พิมพ์ (เบอร์ต่อภายในใช้ได้)', () => {
    // เจ้าของสั่ง 13 ส.ค. 2569 — ช่องนี้แทน "รายละเอียดเพิ่มเติม" เดิม
    // ⚠️ ไม่บังคับ E.164 เพราะเป็นเบอร์ที่ AI **พูดให้ฟัง** ไม่ใช่เบอร์ที่ระบบโทรออก
    const base = { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข' };
    expect(parseFollowInput(base, NOW).value!.staffPhone).toBeNull();
    expect(parseFollowInput({ ...base, staff_phone: '021234567 ต่อ 101' }, NOW).value!.staffPhone).toBe(
      '021234567 ต่อ 101',
    );
    expect(parseFollowInput({ ...base, staff_phone: '' }, NOW).value!.staffPhone).toBeNull();
  });

  it('เบอร์เจ้าหน้าที่ที่ไม่มีตัวเลขพอ ต้องไม่ผ่าน — ผู้สมัครจะโทรกลับไม่ได้', () => {
    const r = parseFollowInput(
      { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข', staff_phone: 'ถามพี่แดง' },
      NOW,
    );
    expect(r.error).toContain('เบอร์เจ้าหน้าที่');
    expect(r.value).toBeNull();
  });

  it('ใช้ scheduled_at ที่ส่งมาเมื่อเป็นวันเวลาที่ถูกต้อง', () => {
    const r = parseFollowInput(
      { recipient_name: 'ก', recipient_phone: '0812345678', topic: 'ข', scheduled_at: '2026-08-15T09:30:00+07:00' },
      NOW,
    );
    expect(r.value!.when.toISOString()).toBe(WHEN.toISOString());
  });
});

describe('buildFollowReminderPayload', () => {
  it('ส่งเรื่องที่กรอกเป็นข้อความให้ Lumos ผ่าน step แบบ follow_up', () => {
    const p = buildFollowReminderPayload({
      id: 'e6c1f0aa-1111-4222-8333-444455556666',
      recipient_name: 'สมชาย ใจดี',
      recipient_phone: '+66812345678',
      topic: 'ยืนยันวันเริ่มงาน 15 ส.ค.',
      note: 'ถ้ายังไม่พร้อมให้ถามวันที่สะดวก',
      scheduled_at: WHEN,
    });
    // 🔴 ไม่มี `::` ในรหัสอ้างอิง (18 ส.ค. 2569 — Lumos ไม่ขึ้นรายการ) · ตรงกับ person_ref
    expect(p.client_contact_id).toBe('follow-e6c1f0aa-1111-4222-8333-444455556666');
    expect(p.recipient_phone).toBe('+66812345678');
    expect(p.title).toBe('ยืนยันวันเริ่มงาน 15 ส.ค.');
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0].type).toBe('follow_up');
    // บทใหม่ 16 ส.ค. 2569 (lumosCallScript.buildFollowMessage) — แนะนำตัว + เรียกชื่อ +
    // บอกให้ยืนยันกลับ · เดิมต่อสามท่อนด้วย "—" เฉย ๆ ฟังแล้วห้วนไม่มีหัวไม่มีท้าย
    expect(p.steps[0].message).toContain('สยามราชธานี');
    expect(p.steps[0].message).toContain('คุณสมชาย ใจดี');
    expect(p.steps[0].message).toContain('ยืนยันวันเริ่มงาน 15 ส.ค.');
    expect(p.steps[0].message).toContain('ถ้ายังไม่พร้อมให้ถามวันที่สะดวก');
    expect(p.steps[0].message).toContain('ยืนยันกลับ');
    // เวลาไทย +07:00 (instant เดิม) — ไม่ใช่รูป UTC `Z` แล้ว (18 ส.ค. 2569)
    expect(p.steps[0].scheduled_at).toBe('2026-08-15T09:30:00+07:00');
  });

  it('ไม่มีหมายเหตุ → ใช้เฉพาะหัวเรื่อง', () => {
    const p = buildFollowReminderPayload({
      id: 'abc',
      recipient_name: 'ก',
      recipient_phone: '+66800000000',
      topic: 'ตามเอกสาร',
      note: null,
      scheduled_at: WHEN,
    });
    expect(p.steps[0].message).toContain('ตามเอกสาร');
    // ไม่มีเบอร์เจ้าหน้าที่ = ไม่พูดท่อนติดต่อกลับ (ไม่ใช่พูดว่า "โทร ว่าง")
    expect(p.steps[0].message).not.toContain('โทร');
  });

  it('มีเบอร์เจ้าหน้าที่ → ต่อท้ายบทพูดให้ผู้สมัครโทรกลับได้', () => {
    // ⚠️ schema ของ Lumos ไม่มีช่องใส่เบอร์ติดต่อกลับ — ช่องเดียวที่ถึงหูผู้สมัคร
    // คือ steps[].message · ถ้าเทสต์นี้ล้มแปลว่าเบอร์หายจากบท ผู้สมัครโทรกลับไม่ได้
    const p = buildFollowReminderPayload({
      id: 'abc',
      recipient_name: 'ก',
      recipient_phone: '+66800000000',
      topic: 'ตามเอกสาร',
      note: null,
      staffPhone: '021234567',
      scheduled_at: WHEN,
    });
    // เบอร์อ่านเป็นกลุ่มตัวเลข — 021234567 ติดกันเสี่ยงถูก TTS อ่านเป็นจำนวนเต็มก้อนเดียว
    expect(p.steps[0].message).toContain('02 123 4567');
  });

  it('มีทั้งหมายเหตุและเบอร์ → พูดครบทั้งสามท่อน เรียงหัวเรื่อง → หมายเหตุ → เบอร์', () => {
    const p = buildFollowReminderPayload({
      id: 'abc',
      recipient_name: 'ก',
      recipient_phone: '+66800000000',
      topic: 'ตามเอกสาร',
      note: 'ถามวันสะดวก',
      staffPhone: '021234567',
      scheduled_at: WHEN,
    });
    const msg = p.steps[0].message;
    expect(msg.indexOf('ตามเอกสาร')).toBeLessThan(msg.indexOf('ถามวันสะดวก'));
    expect(msg.indexOf('ถามวันสะดวก')).toBeLessThan(msg.indexOf('02 123 4567'));
  });
});

describe('follow RBAC', () => {
  it('staff เพิ่ม/ยกเลิกได้ · opl อ่านได้แต่เพิ่มไม่ได้', () => {
    expect(checkApiAccess('staff', 'follow', 'GET').ok).toBe(true);
    expect(checkApiAccess('staff', 'follow', 'POST').ok).toBe(true);
    expect(checkApiAccess('staff', 'follow', 'DELETE').ok).toBe(true);
    expect(checkApiAccess('opl', 'follow', 'GET').ok).toBe(true);
    expect(checkApiAccess('opl', 'follow', 'POST').ok).toBe(false);
  });

  it('เมนู Follow ผูกกับ follow_read และ opl เห็นได้', () => {
    expect(primaryFunctionForPath('/follow')).toBe('follow_read');
    expect(OPL_READ_FUNCTIONS.has('follow_read')).toBe(true);
  });

  it('ฟังก์ชัน Driver Care ถูกถอดออกจากระบบสิทธิ์แล้ว', () => {
    const ids = APP_FUNCTIONS.map((f) => f.id as string);
    expect(ids).toContain('follow_read');
    expect(ids).toContain('follow_manage');
    expect(ids.some((id) => id.startsWith('driver_care'))).toBe(false);
    expect(primaryFunctionForPath('/driver-care')).toBeNull();
  });
});

/**
 * หน่วยงาน + รหัสไซต์ บนรายการ Follow (096 · เจ้าของสั่ง 17 ส.ค. 2569)
 * *"เพิ่มชื่อหน่วยงาน โดยเลือกจากใบงานได้เลย · Code site ถ้าเลือกหน่วยงานก็ให้ขึ้นมาเลย"*
 */
describe('หน่วยงาน/รหัสไซต์ ของรายการติดตาม', () => {
  const NOW = new Date('2026-08-17T20:00:00+07:00');
  const base = { recipient_name: 'สมชาย ใจดี', recipient_phone: '0812345678', topic: 'ตามเอกสาร' };

  it('รับหน่วยงาน + รหัสไซต์ที่ส่งมาคู่กัน', () => {
    const r = parseFollowInput(
      { ...base, unit_name: 'บริษัท แคททาเลอร์ (ประเทศไทย) จำกัด', site_code: '69LBDL0218' },
      NOW,
    );
    expect(r.error).toBeNull();
    expect(r.value!.unitName).toBe('บริษัท แคททาเลอร์ (ประเทศไทย) จำกัด');
    expect(r.value!.siteCode).toBe('69LBDL0218');
  });

  it('ไม่ส่งมาก็ต้องผ่าน — Follow หลายเคสไม่ได้ผูกกับใบขอใด', () => {
    const r = parseFollowInput(base, NOW);
    expect(r.error).toBeNull();
    expect(r.value!.unitName).toBeNull();
    expect(r.value!.siteCode).toBeNull();
  });

  it('ค่าว่าง/ช่องว่างล้วน = ไม่ได้ระบุ (ไม่ใช่ข้อความว่าง)', () => {
    const r = parseFollowInput({ ...base, unit_name: '   ', site_code: '' }, NOW);
    expect(r.error).toBeNull();
    expect(r.value!.unitName).toBeNull();
    expect(r.value!.siteCode).toBeNull();
  });
});

/**
 * แก้ไขรายการติดตาม (096) — *"เพิ่มให้แก้ไขได้"*
 *
 * 🔴 กติกาที่ห้ามหลุด: กติกาความถูกต้องของตอนแก้ต้อง**เหมือนตอนสร้างเป๊ะ**
 * ไม่งั้นแก้ทีหลังจะใส่ค่าที่ตอนสร้างห้ามใส่ได้ (เช่นเบอร์ที่โทรไม่ได้จริง)
 */
describe('parseFollowEditInput', () => {
  const NOW = new Date('2026-08-17T20:00:00+07:00');
  const ok = { recipient_name: 'สมชาย ใจดี', recipient_phone: '0812345678', topic: 'ตามเอกสาร' };

  it('แก้ครบทุกช่องที่แก้ได้', () => {
    const r = parseFollowEditInput(
      {
        ...ok,
        recipient_name: 'สมหญิง ใจงาม',
        note: 'ย้ำเรื่องเอกสาร',
        staff_phone: '021234567',
        unit_name: 'บริษัท ทาทา สตีล',
        site_code: '69LBAL0007',
        scheduled_at: '2026-08-18T09:00:00+07:00',
      },
      NOW,
    );
    expect(r.error).toBeNull();
    expect(r.value!.name).toBe('สมหญิง ใจงาม');
    expect(r.value!.unitName).toBe('บริษัท ทาทา สตีล');
    expect(r.value!.siteCode).toBe('69LBAL0007');
    expect(r.value!.when.toISOString()).toBe('2026-08-18T02:00:00.000Z');
  });

  it('🔴 ตรวจเบอร์เข้มเท่าตอนสร้าง — เบอร์ที่โทรไม่ได้ต้องไม่ผ่าน', () => {
    const r = parseFollowEditInput({ ...ok, recipient_phone: '123' }, NOW);
    expect(r.error).not.toBeNull();
    expect(r.value).toBeNull();
  });

  it('🔴 ชื่อ/เรื่อง ว่างไม่ได้ (เหมือนตอนสร้าง)', () => {
    expect(parseFollowEditInput({ ...ok, recipient_name: '' }, NOW).error).not.toBeNull();
    expect(parseFollowEditInput({ ...ok, topic: '  ' }, NOW).error).not.toBeNull();
  });

  it('🔴 เจ้าของข้อมูลแก้ไม่ได้ — ส่ง created_by_name มาก็ต้องไม่มีผล', () => {
    const r = parseFollowEditInput({ ...ok, created_by_name: 'คนอื่น' }, NOW);
    expect(r.error).toBeNull();
    expect(Object.keys(r.value!)).not.toContain('created_by_name');
    expect(JSON.stringify(r.value)).not.toContain('คนอื่น');
  });

  it('🔴 ตารางโทร (group_id/call_times) แก้ทางนี้ไม่ได้ — ไม่หลุดเข้าไปในค่าที่คืน', () => {
    const r = parseFollowEditInput(
      { ...ok, group_id: '11111111-2222-3333-4444-555555555555', call_times: ['07:00', '08:00'] },
      NOW,
    );
    expect(r.error).toBeNull();
    expect(Object.keys(r.value!)).not.toContain('groupId');
    expect(Object.keys(r.value!)).not.toContain('callTimes');
  });

  it('ไม่ส่งเวลา = ใช้เวลาปัจจุบัน (ไม่ล้มทั้งคำขอ)', () => {
    const r = parseFollowEditInput(ok, NOW);
    expect(r.error).toBeNull();
    expect(r.value!.when.getTime()).toBe(NOW.getTime());
  });
});
