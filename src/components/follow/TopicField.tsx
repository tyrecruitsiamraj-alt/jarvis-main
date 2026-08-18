import React from 'react';
import FollowMasterSelect from '@/components/follow/FollowMasterSelect';
import { createFollowTopic, listFollowTopicsCached, type FollowTopic } from '@/lib/followTopicsApi';

/**
 * ช่อง "เรื่องที่จะให้โทรติดตาม" — dropdown จากลิสต์กลาง (100 · เจ้าของสั่ง 18 ส.ค. 2569:
 * *"Dropdown เลือกเรื่องที่จะให้โทรติดตาม เช่น ติดตามเริ่มงาน เรียนงาน เบิกเบี้ยเลี้ยง"*)
 *
 * ⚠️ ค่าที่เก็บยังเป็น **ข้อความในช่อง topic เดิม** ไม่ผูก FK — เจ้าหน้าที่ยังพิมพ์เรื่องใหม่
 * เองได้ตอนเจอเคสที่ไม่มีในลิสต์ และรายการเก่า 65 แถวที่ใช้ข้อความอิสระยังอ่านได้ปกติ
 *
 * ⚠️ เรื่องนี้ไปโผล่ใน **บทพูดของ AI** (`buildFollowMessage` ใช้ topic เป็นหัวเรื่อง)
 * ตั้งชื่อเรื่องยาวหรือเป็นประโยคยาว ๆ = สายจริงฟังไม่รู้เรื่อง (server จำกัด 120 ตัวอักษร)
 */
export default function TopicField({
  id,
  value,
  onChange,
  reloadSignal,
}: {
  id: string;
  value: string;
  onChange: (topic: string) => void;
  /** bump เมื่อกล่องจัดการเรื่องบนหน้า Follow เพิ่มเรื่องใหม่ — dropdown จะโหลดลิสต์ใหม่ */
  reloadSignal?: number;
}) {
  return (
    <FollowMasterSelect<FollowTopic>
      id={id}
      label="เรื่องที่จะให้โทรติดตาม"
      value={value}
      onChange={onChange}
      reloadSignal={reloadSignal}
      emptyOptionLabel="— เลือกเรื่อง —"
      manualPlaceholder="เช่น ยืนยันวันเริ่มงาน 15 ส.ค."
      hint="เรื่องนี้ AI จะพูดเป็นหัวเรื่องตอนโทร"
      addTitle="เพิ่มเรื่อง"
      addFields={[
        { key: 'name', label: 'ชื่อเรื่อง', placeholder: 'เช่น ติดตามเบิกเบี้ยเลี้ยง' },
      ]}
      load={listFollowTopicsCached}
      create={(f) => createFollowTopic(f.name ?? '')}
      toValue={(t) => t.name}
      toLabel={(t) => t.name}
    />
  );
}
