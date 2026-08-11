import React from 'react';
import { Briefcase, Radio, Link2, MessageSquareWarning, BarChart3 } from 'lucide-react';
import { RM_TOOLBAR_KEYS, RM_TOOLBAR_LABEL, type RmToolbarKey } from '@/lib/recruitRm';

/**
 * แถบปุ่มด้านบนของหน้างานสรรหา (RM) — เหมือนกันทั้งสามแท็บ
 * ตำแหน่งงาน · ช่องทาง · สร้างลิงก์ · เหตุผล · รายงาน
 *
 * ⚠️ ปุ่มพวกนี้เปิดหน้าต่างตั้งค่า/รายงานของระบบเดิม ยังไม่ได้ต่อของจริง
 * ยิง `onOpen(key)` ออกไปให้หน้าจัดการ เพื่อให้เห็นชัดว่าอะไรยังไม่ได้ทำ
 * แทนที่จะเป็นปุ่มกดแล้วเงียบ (อาการที่โปรเจกต์นี้เจ็บมาหลายรอบ)
 *
 * ไอคอนอยู่ในไฟล์นี้ ส่วนคีย์/ป้ายอยู่ที่ `lib/recruitRm.ts` — ไฟล์ component
 * ห้าม export อย่างอื่นนอกจาก component ไม่งั้น eslint เตือน react-refresh
 */
const ICONS: Record<RmToolbarKey, typeof Briefcase> = {
  positions: Briefcase,
  channels: Radio,
  link: Link2,
  reasons: MessageSquareWarning,
  reports: BarChart3,
};

const RmToolbar: React.FC<{ onOpen: (key: RmToolbarKey) => void }> = ({ onOpen }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {RM_TOOLBAR_KEYS.map((key) => {
      const Icon = ICONS[key];
      return (
        <button key={key} type="button" onClick={() => onOpen(key)} className="jarvis-btn-secondary">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {RM_TOOLBAR_LABEL[key]}
        </button>
      );
    })}
  </div>
);

export default RmToolbar;
