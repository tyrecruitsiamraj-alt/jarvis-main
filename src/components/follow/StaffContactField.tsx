import React from 'react';
import FollowMasterSelect from '@/components/follow/FollowMasterSelect';
import { listStaffContactsCached, type FollowStaffContact } from '@/lib/followStaffContactsApi';

/**
 * ช่อง "เจ้าหน้าที่ที่ติดตาม" — dropdown ชื่อ+เบอร์จากลิสต์กลาง (099)
 * ค่าที่ส่งออกเป็น **เบอร์อย่างเดียว** (`staff_phone` เดิม ไม่แตะ schema)
 *
 * ⚠️ เทียบค่าเดิมกับลิสต์แบบ **ตรงตัว** ไม่ใช้ phoneKey (เลข 9 ตัวท้าย) —
 * เบอร์เจ้าหน้าที่เป็นเบอร์บ้าน/เบอร์ต่อภายในได้ ("021234567 ต่อ 101")
 * เลขท้ายของเบอร์+ต่อ ไม่ใช่ตัวระบุที่เชื่อได้ (มีเทสต์ล็อกไว้ที่ followStaffContacts.test.ts)
 *
 * อยู่ **หน้าตั้งวันเวลา** และมีได้เบอร์ละวัน (เจ้าของสั่ง: ระบุเจ้าของแผนแต่ละวัน)
 * — component นี้ถูกเรียกหลายตัวในหน้าเดียว (id ต้องไม่ซ้ำกัน)
 * การเพิ่มชื่อ/เบอร์อยู่ที่ปุ่ม "เพิ่มเจ้าหน้าที่" ข้างไอคอนปฏิทิน (supervisor+ · ค่ำ-5)
 */
export default function StaffContactField({
  id,
  value,
  onChange,
  label = 'เจ้าหน้าที่ที่ติดตาม (ถ้ามี)',
  reloadSignal,
}: {
  id: string;
  value: string;
  onChange: (phone: string) => void;
  label?: string;
  /** bump เมื่อ dialog จัดการเจ้าหน้าที่เพิ่มคนใหม่ — dropdown จะโหลดลิสต์ใหม่ */
  reloadSignal?: number;
}) {
  return (
    <FollowMasterSelect<FollowStaffContact>
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      reloadSignal={reloadSignal}
      emptyOptionLabel="— ไม่ระบุ —"
      manualPlaceholder="เบอร์ที่ให้ผู้สมัครโทรกลับ เช่น 021234567 ต่อ 101"
      hint="AI จะบอกเบอร์นี้ตอนท้ายสายให้ผู้สมัครโทรกลับ"
      manualInputMode="tel"
      load={listStaffContactsCached}
      toValue={(c) => c.phone}
      toLabel={(c) => `${c.name} — ${c.phone}`}
    />
  );
}
