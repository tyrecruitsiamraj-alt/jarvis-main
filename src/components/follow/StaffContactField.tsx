import React from 'react';
import FollowMasterSelect from '@/components/follow/FollowMasterSelect';
import {
  createStaffContact,
  listStaffContactsCached,
  type FollowStaffContact,
} from '@/lib/followStaffContactsApi';

/**
 * ช่อง "เจ้าหน้าที่ที่ติดตาม" — dropdown ชื่อ+เบอร์จากลิสต์กลาง (099)
 * ค่าที่ส่งออกเป็น **เบอร์อย่างเดียว** (`staff_phone` เดิม ไม่แตะ schema)
 *
 * ⚠️ เทียบค่าเดิมกับลิสต์แบบ **ตรงตัว** ไม่ใช้ phoneKey (เลข 9 ตัวท้าย) —
 * เบอร์เจ้าหน้าที่เป็นเบอร์บ้าน/เบอร์ต่อภายในได้ ("021234567 ต่อ 101")
 * เลขท้ายของเบอร์+ต่อ ไม่ใช่ตัวระบุที่เชื่อได้ (มีเทสต์ล็อกไว้ที่ followStaffContacts.test.ts)
 *
 * 18 ส.ค. 2569 (ค่ำ-2): ย้ายมาอยู่ **หน้าตั้งวันเวลา** และมีได้เบอร์ละวัน —
 * เจ้าของสั่ง *"ต้องอยู่หน้ากรอกวันที่เวลา เพื่อจะได้ระบุเจ้าของแผนแต่ละวันได้"*
 * component นี้จึงถูกเรียกหลายตัวในหน้าเดียว (id ต้องไม่ซ้ำกัน)
 */
export default function StaffContactField({
  id,
  value,
  onChange,
  label = 'เจ้าหน้าที่ที่ติดตาม (ถ้ามี)',
}: {
  id: string;
  value: string;
  onChange: (phone: string) => void;
  label?: string;
}) {
  return (
    <FollowMasterSelect<FollowStaffContact>
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      emptyOptionLabel="— ไม่ระบุ —"
      manualPlaceholder="เบอร์ที่ให้ผู้สมัครโทรกลับ เช่น 021234567 ต่อ 101"
      hint="AI จะบอกเบอร์นี้ตอนท้ายสายให้ผู้สมัครโทรกลับ"
      addTitle="เพิ่มเจ้าหน้าที่"
      addFields={[
        { key: 'name', label: 'ชื่อเจ้าหน้าที่', placeholder: 'ชื่อเจ้าหน้าที่ เช่น คุณคิว ทีมสรรหา' },
        { key: 'phone', label: 'เบอร์โทร', placeholder: 'เบอร์โทร เช่น 021234567 ต่อ 101', inputMode: 'tel' },
      ]}
      load={listStaffContactsCached}
      create={(f) => createStaffContact(f.name ?? '', f.phone ?? '')}
      toValue={(c) => c.phone}
      toLabel={(c) => `${c.name} — ${c.phone}`}
    />
  );
}
