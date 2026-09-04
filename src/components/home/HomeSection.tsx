import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';

/**
 * **เปลือกเดียวของทุกแผงบนหน้าหลัก** — เจ้าของทัก 3 ก.ย. 2569:
 * *"หน้า UI ฉันให้ใช้ Shadcn เพื่อคุม Framework ห้ามสร้าง component เอง
 * ลืมไหม หน้า UI หน้าหลักมันดูสะเปะสะปะ"*
 *
 * ที่มันสะเปะสะปะเพราะ **แต่ละแผงปั้นเปลือกของตัวเอง** (วัดจริงจากโค้ด):
 *   · `LumosCallHealthPanel` → `rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-sm`
 *   · `FollowTodayPanel` → `rounded-2xl border p-4 md:p-5` + สีจาก TONE
 *   · `TeamBoardPanel` → `jarvis-deck rounded-2xl`
 *   · `HomeDigestPanels` / `HomeKpiRow` → ไม่มีเปลือก ลอยอยู่บนพื้น
 * ⇒ มุม/ขอบ/ระยะใน/เงา ไม่ตรงกันเลย กวาดตาแล้วเหมือนมาจากคนละเว็บ
 *
 * 🔴 **ไม่ใช่ component ใหม่ — เป็นการ "ประกอบ" `Card` ของ shadcn**
 * (กติกาห้ามปั้น primitive เอง · Card/CardHeader/CardContent มาจาก `@/components/ui/card`)
 * ทุกแผงบนหน้าหลักต้องผ่านตัวนี้ ⇒ แก้ระยะที่นี่ทีเดียว เปลี่ยนทั้งหน้าพร้อมกัน
 */
const HomeSection: React.FC<{
  /** หัวข้อแผง — ไม่ใส่ = ไม่มีหัว (แผงที่มีหัวของตัวเองอยู่แล้ว) */
  title?: React.ReactNode;
  /** บรรทัดอธิบายใต้หัวข้อ */
  subtitle?: React.ReactNode;
  /** มุมขวาของหัว — ปุ่ม/ชิปสถานะ */
  action?: React.ReactNode;
  className?: string;
  /** ตัดระยะในออก สำหรับแผงที่วางตาราง/กริดเต็มความกว้างเอง */
  flush?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, action, className, flush, children }) => (
  <Card className={cn('overflow-hidden border-border/60', className)}>
    {title ? (
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 px-4 pb-2 pt-4 md:px-5">
        <div className="min-w-0">
          {/* ใช้ระดับตัวอักษรชุดเดียวกันทุกแผง — เดิมหัวแผงตัวเล็กใหญ่ไม่เท่ากัน */}
          <p className={cn('text-sm font-bold', DASH.cellStrong)}>{title}</p>
          {subtitle ? <p className={cn('text-[11px] leading-4', DASH.muted)}>{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </CardHeader>
    ) : null}
    <CardContent className={cn(flush ? 'p-0' : 'px-4 pb-4 pt-3 md:px-5', title && !flush && 'pt-2')}>
      {children}
    </CardContent>
  </Card>
);

export default HomeSection;
