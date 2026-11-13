/**
 * ═══ ตั้งค่า › แอดไลน์ประจำ BU (เจ้าของ 13 พ.ย. 2569 "ในแคปชั่นต้องใส่ id line ด้วย") ═══
 * Choice "ID LINE กลางของบริษัท แต่แยก Bu" · บรรทัดในข้อความประกาศ "แอดไลน์ : xxx" (Autopost + โพสต์เอง)
 * BU ละช่อง · ว่างแล้วบันทึก = ลบ (ใบของ BU นั้นไม่มีบรรทัดแอดไลน์) · ตัวกรองค่าอยู่ `src/lib/buLineIds.ts`
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';
import { BU_LINE_ID_MAX, lineIdCaptionLine, type BuLineIds } from '@/lib/buLineIds';
import { fetchBuLineIds, saveBuLineId } from '@/lib/buLineIdsApi';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const LineIdsTab: React.FC = () => {
  const [saved, setSaved] = useState<BuLineIds | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ bu: string; ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchBuLineIds(true)
      .then((ids) => {
        setSaved(ids);
        setDraft(ids);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'อ่านค่าไม่ได้'));
  }, []);

  const save = async (bu: string) => {
    setBusy(bu);
    setNotice(null);
    try {
      const ids = await saveBuLineId(bu, (draft[bu] ?? '').trim());
      setSaved(ids);
      setDraft((d) => ({ ...d, [bu]: ids[bu] ?? '' }));
      setNotice({ bu, ok: true, text: ids[bu] ? 'บันทึกแล้ว' : 'ลบแล้ว' });
    } catch (e) {
      setNotice({ bu, ok: false, text: e instanceof Error ? e.message : 'บันทึกไม่ได้' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card variant="solid" className="max-w-2xl space-y-5 p-5" data-testid="line-ids">
      <h3 className="text-lg font-medium text-foreground">แอดไลน์ประจำ BU</h3>
      {loadError ? <p className={cn('text-sm', TONE.danger.value)}>{loadError}</p> : null}
      <div className="space-y-3">
        {APP_DEPARTMENT_CODES.map((bu) => {
          const value = draft[bu] ?? '';
          const changed = saved !== null && value.trim() !== (saved[bu] ?? '');
          return (
            <div key={bu} className="space-y-1" data-testid={`line-id-row-${bu}`}>
              <div className="flex items-center gap-2">
              <Label htmlFor={`line-id-${bu}`} className="w-12 shrink-0 font-medium">
                {bu}
              </Label>
              <Input
                id={`line-id-${bu}`}
                value={value}
                maxLength={BU_LINE_ID_MAX}
                placeholder="เช่น @abc1234"
                disabled={saved === null}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, [bu]: e.target.value }));
                  setNotice(null);
                }}
              />
              <Button type="button" size="sm" disabled={!changed || busy !== null} onClick={() => void save(bu)}>
                {busy === bu ? 'กำลังบันทึก…' : 'บันทึก'}
              </Button>
              </div>
              <p className={cn('pl-14 text-xs', notice?.bu === bu ? (notice.ok ? TONE.success.value : TONE.danger.value) : 'text-muted-foreground')}>
                {notice?.bu === bu ? notice.text : saved?.[bu] ? lineIdCaptionLine(saved[bu]) : 'ยังไม่ได้ตั้ง'}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default LineIdsTab;
