/**
 * แผงรายละเอียดด้านขวาตอนกดการ์ดตัวเลขบนหน้าทีม Online (รอบ 4 · 29 ก.ย. 2569)
 *
 * เจ้าของ: *"การ์ดพวก คนใช้งาน · ทุก BU ฉันกดไปไม่มีไรเลย"* → Choice "แผงเลื่อนออกด้านขวา"
 * การ์ดแต่ละใบเปิดส่วนที่ตอบคำถามต่อจากเลขนั้น (ตัวส่วนชุดเดียวกับแท็บล่าง — `TeamOnlineSections.tsx`):
 * - คนใช้งาน → % ต่อ BU + บทบาท + รายชื่อ (รายชื่อเฉพาะหัวหน้า/admin — เซิร์ฟเวอร์ตัดสิน)
 * - ใบขอเข้า → อัตราต่อ BU + ใบนั้นไปติดขั้นไหน
 * - ผู้สมัครใหม่ → มาจากไหน · มาแล้วยังไง + ใบที่ยังไม่มีผู้สมัคร
 * - Lumos โทร / Success rate → ตาราง Lumos ทุกเลน (เปิดมาที่เรื่องของการ์ดนั้น)
 * - Success ประกาศ → ใบที่ Gen link แล้วได้ผู้สมัคร + ใบที่ยังเงียบ
 *
 * ใช้ Sheet ของ shadcn (ไม่ซ้อน Dialog) · กดย้อนกลับ = ปิดแผง (ผูกไว้ใน `ui/sheet.tsx` แล้ว)
 */
import React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { METRICS, type MetricKey } from '@/lib/metricDictionary';
import { teamWindowText, type TeamOnlineResponse } from '@/lib/teamOnline';
import { trendBuLabel } from '@/lib/trends/bu';
import {
  ApplicantsSection,
  FunnelSection,
  LumosSection,
  NoApplicantsSection,
  RequestsSection,
  SuccessSection,
  UsersSection,
} from './TeamOnlineSections';

export type TeamDetailKey = 'users' | 'positions' | 'applicants' | 'called' | 'postings' | 'successRate';

const TITLE: Record<TeamDetailKey, MetricKey> = {
  users: 'teamOnline.users',
  positions: 'teamOnline.positionsIn',
  applicants: 'teamOnline.applicantsIn',
  called: 'teamOnline.lumosCalled',
  postings: 'teamOnline.postingSuccess',
  successRate: 'teamOnline.successRate',
};

function Body({ open, data, loading }: { open: TeamDetailKey; data: TeamOnlineResponse | null; loading: boolean }) {
  switch (open) {
    case 'users':
      return <UsersSection data={data} loading={loading} />;
    case 'positions':
      return (
        <>
          <RequestsSection data={data} loading={loading} />
          <FunnelSection data={data} loading={loading} />
        </>
      );
    case 'applicants':
      return (
        <>
          <ApplicantsSection data={data} loading={loading} />
          <NoApplicantsSection data={data} loading={loading} />
        </>
      );
    case 'called':
      return <LumosSection data={data} loading={loading} initialMetric="called" />;
    case 'successRate':
      return <LumosSection data={data} loading={loading} initialMetric="rate" />;
    case 'postings':
      return (
        <>
          <SuccessSection data={data} loading={loading} />
          <NoApplicantsSection data={data} loading={loading} />
        </>
      );
  }
}

const TeamDetailSheet: React.FC<{
  /** การ์ดที่กดล่าสุด — ปิดแผงแล้วยังค้างค่าไว้ (แผงเลื่อนออกอยู่ครู่หนึ่ง ไม่ให้เนื้อหาว่างวาบก่อนหายไป) */
  detail: TeamDetailKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: TeamOnlineResponse | null;
  loading: boolean;
}> = ({ detail, open, onOpenChange, data, loading }) => {
  const w = data?.window ?? null;
  const buText = data?.bu ? trendBuLabel(data.bu) : 'ทุก BU';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full space-y-4 overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{detail ? METRICS[TITLE[detail]].label : 'รายละเอียด'}</SheetTitle>
          <SheetDescription className="tabular-nums">{w ? `${teamWindowText(w)} · ${buText}` : buText}</SheetDescription>
        </SheetHeader>
        {detail ? <Body open={detail} data={data} loading={loading && !data} /> : null}
      </SheetContent>
    </Sheet>
  );
};

export default TeamDetailSheet;
