import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { RecruitPosting } from '@/lib/recruitPostings';
import { moveRecruitPostingBu } from '@/lib/recruitPostingsApi';

/**
 * ═══ ย้าย BU ของประกาศลอย (เจ้าของ 24 พ.ย. 2569) ═══
 * เลือก BU → "ย้าย BU" → บรรทัดบอกว่าจะย้ายใคร → "ย้ายเลย" · ผู้สมัครของประกาศที่ยังอยู่ BU เดิมย้ายตาม (server `moveStandalonePostingBu`)
 * ใช้ในป๊อป "ทำอะไรไปแล้ว" ของการ์ดกล่องลอย + ป๊อปแก้ไขประกาศ · ประกาศผูกใบขอไม่มีส่วนนี้ (BU ตามใบขอ)
 * บรรทัดผลจองที่ไว้ — กดแล้วของบนจอไม่ขยับ
 */
export default function PostingBuMover({ posting, onMoved }: { posting: RecruitPosting; onMoved?: (updated: RecruitPosting) => void }) {
  const [bu, setBu] = useState(posting.departmentCode ?? '');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    setBu(posting.departmentCode ?? '');
    setConfirm(false);
  }, [posting.id, posting.departmentCode]);
  if (posting.jobId) return null;
  const changed = Boolean(bu) && bu !== (posting.departmentCode ?? '');

  const move = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { posting: updated, moved } = await moveRecruitPostingBu(posting.id, bu);
      setMsg({ ok: true, text: `ย้ายไป ${bu} แล้ว · ผู้สมัคร ${moved.toLocaleString('th-TH')} คนย้ายตาม` });
      setConfirm(false);
      onMoved?.(updated);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'ย้าย BU ไม่สำเร็จ' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-80 max-w-full space-y-1" data-testid="posting-bu">
      {/* ความกว้างคงที่ทุกชิ้น (24 พ.ย. 2569) — คลาสเดิม jarvis-soft-field บังคับช่องเลือกกว้าง 100% ปุ่มเลยตกบรรทัด
          ห่อช่องด้วย span กว้างคงที่ · ที่ปุ่มจองไว้ให้ "ย้ายเลย + ยกเลิก" ⇒ เปลี่ยน BU / กดย้ายแล้วของบนจอไม่ขยับ */}
      <div className="flex flex-nowrap items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">BU</span>
        <span className="inline-flex w-28 shrink-0">
          <Select
            value={bu}
            onValueChange={(v) => {
              setBu(v);
              setConfirm(false);
              setMsg(null);
            }}
          >
            <SelectTrigger className="h-8 w-full" aria-label="BU ของประกาศ">
              <SelectValue placeholder="เลือก BU" />
            </SelectTrigger>
            <SelectContent>
              {APP_DEPARTMENT_CODES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
        <div className="flex w-40 shrink-0 items-center gap-1">
          {confirm ? (
            <>
              <Button type="button" size="xs" disabled={busy} onClick={() => void move()} data-testid="posting-bu-confirm">
                {busy ? <Loader2 className="animate-spin" /> : null}
                ย้ายเลย
              </Button>
              <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => setConfirm(false)}>
                ยกเลิก
              </Button>
            </>
          ) : (
            <Button type="button" size="xs" variant="outline" disabled={!changed} onClick={() => setConfirm(true)} data-testid="posting-bu-move">
              ย้าย BU
            </Button>
          )}
        </div>
      </div>
      <p className={cn('min-h-4 text-[11px]', msg ? (msg.ok ? TONE.success.value : TONE.danger.value) : 'text-muted-foreground')} role="status">
        {msg
          ? msg.text
          : confirm
            ? `ย้ายประกาศนี้และผู้สมัคร ${(posting.applicationCount ?? 0).toLocaleString('th-TH')} คนจาก ${posting.departmentCode ?? 'ไม่ระบุ'} ไป ${bu}`
            : ''}
      </p>
    </div>
  );
}
