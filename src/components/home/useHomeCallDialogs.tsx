/**
 * ═══ ป๊อปผลโทรของหน้าหลัก — ผลจากการโทร · รายชื่อรอผล · รายละเอียดคน + จองตัว ═══
 *
 * ย้ายมาจาก `src/pages/HomePage.tsx` 29 ก.ย. 2569 (ย้ายเนื้ออย่างเดียว) ให้หน้าหลักโฉม 3 ก้อนใช้ตัวเดียวกัน
 * — ปุ่ม "จองตัวเลย" (ฟีเจอร์ 12 ส.ค. 2569) ห้ามหายจากหน้าไหน
 *
 * 🔴 **เลิกซ้อน Dialog ใน Dialog** (กติกา UI ของเจ้าของ) — ของเดิมเปิดรายละเอียดคนทับป๊อปรายชื่อ
 * ⇒ กดชื่อ = ปิดป๊อปรายชื่อแล้วเปิดรายละเอียดคน (เรียงกัน ไม่ซ้อน) · มีปุ่ม "กลับไปรายชื่อ" ให้กดคนถัดไปได้เหมือนเดิม
 */
import React, { useState } from 'react';
import ToneDot from '@/components/shared/ToneDot';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Phone, PhoneCall, PhoneForwarded } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { callBoxCount, callBoxTruncated, type FlowFollowUpItem, type FlowSummary } from '@/lib/flowSummaryApi';
import { CALL_BOX_META, FOLLOW_UP_TONE, type FollowUpTone } from '@/lib/homeCallDigest';
import { bookingActionFor, bookingTargetFromPersonRef } from '@/lib/callResultBooking';
import { ProposalConflictError, saveProposal } from '@/lib/candidateProposalsApi';
import FollowUpList from '@/components/home/FollowUpList';

/**
 * 🔴 โทน/ป้าย/ตัวสร้างสรุปของ 4 กล่องผลโทร **อยู่ที่ `@/lib/homeCallDigest`**
 * — บอร์ดทีมกับป๊อปนี้ต้องอ่านชุดเดียวกัน · ที่เหลือไว้ในไฟล์จอคือ **ไอคอน** อย่างเดียว
 */
const CALL_BOX_ICON = {
  confirmed: PhoneCall,
  retry: PhoneForwarded,
  needs_human: AlertTriangle,
  declined: Phone,
} as const;

type PersonDetail = { item: FlowFollowUpItem; tone: FollowUpTone; back: 'results' | 'active' | null };

export function useHomeCallDialogs(opts: { flow: FlowSummary | null; reloadFlow: () => void }): {
  openCallResults: () => void;
  openActiveCalls: () => void;
  openPerson: (item: FlowFollowUpItem, tone: FollowUpTone) => void;
  dialogs: React.ReactNode;
} {
  const { flow, reloadFlow } = opts;
  const navigate = useNavigate();
  const { user } = useAuth();
  // กดขั้น "ผลจากการโทร" → dialog 4 กล่อง (สนใจ/รอโทรซ้ำ/ต้องเร่งจัดการ/ไม่สนใจ) พร้อมชื่อคน
  const [callResultsOpen, setCallResultsOpen] = useState(false);
  // กดขั้น "ส่ง AI โทร" → dialog รายชื่อคนที่ถูกส่งไปแล้วและยังไม่มีผลกลับ
  const [activeCallsOpen, setActiveCallsOpen] = useState(false);
  // กดชื่อคนในกล่องผลโทร → เปิดรายละเอียดคน + งานที่แมทไป ก่อนตัดสินใจเปิดใบขอ
  const [personDetail, setPersonDetail] = useState<PersonDetail | null>(null);
  /**
   * ปุ่ม "จองตัวเลย" ในกล่อง "สนใจงาน" — ปลายทางที่ `CALL_RESULT_DESTINATION.confirmed`
   * สัญญาไว้ว่า "เข้าเส้นจองตัว" (ดู src/lib/callResultBooking.ts)
   * เก็บคีย์ที่จองแล้วไว้เพื่อกันกดซ้ำ — flow-summary จะตัดคนที่จองแล้วออกจากกล่องเองตอนโหลดใหม่
   */
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookedKeys, setBookedKeys] = useState<Record<string, true>>({});
  const [bookingError, setBookingError] = useState<string | null>(null);

  /** คีย์กันกดซ้ำ — คนเดียวโผล่ได้หลายใบขอ จึงต้องผูกกับใบด้วย ไม่ใช่แค่ตัวคน */
  const bookingKeyOf = (item: FlowFollowUpItem) => `${item.job_ref}::${item.person_ref}`;

  /** เปิดรายละเอียดคน — ปิดป๊อปรายชื่อก่อนเสมอ (ห้ามซ้อน) · ล้าง error ของคนก่อนหน้า */
  const showPerson = (item: FlowFollowUpItem, tone: FollowUpTone, back: PersonDetail['back']) => {
    setCallResultsOpen(false);
    setActiveCallsOpen(false);
    setBookingError(null);
    setPersonDetail({ item, tone, back });
  };

  /**
   * จองตัวจากผลโทร "สนใจ" — ใช้เส้นเดียวกับปุ่มจองในหน้า Matching (`saveProposal`)
   * จึงติดกติกาเดิมครบ: 1 คนจองได้ใบเดียว (backend ตอบ 409 พร้อมบอกว่าติดใบไหน)
   */
  const bookFromCallResult = async (item: FlowFollowUpItem) => {
    const target = bookingTargetFromPersonRef(item.person_ref);
    if (!target || bookingBusy) return;
    setBookingBusy(true);
    setBookingError(null);
    try {
      await saveProposal({
        jobId: item.job_ref,
        requestNo: item.request_no || null,
        source: target.source,
        candidateRef: target.candidateRef,
        candidateName: item.name,
        candidatePhone: item.phone,
        // ⚠️ ไม่ส่ง candidatePosition — `job_position` คือตำแหน่งของ **ใบขอ** ไม่ใช่ของผู้สมัคร
        operatorName: user?.full_name || user?.username || null,
        status: 'reserved',
      });
      setBookedKeys((prev) => ({ ...prev, [bookingKeyOf(item)]: true }));
      // กล่อง "สนใจงาน" นับเฉพาะคนที่ยังไม่มีใครรับช่วงต่อ — โหลดใหม่แล้วคนนี้จะหลุดออกเอง
      reloadFlow();
    } catch (e) {
      if (e instanceof ProposalConflictError) {
        const where = e.conflict.request_no || e.conflict.job_id;
        setBookingError(`จองไม่ได้ — ติดจองอยู่กับใบขอ ${where} อยู่แล้ว ต้องยกเลิกใบนั้นก่อน`);
      } else {
        setBookingError(e instanceof Error ? e.message : 'จองตัวไม่สำเร็จ');
      }
    } finally {
      setBookingBusy(false);
    }
  };

  const goBack = (back: PersonDetail['back']) => {
    setPersonDetail(null);
    if (back === 'results') setCallResultsOpen(true);
    if (back === 'active') setActiveCallsOpen(true);
  };

  const dialogs = (
    <>
      {/* dialog "ผลจากการโทร" — 4 กล่องปลายทางพร้อมชื่อคน (เจ้าของกำหนดชุดกล่อง 12 ส.ค. 2569)
          กดชื่อ → ปิดป๊อปนี้แล้วเปิดรายละเอียดคน (ไม่ซ้อน) */}
      <Dialog open={callResultsOpen} onOpenChange={setCallResultsOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">ผลจากการโทร — ใครอยู่ปลายทางไหน</DialogTitle>
            <DialogDescription>
              สนใจคือของค้างทั้งหมดที่ยังไม่มีใครรับช่วง · ไม่สนใจนับของเดือนนี้ · รอโทรซ้ำ/ต้องเร่งจัดการคือของค้างตอนนี้ · กดชื่อเพื่อดูรายละเอียด
            </DialogDescription>
          </DialogHeader>
          {flow ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CALL_BOX_META.map(({ key, label, tone }) => {
                const Icon = CALL_BOX_ICON[key];
                const items = flow.call_boxes[key];
                const t = FOLLOW_UP_TONE[tone];
                /* 🔴 ยอดจริงจาก `call_box_counts` — ไม่ใช่ `items.length` ที่ SQL ตัดไว้ที่ 50 */
                const total = callBoxCount(flow, key);
                return (
                  <div key={key} className={cn('rounded-2xl border p-3', TONE[t.tone].soft)}>
                    <div className={cn('flex items-center gap-1.5 text-xs font-medium', TONE[t.tone].num)}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {label} ({total.toLocaleString('th-TH')})
                    </div>
                    {callBoxTruncated(flow, key) ? (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        แสดง {items.length} รายแรกจาก {total.toLocaleString('th-TH')}
                      </p>
                    ) : null}
                    <FollowUpList items={items} tone={tone} max={5} onOpen={(it) => showPerson(it, tone, 'results')} />
                  </div>
                );
              })}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* dialog "ส่ง AI โทร" — รายชื่อคนที่ถูกส่งไปแล้วตอนนี้ (ยังไม่มีผลกลับ)
          แถวที่ค้างเกิน 2 วันขึ้นธงแดงให้เช็คกับทีม Lumos */}
      <Dialog open={activeCallsOpen} onOpenChange={setActiveCallsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            {/* ยอดจริงมาจากตัวนับในคิว ไม่ใช่ความยาวลิสต์ — ลิสต์ถูกตัดที่ 100 รายการแรก */}
            <DialogTitle className="text-foreground">
              ส่ง AI โทร — รายชื่อที่รอผลอยู่ตอนนี้ (
              {((flow?.lumos.waiting_call ?? 0) + (flow?.lumos.delivered_waiting ?? 0)).toLocaleString('th-TH')})
            </DialogTitle>
            <DialogDescription>
              เรียงคนที่ค้างนานขึ้นก่อน · จุดแดง = เกิน 2 วันยังไม่มีผลกลับ ควรเช็คกับทีม Lumos
              {flow && flow.lumos.waiting_call + flow.lumos.delivered_waiting > flow.active_calls.length
                ? ` · โชว์ ${flow.active_calls.length} รายการแรก`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {flow ? (
            flow.active_calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีสายที่รอผลอยู่ตอนนี้</p>
            ) : (
              <div className="space-y-1">
                {flow.active_calls.map((it) => (
                  <button
                    key={`${it.job_ref}:${it.person_ref}`}
                    type="button"
                    onClick={() => showPerson(it, it.stale ? 'bad' : 'warn', 'active')}
                    className={cn(
                      'w-full rounded-lg border px-2 py-1.5 text-left',
                      it.stale ? TONE.danger.soft : TONE.primary.soft,
                      it.stale ? TONE.danger.softHover : TONE.primary.softHover,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-medium text-foreground">
                        <ToneDot tone={it.stale ? 'danger' : 'primary'} /> {it.name || it.person_ref}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{it.request_no}</span>
                    </div>
                    {it.stale ? (
                      <p className={cn('mt-0.5 text-[10px] font-medium', TONE.danger.value)}>
                        เกิน 2 วันยังไม่มีผลกลับ — ควรเช็คกับทีม Lumos
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      {/* รายละเอียดคน + แมทกับงานอะไรไป ก่อนเปิดใบขอ */}
      <Dialog open={!!personDetail} onOpenChange={(o) => !o && setPersonDetail(null)}>
        <DialogContent className="max-w-sm">
          {personDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  <ToneDot tone={FOLLOW_UP_TONE[personDetail.tone].tone} />{' '}
                  {personDetail.item.name || personDetail.item.person_ref}
                </DialogTitle>
                <DialogDescription>{FOLLOW_UP_TONE[personDetail.tone].hint}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className={cn('rounded-xl border px-3 py-2.5 space-y-1', TONE.neutral.soft)}>
                  <p className="text-[11px] font-medium text-muted-foreground">แมทกับใบขอ</p>
                  <p className="text-sm font-medium text-foreground">
                    {personDetail.item.job_position || 'ไม่ระบุตำแหน่ง'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {personDetail.item.job_unit || '—'} ·{' '}
                    <span className="font-mono">{personDetail.item.request_no}</span>
                  </p>
                </div>
                <div className={cn('rounded-xl border px-3 py-2.5 space-y-1', TONE.neutral.soft)}>
                  <p className="text-[11px] font-medium text-muted-foreground">ผลการโทรล่าสุด</p>
                  <p className="text-xs leading-relaxed text-foreground">
                    {personDetail.item.summary || 'ยังไม่มีสรุปบทสนทนา'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(personDetail.item.updated_at).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                {/* ปุ่มจอง — เฉพาะกล่อง "สนใจงาน" (tone good) · ปิดปุ่มเมื่อไหร่ต้องมีเหตุผลให้อ่านเสมอ */}
                {personDetail.tone === 'good'
                  ? (() => {
                      const item = personDetail.item;
                      const target = bookingTargetFromPersonRef(item.person_ref);
                      const action = bookingActionFor({
                        target,
                        jobId: item.job_ref,
                        personRef: item.person_ref,
                        alreadyBooked: bookedKeys[bookingKeyOf(item)] === true,
                        busy: bookingBusy,
                      });
                      return (
                        <div className={cn('rounded-xl border px-3 py-2.5 space-y-1.5', TONE.violet.soft)}>
                          <p className={cn('text-[11px] font-medium', TONE.violet.num)}>สนใจงานแล้ว — จองตัวไว้เลย</p>
                          <button
                            type="button"
                            onClick={() => void bookFromCallResult(item)}
                            disabled={action.disabled}
                            className={cn(
                              'w-full rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50',
                              TONE.violet.solid,
                            )}
                          >
                            {bookedKeys[bookingKeyOf(item)] ? 'จองตัวแล้ว' : 'จองตัวเลย'}
                          </button>
                          {action.reason ? <p className="text-[10px] text-muted-foreground">{action.reason}</p> : null}
                          {bookingError ? (
                            <p className={cn('text-[10px] font-medium', TONE.danger.value)}>{bookingError}</p>
                          ) : null}
                        </div>
                      );
                    })()
                  : null}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {personDetail.back ? (
                    <Button type="button" variant="ghost" size="sm" className="mr-auto" onClick={() => goBack(personDetail.back)}>
                      <ArrowLeft aria-hidden /> กลับไปรายชื่อ
                    </Button>
                  ) : null}
                  {personDetail.item.phone ? (
                    <Button asChild variant="secondary" size="sm">
                      <a href={`tel:${personDetail.item.phone}`}>
                        <Phone aria-hidden /> {personDetail.item.phone}
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const jobRef = personDetail.item.job_ref;
                      setPersonDetail(null);
                      navigate(`/matching/match?jobId=${encodeURIComponent(jobRef)}`);
                    }}
                  >
                    เปิดใบขอนี้ →
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );

  return {
    openCallResults: () => setCallResultsOpen(true),
    openActiveCalls: () => setActiveCallsOpen(true),
    openPerson: (item, tone) => showPerson(item, tone, null),
    dialogs,
  };
}
