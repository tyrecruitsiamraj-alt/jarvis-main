import { describe, it, expect } from 'vitest';
import { describeUnitEdit, UNIT_EDIT_TITLE, type UnitEditLogItem } from '../../src/lib/unitEditLog';
import { checkApiAccess } from '../../api/_lib/rbac';

/**
 * ประวัติ "ใครแก้อะไรไป" ของใบขอ (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
 * — อ่านจาก audit_logs ที่ handler ฝั่งเขียนบันทึกไว้แล้ว ไม่เพิ่มการเขียนใหม่
 */

function row(over: Partial<UnitEditLogItem>): UnitEditLogItem {
  return {
    id: 'a1',
    user_name: 'somchai@siamraj.com',
    action: 'siamraj_unit_assignment.upsert',
    entity_type: 'siamraj_unit_assignment',
    before: null,
    after: null,
    created_at: '2026-08-18T10:00:00+07:00',
    ...over,
  };
}

describe('describeUnitEdit — ผู้รับผิดชอบ (มีทั้ง before/after → diff ได้)', () => {
  it('โชว์เฉพาะช่องที่เปลี่ยน ไม่พูดถึงช่องที่เท่าเดิม', () => {
    const lines = describeUnitEdit(
      row({
        before: { recruiter_name: 'คิว', screener_name: 'บี', opl_name: null, online_name: null },
        after: { recruiter_name: 'เอ', screener_name: 'บี', opl_name: null, online_name: null },
      }),
    );
    expect(lines).toEqual(['สรรหา: คิว → เอ']);
  });

  it('ค่าว่างโชว์เป็น — ทั้งขาเพิ่มและขาเอาออก', () => {
    expect(
      describeUnitEdit(row({ before: { opl_name: null }, after: { opl_name: 'น้อง' } })),
    ).toEqual(['OPL: — → น้อง']);
    expect(
      describeUnitEdit(row({ before: { opl_name: 'น้อง' }, after: { opl_name: null } })),
    ).toEqual(['OPL: น้อง → —']);
  });

  it('null / undefined / ช่องว่าง นับเป็นค่าเดียวกัน — ไม่ใช่การเปลี่ยน (กันบรรทัดขยะ)', () => {
    expect(describeUnitEdit(row({ before: { opl_name: null }, after: { opl_name: '' } }))).toEqual([]);
    expect(describeUnitEdit(row({ before: { opl_name: '  ' }, after: { opl_name: null } }))).toEqual([]);
  });

  it('ทีม online (บทบาทที่ 4 · migration 097) มีป้ายไทย ไม่หลุดเป็นชื่อคอลัมน์', () => {
    const lines = describeUnitEdit(
      row({ before: { online_name: null }, after: { online_name: 'ทีมโอ' } }),
    );
    expect(lines).toEqual(['ทีม online: — → ทีมโอ']);
  });
});

describe('describeUnitEdit — หมายเหตุ (audit เก็บแค่ after)', () => {
  it('ไม่มี before → บอกเป็น "ค่าหลังแก้" ของช่องที่มีค่า ไม่เดาว่าช่องไหนถูกแตะ', () => {
    const lines = describeUnitEdit(
      row({
        action: 'siamraj_unit_note.upsert',
        entity_type: 'siamraj_unit_note',
        before: null,
        after: { note: 'รอลูกค้ายืนยัน', send_replacement: true, parser_override_text: null, field_overrides: null },
      }),
    );
    expect(lines).toEqual(['โน้ต: รอลูกค้ายืนยัน', 'ส่งคนแทน: ใช่']);
  });

  it('boolean แปลเป็นไทย · object นับจำนวนช่อง (ไม่พ่น JSON ดิบขึ้นจอ)', () => {
    const lines = describeUnitEdit(
      row({
        entity_type: 'siamraj_unit_note',
        before: null,
        after: { send_replacement: false, field_overrides: { total_income: 9000, unit_name: 'x' } },
      }),
    );
    expect(lines).toEqual(['ส่งคนแทน: ไม่', 'ค่าที่แก้ทับจากใบขอ: 2 ช่อง']);
  });
});

describe('describeUnitEdit — ทนของแปลก', () => {
  it('after ไม่ใช่ object = คืน [] ให้ UI ถอยไปโชว์แค่หัวข้อ+คน+เวลา', () => {
    for (const after of [null, undefined, 'ข้อความดิบ', 42, []]) {
      expect(() => describeUnitEdit(row({ after }))).not.toThrow();
    }
    expect(describeUnitEdit(row({ after: null }))).toEqual([]);
    expect(describeUnitEdit(row({ after: 'ข้อความดิบ' }))).toEqual([]);
  });

  it('ช่องที่ไม่รู้จัก (เช่น updated_at ที่ติดมากับ row) ถูกข้าม ไม่โผล่เป็นบรรทัด', () => {
    const lines = describeUnitEdit(
      row({
        before: { status: 'waiting_inform', updated_at: '2026-08-01' },
        after: { status: 'waiting_start', updated_at: '2026-08-18' },
      }),
    );
    expect(lines).toEqual(['สถานะ: รอแจ้งเข้า → รอเริ่มงาน']);
  });

  it('🔴 สถานะทำงานต้องแปลเป็นไทย — audit เก็บรหัสดิบ ปล่อยขึ้นจอคนอ่านไม่รู้เรื่อง', () => {
    const lines = describeUnitEdit(
      row({
        entity_type: 'siamraj_unit_work_status',
        before: null,
        after: { status: 'waiting_inform' },
      }),
    );
    expect(lines).toEqual(['สถานะ: รอแจ้งเข้า']);
  });

  it('รหัสสถานะที่ไม่รู้จัก (เพิ่มใหม่แล้วลืมแปล) ยังโชว์รหัสดิบ ดีกว่าหายเงียบ', () => {
    const lines = describeUnitEdit(
      row({ entity_type: 'siamraj_unit_work_status', before: null, after: { status: 'brand_new_code' } }),
    );
    expect(lines).toEqual(['สถานะ: brand_new_code']);
  });

  it('persons เป็น array ของคน — โชว์ชื่อ ไม่ใช่ "N ช่อง"', () => {
    const lines = describeUnitEdit(
      row({
        entity_type: 'siamraj_unit_work_status',
        before: null,
        after: {
          persons: [
            { first_name: 'มงคลศักดิ์', last_name: 'พรรณรังษี' },
            { first_name: 'สมชาย', last_name: 'ใจดี' },
          ],
        },
      }),
    );
    expect(lines).toEqual(['รายชื่อคน: มงคลศักดิ์ พรรณรังษี, สมชาย ใจดี']);
  });

  it('persons ที่อ่านชื่อไม่ได้ ถอยไปบอกจำนวนคน · array ว่าง = ไม่ใช่การเปลี่ยน', () => {
    expect(
      describeUnitEdit(row({ before: null, after: { persons: [{}, {}] } })),
    ).toEqual(['รายชื่อคน: 2 คน']);
    expect(describeUnitEdit(row({ before: null, after: { persons: [] } }))).toEqual([]);
  });

  it('ทุก entity ที่เส้นประวัติคืนมา ต้องมีป้ายหัวข้อภาษาไทย', () => {
    for (const t of ['siamraj_unit_assignment', 'siamraj_unit_work_status', 'siamraj_unit_note']) {
      expect(UNIT_EDIT_TITLE[t]).toBeTruthy();
    }
  });
});

describe('rbac: siamraj-unit-history', () => {
  it('staff ขึ้นไปอ่านได้ (ประวัติของใบที่ตัวเองดูแล) · opl อ่านได้เพราะ read-only viewer', () => {
    for (const role of ['opl', 'staff', 'supervisor', 'admin'] as const) {
      expect(checkApiAccess(role, 'siamraj-unit-history', 'GET').ok).toBe(true);
    }
  });

  it('เขียนไม่ได้ทุก role ที่ไม่ใช่ admin — handler ตอบ 405 อยู่แล้ว นี่คือชั้นที่สอง', () => {
    expect(checkApiAccess('staff', 'siamraj-unit-history', 'POST').ok).toBe(false);
    expect(checkApiAccess('supervisor', 'siamraj-unit-history', 'POST').ok).toBe(false);
  });
});
