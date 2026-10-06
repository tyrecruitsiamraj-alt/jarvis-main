import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { buildIncomeDisplay } from '@/lib/incomeBreakdown';
import { saveUnitFieldOverridesPatch, unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import { parsePostText, parsedPostHasData, postTextOverridesPatch } from '@/lib/postText';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

const NUM = new Intl.NumberFormat('th-TH');

/**
 * ═══ วางข้อความโพสต์ → เติมช่องของหน้า 3 (เจ้าของ 6 ต.ค. 2569 → Choice "ทำทั้งสองอย่าง") ═══
 *
 * วาง → เห็นทันทีว่าระบบอ่านได้อะไร → กด "ใช้ข้อมูลนี้" ถึงจะบันทึก (🔴 ไม่บันทึกตอนวาง — ฟอร์มห้ามเขียนฐานเอง)
 * บันทึกครั้งเดียวผ่าน `saveUnitFieldOverridesPatch` (อ่านของล่าสุดก่อนต่อ) · ช่องที่อ่านไม่ได้ = คงค่าเดิม
 * ตัวอ่านอยู่ `src/lib/postText.ts` (เทสต์ `tests/api/postText.test.ts`)
 */
export default function PostTextPasteCard({
  job,
  onSaved,
}: {
  job: JobRequest;
  onSaved: (patch: Partial<JobRequest>) => void;
}) {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const parsed = React.useMemo(() => parsePostText(text), [text]);
  const ready = parsedPostHasData(parsed);

  const rows: Array<[string, string]> = [];
  if (parsed.incomeLines.length > 0) {
    rows.push(['รายได้', parsed.incomeLines.map((l) => `${l.label} ${NUM.format(l.amount)}`).join(' · ')]);
  }
  if (parsed.total !== null) rows.push(['รายได้รวม', `${NUM.format(parsed.total)} บาท/เดือน`]);
  if (parsed.schedule) rows.push(['วันเวลาทำงาน', parsed.schedule]);
  if (parsed.gender) rows.push(['เพศ', parsed.gender === 'ไม่จำกัด' ? 'ไม่จำกัดเพศ' : parsed.gender]);
  if (parsed.ageMin !== null || parsed.ageMax !== null) {
    rows.push([
      'อายุ',
      parsed.ageMin !== null && parsed.ageMax !== null
        ? `${parsed.ageMin}–${parsed.ageMax} ปี`
        : parsed.ageMin !== null
          ? `${parsed.ageMin} ปีขึ้นไป`
          : `ไม่เกิน ${parsed.ageMax} ปี`,
    ]);
  }
  if (parsed.requirements.length > 0) rows.push(['คุณสมบัติ', parsed.requirements.join('\n')]);

  const apply = async () => {
    const requestNo = unitRequestNoteKey(job);
    if (!requestNo) {
      setError('ใบขอนี้ไม่มีเลขที่ใบขอ บันทึกไม่ได้');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await saveUnitFieldOverridesPatch(requestNo, postTextOverridesPatch(null, parsed));
      const display = next.income ? buildIncomeDisplay(next.income) : null;
      onSaved({
        field_overrides: next as JobRequest['field_overrides'],
        ...(next.work_schedule ? { work_schedule: next.work_schedule } : {}),
        ...(next.requirements ? { requirements: next.requirements } : {}),
        ...(next.age_min != null ? { age_range_min: next.age_min } : {}),
        ...(next.age_max != null ? { age_range_max: next.age_max } : {}),
        ...(next.gender ? { gender_requirement: next.gender } : {}),
        ...(display ? { income_display: display } : {}),
        ...(next.total_income != null ? { total_income: next.total_income } : {}),
      });
      setText('');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="post-text-paste">
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDone(false);
          setError(null);
        }}
        rows={4}
        placeholder="วางข้อความโพสต์ที่นี่"
        aria-label="ข้อความโพสต์"
      />
      {text.trim() ? (
        ready ? (
          <dl className="divide-y divide-border/60 rounded-xl border border-border/60 px-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-3 py-2">
                <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="min-w-0 whitespace-pre-line text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={cn('text-sm', TONE.warn.value)}>อ่านไม่ออก ลองวางข้อความทั้งโพสต์</p>
        )
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={!ready || busy} onClick={() => void apply()}>
          {busy ? 'กำลังบันทึก…' : 'ใช้ข้อมูลนี้'}
        </Button>
        {done ? <span className={cn('text-sm', TONE.success.value)}>เติมแล้ว</span> : null}
        {error ? (
          <span role="alert" className={cn('text-sm', TONE.danger.value)}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
