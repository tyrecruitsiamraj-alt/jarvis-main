import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backPath?: string;
  /**
   * คำบนปุ่มย้อนกลับ — 🔴 **ลูกศรเปล่าไม่บอกว่ากลับไปไหน**
   * เจ้าของทัก 27 ส.ค. 2569 ว่ากดจากกล่องงานมาแล้วงงว่าอยู่ไหน ⇒ ปุ่มต้องมีคำ
   * ไม่ส่งมาก็ยังเป็นลูกศรเปล่าเหมือนเดิม (หน้าอื่นทั้งระบบไม่ต้องแก้)
   */
  backLabel?: string;
  actions?: React.ReactNode;
  /**
   * ของที่ต่อท้ายชื่อหน้าในแถวเดียวกัน — เช่นแถบแท็บของหน้างานสรรหา/ติดตาม (เจ้าของสั่ง 4 ต.ค. 2569:
   * *"โพสต์ประกาศ ผู้สมัคร การติดต่อ ติดตามนัดหมาย ภาพรวม ย้ายไปอยู่แถวเดียวกับคำว่า ผู้สมัคร"*) · จอแคบตกบรรทัดเอง
   */
  afterTitle?: React.ReactNode;
  /**
   * ซ่อนชื่อหน้า (+ คำอธิบาย) ให้เหลือ ← + `afterTitle` — เจ้าของสั่ง 4 ต.ค. 2569 *"เอาชื่อหน้าออกดีกว่าดูเยอะไป"*
   * (ชื่อแท็บที่เลือกอยู่บอกแล้วว่าอยู่ไหน) · ชื่อยังอยู่สำหรับโปรแกรมอ่านหน้าจอ (sr-only)
   */
  hideTitle?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  backPath,
  backLabel,
  actions,
  afterTitle,
  hideTitle = false,
}) => {
  const navigate = useNavigate();

  return (
    /*
      จอเล็ก: ให้แถวตกบรรทัดได้ ไม่งั้นช่อง actions (ซึ่งเดิมเป็น `shrink-0`)
      จะดันตัวเองออกนอกจอ — เจอที่ /jobs/list บนจอ 320px ล้นออกไป 16px
      กระทบทุกหน้าที่ส่ง actions มา ไม่ใช่หน้าเดียว จึงแก้ที่ตัวกลางนี้
    */
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 md:px-6 py-4 md:py-5">
      {/* 🔴 ชื่อ+คำอธิบายกว้างไม่ต่ำกว่า min-w-40 — ถ้าต่ำกว่านั้น actions ต้อง "ตกบรรทัด" ไปใต้ชื่อ
          (เดิม min-w-0 + flex-1 ⇒ ฐานกว้าง 0 แถวเลยไม่เคยตกบรรทัด · 28 ก.ย. 2569 เจอที่กล่องงานบนจอ 375px:
          ปุ่ม 3 ตัวดันชื่อหน้าหายไป คำอธิบายถูกบีบเหลือคำละบรรทัด) · หน้าที่ปุ่มเล็กยังอยู่แถวเดียวกับชื่อเหมือนเดิม */}
      <div className={cn('flex items-center gap-3', afterTitle ? 'order-1 shrink-0' : 'min-w-40 flex-1')}>
        {backPath && (
          <button
            type="button"
            onClick={() => navigate(backPath)}
            aria-label={backLabel ? undefined : 'ย้อนกลับ'}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border border-transparent text-muted-foreground transition-all touch-manipulation hover:border-white/80 hover:bg-white/60 hover:text-foreground',
              backLabel ? 'px-3 py-2 text-sm font-medium' : 'p-2.5',
            )}
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            {backLabel ? <span className="whitespace-nowrap">{backLabel}</span> : null}
          </button>
        )}
        {hideTitle ? (
          <h1 className="sr-only">{title}</h1>
        ) : (
          <div className={afterTitle ? 'shrink-0' : 'min-w-0'}>
            <h1 className="text-lg md:text-xl font-medium tracking-tight text-foreground truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        )}
      </div>
      {/* แท็บต่อท้ายชื่อ: จอคอม = แถวเดียวกับ ← และปุ่ม · มือถือ = ลงแถวถัดไปเต็มกว้าง (แถวแรกเหลือ ← กับปุ่ม)
          ไม่งั้นจอ 375 เห็นแท็บแค่ 1–2 อัน (4 ต.ค. 2569) */}
      {afterTitle ? <div className="order-3 min-w-0 basis-full md:order-2 md:basis-0 md:flex-1">{afterTitle}</div> : null}
      {actions && (
        <div className={cn('flex min-w-0 max-w-full flex-wrap items-center gap-2', afterTitle && 'order-2 md:order-3')}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
