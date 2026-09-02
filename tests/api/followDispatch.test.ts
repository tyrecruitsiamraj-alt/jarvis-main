import { describe, it, expect } from 'vitest';
import { buildFollowReminderPayload } from '../../api/_lib/lumosDispatch';
import { parseFollowInput, parseFollowEditInput } from '../../api/_handlers/follow';
import { checkApiAccess } from '../../api/_lib/rbac';
import {
  APP_FUNCTIONS,
  isFunctionEnabledForRole,
  primaryFunctionForPath,
  OPL_READ_FUNCTIONS,
} from '../../src/lib/roleFunctions';

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
  it('ส่งของครบให้ Lumos — รอบเดียวคือสายแรก จึงเป็น step แบบ remind', () => {
    const p = buildFollowReminderPayload({
      id: 'e6c1f0aa-1111-4222-8333-444455556666',
      recipient_name: 'นายสมชาย ใจดี',
      recipient_phone: '+66812345678',
      topic: 'ติดตามเริ่มงาน',
      note: null,
      staffName: 'น้ำหวาน',
      unitName: 'ธนาคารกรุงศรีอยุธยา',
      scheduled_at: WHEN,
    });
    // 🔴 ไม่มี `::` ในรหัสอ้างอิง (18 ส.ค. 2569 — Lumos ไม่ขึ้นรายการ) · ตรงกับ person_ref
    expect(p.client_contact_id).toBe('follow-e6c1f0aa-1111-4222-8333-444455556666');
    expect(p.recipient_phone).toBe('+66812345678');
    // เรื่องยังส่งไปเป็น `title` — แค่ไม่ได้อยู่ในบทพูดแล้ว (บทใหม่ 1 ก.ย. 2569)
    expect(p.title).toBe('ติดตามเริ่มงาน');
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0].type).toBe('remind');
    expect(p.steps[0].message).toContain('สยามราชธานี');
    expect(p.steps[0].message).toContain('น้ำหวาน');
    expect(p.steps[0].message).toContain('คุณสมชาย ใจดี');
    expect(p.steps[0].message).toContain('ธนาคารกรุงศรีอยุธยา');
    // เวลาไทย +07:00 (instant เดิม) — ไม่ใช่รูป UTC `Z` แล้ว (18 ส.ค. 2569)
    expect(p.steps[0].scheduled_at).toBe('2026-08-15T09:30:00+07:00');
  });

  /**
   * 🔴 **บทใหม่ 1 ก.ย. 2569 ไม่พูด "เรื่อง" และไม่บอกเบอร์ติดต่อกลับแล้ว**
   * เจ้าของเขียนบทมาคำต่อคำ (อัปเดต Lumos 17:00 น.) และไม่มีสองท่อนนี้อยู่ในบท
   * ⚠️ เบอร์เจ้าหน้าที่ยัง **ส่งไปเป็น `admin_phone`** เหมือนเดิม (เบอร์ที่ AI โทรหาเมื่อ
   * ติดต่อผู้รับไม่ได้) แค่ไม่ได้พูดออกไปให้ผู้รับสายจดอีกต่อไป
   * เทสต์นี้เฝ้าไว้ว่า "ไม่พูด" เป็นของที่ตั้งใจ ไม่ใช่หายไปเพราะบั๊ก
   */
  it('บทใหม่ไม่พูดเรื่องที่กรอกและไม่อ่านเบอร์ให้ผู้รับสาย', () => {
    const p = buildFollowReminderPayload({
      id: 'abc',
      recipient_name: 'ก',
      recipient_phone: '+66800000000',
      topic: 'ตามเอกสาร',
      note: 'ถามวันสะดวก',
      staffPhone: '021234567',
      scheduled_at: WHEN,
    });
    expect(p.steps[0].message).not.toContain('ตามเอกสาร');
    expect(p.steps[0].message).not.toContain('ถามวันสะดวก');
    expect(p.steps[0].message).not.toContain('02 123 4567');
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

describe('parseFollowInput — สายที่เท่าไหร่ (113)', () => {
  const body = {
    recipient_name: 'ทดสอบ ระบบ',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    scheduled_at: '2026-09-02T09:00:00+07:00',
  };

  it('ไม่ส่งมา = null (ถือเป็นสายแรก)', () => {
    expect(parseFollowInput(body).value?.callRound).toBeNull();
  });

  it('รับเลข 1-9', () => {
    expect(parseFollowInput({ ...body, call_round: 2 }).value?.callRound).toBe(2);
    expect(parseFollowInput({ ...body, call_round: '3' }).value?.callRound).toBe(3);
  });

  it('🔴 ค่านอกช่วง/อ่านไม่ออก = ปฏิเสธ ไม่แอบปัดให้', () => {
    expect(parseFollowInput({ ...body, call_round: 0 }).error).toBeTruthy();
    expect(parseFollowInput({ ...body, call_round: 12 }).error).toBeTruthy();
    expect(parseFollowInput({ ...body, call_round: 'สอง' }).error).toBeTruthy();
    expect(parseFollowInput({ ...body, call_round: 1.5 }).error).toBeTruthy();
  });
});

describe('🔴 สิทธิ์ช่องทางรับสมัคร — staff จัดการได้ (เจ้าของสั่ง 2 ก.ย. 2569)', () => {
  /**
   * *"เพิ่มช่องทางหลัก ทางรอง ลบช่องทางหลัก ช่องทางรอง ทำให้ Staff เข้าถึงได้ด้วย"*
   * ⚠️ แยกจากการปล่อยประกาศ (`recruit-postings`) โดยตั้งใจ — ช่องทางเป็นข้อมูลอ้างอิงในบ้าน
   * ส่วนประกาศคือของที่คนนอกเห็น
   */
  it('staff เพิ่ม/ลบช่องทางได้ · opl ยังอ่านได้อย่างเดียว', () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      expect(checkApiAccess('staff', 'recruit-channels', method).ok).toBe(true);
    }
    expect(checkApiAccess('opl', 'recruit-channels', 'GET').ok).toBe(true);
    expect(checkApiAccess('opl', 'recruit-channels', 'POST').ok).toBe(false);
  });

  it('staff ทำได้ทั้งช่องทางและประกาศ/เหตุผล (เจ้าของสั่ง 2 ก.ย. 2569) · opl ยังไม่ได้', () => {
    expect(isFunctionEnabledForRole('staff', 'recruit_channels_manage')).toBe(true);
    expect(isFunctionEnabledForRole('staff', 'recruit_postings')).toBe(true);
    expect(isFunctionEnabledForRole('opl', 'recruit_channels_manage')).toBe(false);
    expect(isFunctionEnabledForRole('opl', 'recruit_postings')).toBe(false);
  });

  it('เหตุผลปฏิเสธ: staff แก้ได้ · opl อ่านได้อย่างเดียว', () => {
    expect(checkApiAccess('staff', 'recruit-reasons', 'POST').ok).toBe(true);
    expect(checkApiAccess('opl', 'recruit-reasons', 'GET').ok).toBe(true);
    expect(checkApiAccess('opl', 'recruit-reasons', 'POST').ok).toBe(false);
  });
});
