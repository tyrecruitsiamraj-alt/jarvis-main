import React from 'react';
import { Button } from '@/components/ui/button';
import { Radio, Link2, MessageSquareWarning } from 'lucide-react';
import { RM_TOOLBAR_KEYS, RM_TOOLBAR_LABEL, type RmToolbarKey } from '@/lib/recruitRm';

/**
 * แถบปุ่มด้านบนของหน้างานสรรหา (RM) — เหมือนกันทั้งสามแท็บ
 * ช่องทาง · สร้างลิงก์ · เหตุผล (เจ้าของสั่งเอา "ตำแหน่งงาน" กับ "รายงาน" ออก 11 ส.ค. 2569)
 *
 * ทั้งสามปุ่มต่อของจริงครบแล้ว — ยิง `onOpen(key)` ออกไปให้หน้าจัดการเปิด dialog
 *
 * ไอคอนอยู่ในไฟล์นี้ ส่วนคีย์/ป้ายอยู่ที่ `lib/recruitRm.ts` — ไฟล์ component
 * ห้าม export อย่างอื่นนอกจาก component ไม่งั้น eslint เตือน react-refresh
 */
const ICONS: Record<RmToolbarKey, typeof Radio> = {
  channels: Radio,
  link: Link2,
  reasons: MessageSquareWarning,
};

const RmToolbar: React.FC<{ onOpen: (key: RmToolbarKey) => void }> = ({ onOpen }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {RM_TOOLBAR_KEYS.map((key) => {
      const Icon = ICONS[key];
      return (
        <Button variant="secondary" size="sm" key={key} type="button" onClick={() => onOpen(key)} >
          <Icon aria-hidden /> {RM_TOOLBAR_LABEL[key]}
        </Button>
      );
    })}
  </div>
);

export default RmToolbar;
