/**
 * แถบ "ขั้นที่ N ของสายพาน" บนหัวหน้า — วางอัตโนมัติจาก path ไม่ต้องแก้ทีละหน้า
 *
 * 🔴 **ปัญหาที่แก้** (audit UX 25 ส.ค. 2569): คนใหม่เปิดหน้าไหนก็ไม่รู้ว่าตัวเองอยู่
 * ตรงไหนของงาน · ชื่อหน้าเดิมเป็นคำเดี่ยว ๆ ("Follow" · "หน่วยงาน") ที่ไม่บอกว่า
 * มาจากขั้นไหนและต่อไปคือขั้นอะไร
 *
 * แถบนี้ตอบ 3 คำถามในบรรทัดเดียว: **นี่ขั้นที่เท่าไหร่ · ขั้นนี้ทำอะไร · ต่อไปคือขั้นอะไร**
 *
 * ⚠️ ตั้งใจ **ไม่แตะหัวข้อเดิมของแต่ละหน้า** — วางเป็นแถบเหนือเนื้อหา
 * (แก้หัวข้อในหน้า 4,826 บรรทัดอย่าง MatchingPage = เสี่ยงเกินความจำเป็นของงานจัดเมนู)
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONVEYOR_STEPS, stepForPath } from '@/lib/soRecruitNav';

const StageBanner: React.FC<{ className?: string }> = ({ className }) => {
  const { pathname, search } = useLocation();
  const step = stepForPath(pathname, search);
  if (!step) return null;
  const next = CONVEYOR_STEPS.find((s) => s.step === step.step + 1) ?? null;

  return (
    /*
      แถบเปล่า ไม่มีกรอบ ไม่มีพื้น — เป็น "ป้ายกำกับ" ไม่ใช่การ์ดอีกใบ
      (เจ้าของทัก 26 ส.ค. 2569 ว่าต้นแบบสะอาดตากว่า · กล่องซ้อนกล่องคือต้นเหตุหนึ่ง)
    */
    <div
      className={cn(
        'mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs',
        className,
      )}
    >
      <span className="font-mono font-semibold text-blue-700 dark:text-blue-300">
        ขั้นที่ {step.step}/6
      </span>
      <span className="text-muted-foreground/50" aria-hidden>
        ·
      </span>
      <span className="font-semibold text-foreground">{step.label}</span>
      <span className="hidden min-w-0 flex-1 truncate text-muted-foreground sm:block">
        {step.blurb}
      </span>
      {next ? (
        <Link
          to={next.path}
          className="ml-auto flex shrink-0 items-center gap-1 font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          ต่อไป: {next.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
};

export default StageBanner;
