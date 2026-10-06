import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { fetchPublicPostingByCode, type PublicPostingInfo } from '@/lib/recruitPostingsApi';
import PublicApplyDialog from '@/components/jobs/PublicApplyDialog';
import PublicPostingPreview from '@/components/jobs/PublicPostingPreview';
import PublicJobCardPreview from '@/components/jobs/PublicJobCardPreview';
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';
import { boardCardPlace } from '@/lib/boardCardFacts';

/**
 * หน้าเปิดจากลิงก์ที่เจ้าหน้าที่สร้าง — /apply/p/<code>
 *
 * แสดงรายละเอียดจาก "ประกาศ" (ไม่ใช่จากใบขอตรง ๆ) เพราะข้อความที่ผู้สมัครควรเห็น
 * ถูกเขียนไว้ตอนสร้างลิงก์ · ใบสมัครที่ส่งจะพก postingId/linkId ไปด้วย
 * ทำให้รู้ว่าคนนี้มาจากช่องทางไหน
 */
const PublicPostingApplyPage: React.FC = () => {
  const { code = '' } = useParams();
  const [info, setInfo] = useState<PublicPostingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void fetchPublicPostingByCode(code)
      .then((data) => {
        if (cancelled) return;
        if (!data) setNotFound(true);
        else setInfo(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" aria-hidden />
        <p className="text-sm text-muted-foreground">กำลังเปิดลิงก์…</p>
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-base font-medium text-foreground">ลิงก์นี้ใช้ไม่ได้แล้ว</p>
        <p className="text-sm text-muted-foreground">
          ลิงก์อาจถูกยกเลิก หรือพิมพ์มาไม่ครบ — ติดต่อเจ้าหน้าที่ที่ส่งลิงก์ให้คุณได้เลย
        </p>
      </div>
    );
  }

  const closed = info.status === 'closed';
  /**
   * มีใบงาน = การ์ดแบบหน้า /apply (เจ้าของ 6 ต.ค. 2569 "มันต้องเห็นแบบหน้า apply สิ่") — ข้อมูลชุดเดียวกับหน้ารวม
   * ไม่มี (ประกาศลอย/ใบไม่ผ่านด่าน/ปิดรับแล้ว) = การ์ดประกาศเดิม
   */
  const job = !closed && info.job ? enrichJobsWithUrgency([info.job])[0] ?? null : null;

  return (
    // หน้าที่คนนอกเห็น = หน้าตาแบรนด์ที่หรูสุดในระบบ (mockup rev.3 ข้อ 10)
    <div className={job ? 'mx-auto w-full max-w-xl px-4 py-8 sm:py-12' : 'mx-auto w-full max-w-md px-4 py-10 sm:py-14'}>
      {job ? (
        <PublicJobCardPreview
          job={job}
          onApply={() => setApplyOpen(true)}
          // ใบขอไม่มีที่อยู่ = ใช้สถานที่ที่เจ้าหน้าที่พิมพ์ตอน Gen link (ห้ามขึ้น "ยังไม่ระบุสถานที่" ทั้งที่พิมพ์ไว้แล้ว)
          placeText={boardCardPlace(job) === 'ยังไม่ระบุสถานที่' ? info.locationText : null}
          /* 🔴 ไม่แสดงรายละเอียดที่พิมพ์ตอน Gen link ต่อท้าย (6 ต.ค. 2569 — เจ้าของ "เห็นภาพเดียวกันยัง"):
             หน้า /apply ไม่มีกล่องนี้ · ข้อความเดิมมีอิโมจิ + เบอร์เจ้าหน้าที่ + รายได้ที่ขัดกับการ์ด ("15,000-17,000++" กับ 22,969) */
          className="p-5 sm:p-6"
        />
      ) : (
      <PublicPostingPreview
        data={info}
        footer={
          closed ? (
            <p className="mt-6 rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
              ตำแหน่งนี้ปิดรับสมัครแล้ว ขอบคุณที่สนใจครับ
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setApplyOpen(true)}
                className="mt-6 w-full rounded-full bg-night py-3 text-sm font-medium text-white transition-colors hover:bg-night-hover dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                กรอกใบสมัคร
              </button>
              <p className="mt-2.5 text-center text-xs text-muted-foreground">
                ทีมสรรหาติดต่อกลับภายใน 2 วันทำการ
              </p>
            </>
          )
        }
      />
      )}

      <PublicApplyDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        job={job}
        posting={{
          postingId: info.postingId,
          linkId: info.linkId,
          jobId: info.jobId,
          title: info.title,
        }}
      />
    </div>
  );
};

export default PublicPostingApplyPage;
