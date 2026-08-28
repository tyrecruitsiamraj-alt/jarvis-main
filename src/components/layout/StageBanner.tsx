/**
 * แถบ "ขั้นที่ N ของสายพาน" บนหัวหน้า — วางอัตโนมัติจาก path ไม่ต้องแก้ทีละหน้า
 *
 * 🔴 **ปัญหาที่แก้** (audit UX 25 ส.ค. 2569): คนใหม่เปิดหน้าไหนก็ไม่รู้ว่าตัวเองอยู่
 * ตรงไหนของงาน · ชื่อหน้าเดิมเป็นคำเดี่ยว ๆ ("Follow" · "หน่วยงาน") ที่ไม่บอกว่า
 * มาจากขั้นไหนและต่อไปคือขั้นอะไร
 *
 * แถบนี้ตอบ 3 คำถามในบรรทัดเดียว: **นี่ขั้นที่เท่าไหร่ · ขั้นนี้ทำอะไร · ต่อไปคือขั้นอะไร**
 *
 * ═══ 🔴 ยกเว้น: มาจากหน้าอื่นที่ไม่ได้อยู่บนสายพาน (27 ส.ค. 2569) ═══
 *
 * เจ้าของทัก: *"หน้ากล่องงาน พอกดแล้วทำไมไปหน้าใบงาน มันงงนะ"*
 * วัดบนจอจริง: กดการ์ดจากกล่องงาน → หน้าใบขอขึ้นว่า **"ขั้นที่ 1/6 · ใบขอ …
 * ต่อไป: ประกาศรับ →"** ⇒ อ่านเหมือน**ถูกดีดถอยกลับไปขั้น 1 ของอีกแผนก**
 * ทั้งที่คนกำลังทำงานปล่อยประกาศอยู่ที่กล่องงาน (ซึ่งไม่ใช่ขั้นไหนของสายพานเลย)
 *
 * ⇒ ถ้ามี `returnTo` ที่บอกว่ามาจากหน้าไหน **ให้แถบบอกทางกลับ ไม่ใช่บอกเลขขั้น**
 * เจ้าของเคาะเอง: *"ไปหน้าเดิม แต่เลิกหลอกว่าอยู่ขั้น 1"*
 *
 * ⚠️ ตั้งใจ **ไม่แตะหัวข้อเดิมของแต่ละหน้า** — วางเป็นแถบเหนือเนื้อหา
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONVEYOR_STEPS, stepForPath } from '@/lib/soRecruitNav';
import { ORIGIN_LABELS, originFromReturnTo } from '@/lib/stageOrigin';
import { sanitizeUnitReturnTo } from '@/lib/jobUnitSessionState';

const StageBanner: React.FC<{ className?: string }> = ({ className }) => {
  const location = useLocation();
  const { pathname, search } = location;

  /**
   * มาจากไหน — อ่านจาก `returnTo` ที่ผู้พามาแนบไว้ (state ก่อน แล้วค่อย query)
   * ⚠️ ต้องผ่าน `sanitizeUnitReturnTo` เสมอ (กัน open redirect · ตัวเดียวกับที่ปุ่มย้อนกลับใช้)
   */
  const returnTo = React.useMemo(() => {
    const fromState = sanitizeUnitReturnTo(
      (location.state as { returnTo?: string } | null)?.returnTo,
    );
    if (fromState) return fromState;
    return sanitizeUnitReturnTo(new URLSearchParams(search).get('returnTo'));
  }, [location.state, search]);

  const origin = originFromReturnTo(returnTo);

  /* ── มาจากหน้าที่ไม่ได้อยู่บนสายพาน = บอกทางกลับ ไม่ต้องบอกเลขขั้น ── */
  if (origin) {
    const t = ORIGIN_LABELS[origin];
    return (
      <div
        className={cn('mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs', className)}
      >
        {/* ⚠️ แถบนี้เป็น **เบรดครัมบ์** ไม่ใช่ปุ่มย้อนกลับ — คำว่า "กลับไป…" อยู่ที่ปุ่ม
            ในหัวหน้าจอแล้ว (ใส่ทั้งสองที่ = คำเดียวกันขึ้นสองรอบติดกัน) */}
        <Link
          to={returnTo ?? t.path}
          className="shrink-0 font-semibold text-blue-700 hover:underline dark:text-blue-300"
        >
          {t.label}
        </Link>
        <span className="text-muted-foreground/50" aria-hidden>
          ›
        </span>
        <span className="font-semibold text-foreground">ใบนี้</span>
        <span className="hidden min-w-0 flex-1 truncate text-muted-foreground sm:block">
          {t.blurb}
        </span>
      </div>
    );
  }

  const step = stepForPath(pathname, search);
  if (!step) return null;
  /** หน้าถัดไปในลำดับ — อ่านจาก**ลำดับใน array** ไม่ใช่เลขขั้น (เลขขั้นถูกถอดออกแล้ว) */
  const at = CONVEYOR_STEPS.findIndex((s) => s.key === step.key);
  const next = at >= 0 ? (CONVEYOR_STEPS[at + 1] ?? null) : null;

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
      {/* 🔴 **ไอคอน + ชื่อหน้า เป็นชิ้นเดียว ไม่มีเลขขั้น ไม่มี `·` คั่น**
          เจ้าของสั่ง 28 ส.ค. 2569: *"ไม่เอาตัวเลข ขอเป็นสัญลักษณ์ที่บ่งบอกถึงข้อนั้น ๆ
          ไม่ต้องแยก ขอเป็นอันเดียวกัน ตอนนี้มันมีขีดคั่นไว้ไม่เอา"* และ
          *"จะมีชื่อคำนี้ทำไม ในเมื่อมันคือใบขอ ก็ใช้ชื่อใบขอสิ"* */}
      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-foreground">
        <step.icon className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden />
        {step.label}
      </span>
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
