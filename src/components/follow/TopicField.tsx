import React from 'react';
import FollowMasterSelect from '@/components/follow/FollowMasterSelect';
import { listFollowTopicsCached, type FollowTopic } from '@/lib/followTopicsApi';

/**
 * ช่อง "เรื่องที่จะให้โทรติดตาม" — dropdown จากลิสต์กลาง (100 · เจ้าของสั่ง 18 ส.ค. 2569:
 * *"Dropdown เลือกเรื่องที่จะให้โทรติดตาม เช่น ติดตามเริ่มงาน เรียนงาน เบิกเบี้ยเลี้ยง"*)
 *
 * ⚠️ ค่าที่เก็บยังเป็น **ข้อความในช่อง topic เดิม** ไม่ผูก FK — เจ้าหน้าที่ยังพิมพ์เรื่องใหม่
 * เองได้ตอนเจอเคสที่ไม่มีในลิสต์ และรายการเก่าที่ใช้ข้อความอิสระยังอ่านได้ปกติ
 *
 * ⚠️ เรื่องนี้ไปโผล่ใน **บทพูดของ AI** (`buildFollowMessage` ใช้ topic เป็นหัวเรื่อง)
 * ตั้งชื่อเรื่องยาวหรือเป็นประโยคยาว ๆ = สายจริงฟังไม่รู้เรื่อง (server จำกัด 120 ตัวอักษร)
 *
 * การเพิ่มเรื่องอยู่ที่ปุ่ม "เพิ่มเรื่อง" ข้างไอคอนปฏิทิน (supervisor+ · ค่ำ-5)
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
  /** bump เมื่อ dialog จัดการเรื่องเพิ่มเรื่องใหม่ — dropdown จะโหลดลิสต์ใหม่ */
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
      load={listFollowTopicsCached}
      toValue={(t) => t.name}
      toLabel={(t) => t.name}
    />
  );
}
