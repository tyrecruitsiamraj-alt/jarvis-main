import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SearchableSelect from '@/components/shared/SearchableSelect';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import RequestLeadRulesCard from '@/components/jobs/RequestLeadRulesCard';
import { fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import { friendlyErrorText } from '@/lib/friendlyError';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { hasCustomLeadRules, resolveRequestLeadRules } from '@/lib/requestLeadKind';
import { DASH } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

/**
 * ═══ ตั้งค่า › เกณฑ์ความเร่งใบขอ (เจ้าของ 3 พ.ย. 2569) ═══
 * > *"ย้ายไปไว้ที่หน้าตั้งค่าเลยทีเดียวแบบ เลือกใบขอแล้วบอกว่าให้น้ำหนักไปเรื่องไหน"* → Choice "ย้ายช่องตัวเลขแบบเดิม"
 * เดิมเป็นการ์ดพับในหน้าใบขอ (10 ก.ย. 2569) — ย้ายมาทั้งก้อน หน้าใบขอไม่มีแล้ว
 * เลือกใบขอที่เปิดอยู่ → กรอก 4 ตัวเลข (ตัวกรอกเดิม `RequestLeadRulesCard` แบบ embedded) · ใบที่ตั้งเองไว้อยู่รายการล่าง
 */
const optionLabel = (j: JobRequest) => [j.request_no, jobBoardCardTitle(j), publicJobPositionLabel(j)].filter(Boolean).join(' · ');

const RequestLeadRulesTab: React.FC = () => {
  const [jobs, setJobs] = useState<JobRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [pick, setPick] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchSiamrajUnitRequests(500)
      .then((list) => !cancelled && setJobs(list))
      .catch((e) => !cancelled && setError(friendlyErrorText(e, 'โหลดใบขอไม่สำเร็จ')));
    return () => {
      cancelled = true;
    };
  }, [rev]);

  const options = useMemo(
    () => (jobs ?? []).map((j) => ({ value: j.id, label: optionLabel(j), keywords: [j.request_no, j.unit_name].filter(Boolean).join(' ') })),
    [jobs],
  );
  const custom = useMemo(() => (jobs ?? []).filter((j) => hasCustomLeadRules(j.lead_rules)), [jobs]);
  const job = (jobs ?? []).find((j) => j.id === pick) ?? null;

  return (
    <Card variant="solid" className="max-w-2xl space-y-5 p-5" data-testid="lead-rules-settings">
      <h3 className="text-lg font-medium text-foreground">เกณฑ์ความเร่งใบขอ</h3>
      {error ? <LoadErrorNotice message={error} onRetry={() => setRev((n) => n + 1)} /> : null}
      {!jobs && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลดใบขอ…
        </p>
      ) : null}
      {jobs ? (
        <>
          <SearchableSelect
            value={pick}
            onChange={setPick}
            options={options}
            placeholder="เลือกใบขอ"
            searchPlaceholder="ค้นเลขที่ใบขอ หน่วยงาน ตำแหน่ง"
            emptyText="ไม่เจอใบขอ"
            ariaLabel="เลือกใบขอ"
          />
          {job ? (
            <RequestLeadRulesCard
              key={job.id}
              job={job}
              embedded
              onSaved={(rules) => setJobs((list) => (list ? list.map((j) => (j.id === job.id ? { ...j, lead_rules: rules } : j)) : list))}
            />
          ) : null}

          <section className={cn('space-y-2 border-t pt-4', DASH.divider)} data-testid="lead-rules-custom">
            <h4 className={DASH.title}>ใบที่ตั้งเกณฑ์เอง · {custom.length} ใบ</h4>
            {custom.length === 0 ? <p className={DASH.sub}>ยังไม่มีใบที่ตั้งเกณฑ์เอง</p> : null}
            {custom.map((j) => {
              const r = resolveRequestLeadRules(j.lead_rules);
              return (
                <div key={j.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{optionLabel(j)}</span>
                  <span className={cn(DASH.sub, 'tabular-nums')}>
                    แบ่ง {r.urgentThresholdDays} วัน · ให้เวลา {r.slaDays.retroactive}/{r.slaDays.urgent}/{r.slaDays.advance} วัน
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setPick(j.id)}>
                    แก้
                  </Button>
                </div>
              );
            })}
          </section>
        </>
      ) : null}
    </Card>
  );
};

export default RequestLeadRulesTab;
