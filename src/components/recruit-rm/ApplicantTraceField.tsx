import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { apiFetch } from '@/lib/apiFetch';

/**
 * ═══ ป๊อปผู้สมัคร: ไปถึงไหนนอกระบบเรา (เจ้าของ 20 ต.ค. 2569 "ผูกคนที่ผ่านกับ iRecruit และ ERP") ═══
 * ระบบหาเองด้วยเบอร์ (`GET /api/application-trace`) — เป็นผู้สมัครใน iRecruit · แจ้งเข้า ERP · พร้อมวันที่
 * อ่านแหล่งไหนไม่ได้ = "เช็กไม่ได้" (ห้ามบอกว่ายังไม่เจอ)
 */
export type ApplicantTrace = {
  irecruit: { unknown: boolean; at: string | null };
  inform: { unknown: boolean; at: string | null };
  linkChannel: string | null;
};

const DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
const dayText = (ymd: string) => DAY.format(new Date(`${ymd}T12:00:00+07:00`));

export function useApplicantTrace(applicationId: string | null | undefined): ApplicantTrace | null {
  const [trace, setTrace] = useState<ApplicantTrace | null>(null);
  useEffect(() => {
    setTrace(null);
    if (!applicationId) return;
    let alive = true;
    apiFetch(`/api/application-trace?id=${encodeURIComponent(applicationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ApplicantTrace | null) => alive && j && setTrace(j))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [applicationId]);
  return trace;
}

function Item({ label, part }: { label: string; part: { unknown: boolean; at: string | null } }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span>{label}</span>
      <span className={cn('tabular-nums', part.unknown ? 'text-muted-foreground' : part.at ? TONE.success.value : 'text-muted-foreground')}>
        {part.unknown ? 'เช็กไม่ได้' : part.at ? dayText(part.at) : 'ยังไม่เจอ'}
      </span>
    </span>
  );
}

export default function ApplicantTraceField({ trace }: { trace: ApplicantTrace | null }) {
  if (!trace) return <span className="text-muted-foreground">กำลังเช็ก…</span>;
  return (
    <span className="flex flex-col gap-1" data-testid="applicant-trace">
      <Item label="ผู้สมัครใน iRecruit" part={trace.irecruit} />
      <Item label="แจ้งเข้า ERP" part={trace.inform} />
    </span>
  );
}
