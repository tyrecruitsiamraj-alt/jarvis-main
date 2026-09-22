import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { fetchPublicPostingByCode, type PublicPostingInfo } from '@/lib/recruitPostingsApi';
import PublicApplyDialog from '@/components/jobs/PublicApplyDialog';
import PublicPostingPreview from '@/components/jobs/PublicPostingPreview';

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

  return (
    // หน้าที่คนนอกเห็น = หน้าตาแบรนด์ที่หรูสุดในระบบ (mockup rev.3 ข้อ 10)
    // การ์ดเดี่ยวกลางจอ · ป้ายทองบรรทัดบน · ปุ่มหมึกเต็มความกว้าง · ปิดท้ายด้วยคำสัญญาว่าจะติดต่อกลับ
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
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

      <PublicApplyDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        job={null}
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
