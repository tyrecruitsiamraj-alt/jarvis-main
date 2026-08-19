import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import UnitRequestTabs, { unitTabPath, type UnitRequestTabId } from '@/components/jobs/UnitRequestTabs';
import EditPostingDialog from '@/components/jobs/EditPostingDialog';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
import RecruitLaneDialog from '@/components/jobs/RecruitLaneDialog';
import { fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import type { RecruitPosting } from '@/lib/recruitPostings';
import type { JobRequest } from '@/types';

/**
 * เส้นงานของใบขอ — แก้ไข / Gen link / หาผู้สมัครเพิ่ม
 * (เจ้าของสั่ง 19 ส.ค. 2569: *"กดอันไหนก็ทำหน้านั้นได้เลย ไม่ต้องทำปุ่มแยกแล้ว"*
 * → ปุ่มสามอันบนการ์ดบอร์ดถูกถอดออก เหลือแค่ "ดูรายชื่อ")
 *
 * 🔴 **ใช้ dialog ตัวเดิมทั้งสามตัว ไม่ได้ก๊อปโค้ดมาทำใหม่** — ของเดิมยังถูกใช้จากที่อื่น
 * (การ์ดกล่องลอย · หน้าอื่น) สองชุดที่ทำงานเหมือนกันคือของที่จะเพี้ยนกันเองวันหลัง
 * ที่นี่แค่เปิดค้างไว้ แล้วปิด = กลับไปแท็บรายละเอียด
 */

type ActionTab = Extract<UnitRequestTabId, 'edit' | 'gen-link' | 'find'>;

/**
 * 🔴 **"หาผู้สมัครเพิ่ม" ต้องกดยืนยันก่อนเสมอ — ห้ามยิงเองตอนเปิดแท็บ**
 * `RecruitLaneDialog` เรียก `send=1` ตั้งแต่เรนเดอร์แรก (มันคือ "ค้นแล้วส่งเลย")
 * ตอนเป็นปุ่มบนการ์ดไม่มีปัญหาเพราะคนตั้งใจกด แต่พอเป็น**แท็บ** คนกดดูเฉย ๆ ได้
 * เจอจริงตอนตรวจ 19 ส.ค. 2569: แค่เปิดแท็บ = ใบ OPL6907129 เข้าคิวโทรจริง 20 คนทันที
 * (ยกเลิก+ลบทันก่อน Lumos ดึง ไม่มีสายไหนโทรออก) · แท็บนี้จึงมีด่านยืนยันคั่นไว้
 */

const UnitRequestActionTabPage: React.FC<{ tab: ActionTab }> = ({ tab }) => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobRequest | null>(null);
  const [posting, setPosting] = useState<RecruitPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** ด่านยืนยันของแท็บ "หาผู้สมัครเพิ่ม" — false = ยังไม่ยิง */
  const [laneStarted, setLaneStarted] = useState(false);

  const backToDetail = useCallback(() => navigate(unitTabPath(id, 'detail')), [id, navigate]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setLaneStarted(false);
    void (async () => {
      try {
        const j = (await fetchSiamrajUnitRequest(id)) as unknown as JobRequest | null;
        if (!alive) return;
        setJob(j);
        // แท็บ "แก้ไข" ต้องมีประกาศก่อน — ใบที่ยังไม่เคยสร้างลิงก์จะไม่มีให้แก้
        if (tab === 'edit' && j) {
          const list = await fetchRecruitPostings({ jobId: j.id });
          if (!alive) return;
          setPosting(list[0] ?? null);
        }
        setError('');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'โหลดใบขอไม่สำเร็จ');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, tab]);

  return (
    <div>
      <PageHeader
        title={job ? jobBoardCardTitle(job) : 'ใบขอ'}
        subtitle={job?.request_no || 'อ่านจาก Siamraj'}
        backPath="/jobs/board"
      />
      <div className="space-y-4 px-4 pb-16 md:px-6">
        {id ? <UnitRequestTabs jobId={id} active={tab} /> : null}

        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> กำลังโหลด…
          </p>
        ) : error ? (
          <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : !job ? (
          <p className="py-6 text-sm text-muted-foreground">ไม่พบใบขอนี้</p>
        ) : tab === 'edit' && !posting ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm dark:bg-slate-900">
            <p className="text-foreground">ใบนี้ยังไม่มีประกาศให้แก้</p>
            <p className="mt-1 text-xs text-muted-foreground">
              กด "Gen link" เพื่อสร้างประกาศก่อน แล้วค่อยกลับมาแก้ได้
            </p>
            <button
              type="button"
              onClick={() => navigate(unitTabPath(id, 'gen-link'))}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              ไปหน้า Gen link
            </button>
          </div>
        ) : tab === 'find' && !laneStarted ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              กดแล้ว AI จะโทรหาคนจริงทันที
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              ระบบจะค้นคนที่ยังไม่สมัครจาก 3 แหล่ง (Checklist · ฐานใหม่ · iRecruit)
              แล้ว<strong>ส่งคนที่ AI แนะนำเข้าคิวโทรเลย</strong> ไม่ได้ค้นมาให้ดูเฉย ๆ
            </p>
            <button
              type="button"
              onClick={() => setLaneStarted(true)}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              ค้นแล้วส่ง AI โทรเลย
            </button>
          </div>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">
            กำลังเปิดหน้า{tab === 'edit' ? 'แก้ไขประกาศ' : tab === 'gen-link' ? 'สร้างลิงก์' : 'หาผู้สมัครเพิ่ม'}…
          </p>
        )}
      </div>

      {/* ปิดหน้าต่าง = กลับไปแท็บรายละเอียด (ไม่ใช่ค้างหน้าเปล่า) */}
      {tab === 'edit' ? (
        <EditPostingDialog posting={posting} onClose={backToDetail} onSaved={backToDetail} />
      ) : null}
      {tab === 'gen-link' ? (
        <GenApplyLinkDialog open={!!job} job={job} onClose={backToDetail} />
      ) : null}
      {/* ⚠️ mount เฉพาะหลังกดยืนยัน — mount เมื่อไหร่ = ยิงเข้าคิวโทรทันที */}
      {tab === 'find' && laneStarted ? (
        <RecruitLaneDialog open={!!job} job={job} onClose={backToDetail} />
      ) : null}
    </div>
  );
};

export default UnitRequestActionTabPage;
