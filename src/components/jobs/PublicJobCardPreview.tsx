import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle, publicJobCardSubtitle } from '@/lib/unitRequestDisplay';
import { publicJobTitle } from '@/lib/publicJobTitle';
import JobPublicFacts from '@/components/jobs/JobPublicFacts';

/**
 * ═══ "คนนอกจะเห็นแบบนี้" — การ์ดใบงานบนหน้าสมัครสาธารณะ (/apply) แบบย่อ สำหรับป๊อปประกาศ (2 ต.ค. 2569) ═══
 *
 * 🔴 ทุกช่องใช้ตัวคำนวณชุดเดียวกับการ์ดฝั่งคนนอกใน `JobBoardView` + `api/_handlers/public/jobs.ts`:
 * ข้อมูลงานทั้งก้อน = `JobPublicFacts` (5 ต.ค. 2569 — ตัวเดียวกับการ์ดโพสต์ประกาศ) · ช่องที่ติ๊กซ่อน = `publicFieldVisible`
 * ⇒ แก้ช่องในป๊อปแล้วการ์ดนี้เปลี่ยนตามทันที และตรงกับที่ผู้สมัครจะเห็น
 * ⚠️ ไม่มีของภายใน (เลขที่ใบขอ · ผู้ติดต่อ · ค่าปรับ · อายุงาน) — การ์ดนี้คือมุมมองคนนอกเท่านั้น
 *
 * `onApply` (6 ต.ค. 2569) — หน้าที่เปิดจาก Gen link ใช้การ์ดนี้เป็นของจริง (เจ้าของ "มันต้องเห็นแบบหน้า apply สิ่")
 * ⇒ ปุ่ม "สมัครงาน" กดได้ · ไม่ส่ง = ป้ายตัวอย่างเหมือนเดิม
 */
export default function PublicJobCardPreview({
  job,
  className,
  onApply,
  placeText,
  note,
}: {
  job: JobRequest;
  className?: string;
  onApply?: () => void;
  /** สถานที่ที่เจ้าหน้าที่พิมพ์ตอน Gen link (ใช้เมื่อใบขอไม่มีที่อยู่) */
  placeText?: string | null;
  /** รายละเอียดที่เจ้าหน้าที่เขียนในประกาศ */
  note?: string | null;
}) {
  // ตัวเดียวกับการ์ดหน้าประกาศจริง — ไม่มีสาเหตุที่ขอ/ชื่อคนเก่า (5 ต.ค. 2569)
  const subtitle = publicJobCardSubtitle(job);
  return (
    <Card className={cn('space-y-3 rounded-2xl p-4', className)} data-testid="public-job-preview">
      <div className="space-y-1">
        <h3 className="line-clamp-2 text-base font-medium text-foreground">{jobBoardCardTitle(job)}</h3>
        <p className="line-clamp-2 text-sm font-medium text-primary">{publicJobTitle(job)}</p>
        {subtitle ? <p className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {/* ตัวเดียวกับการ์ดหน้า /apply และการ์ดโพสต์ประกาศ (5 ต.ค. 2569) */}
      <JobPublicFacts job={job} placeText={placeText} />
      {note?.trim() ? <p className="whitespace-pre-line text-sm text-muted-foreground">{note.trim()}</p> : null}
      {onApply ? (
        /* ปุ่มเดียวกับการ์ดหน้า /apply */
        <Button type="button" className="w-full py-2.5 text-sm font-medium" onClick={onApply}>
          สมัครงาน
          <Send className="opacity-90" />
        </Button>
      ) : (
        /* ปุ่มของหน้าสาธารณะ — ในตัวอย่างเป็นแค่ป้าย (กดไม่ได้) */
        <p className="rounded-full bg-primary py-2 text-center text-sm font-medium text-primary-foreground" aria-hidden>
          สมัครงาน
        </p>
      )}
    </Card>
  );
}
