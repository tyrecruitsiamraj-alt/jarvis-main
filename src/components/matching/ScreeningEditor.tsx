import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import type { ScreeningAnswer } from '@/lib/candidatePriority';
import {
  saveCandidateScreening,
  type CandidateScreeningRecord,
  type ScreeningSource,
} from '@/lib/candidateScreeningApi';

/**
 * บันทึกผลคัดกรอง เหล้า/บุหรี่ + ประวัติคดี (ข้อ 4-5 ของลำดับความสำคัญที่เจ้าของกำหนด)
 *
 * บอร์ด iRecruit ไม่มีสองฟิลด์นี้ — เจ้าหน้าที่ถามแล้วกดบันทึกที่นี่ เก็บฝั่ง Jarvis
 * "ยังไม่ถาม" ต่างจาก "ไม่" — ยังไม่ถามจะไม่ถูกนับในคะแนน คนที่ยังไม่ถูกคัดกรองไม่เสียเปรียบ
 * รายละเอียดคดีเป็นบันทึกให้คนอ่าน ไม่ถูกเอาไปคิดคะแนนอัตโนมัติ
 */
const SCREENING_CHOICES: Array<{ value: ScreeningAnswer; label: string; tone: ToneKey }> = [
  { value: 'no', label: 'ไม่', tone: 'success' },
  { value: 'yes', label: 'ใช่', tone: 'danger' },
  { value: 'unknown', label: 'ยังไม่ถาม', tone: 'neutral' },
];

export default function ScreeningEditor({
  source,
  candidateRef,
  candidateName,
  record,
  onSaved,
}: {
  /**
   * คนละคลังกับ ref เดียวกันได้ — บอร์ดใช้ `card_id` · iRecruit ใช้ `id` ของเขา
   * ซึ่งเป็นเลขคนละชุดแต่ชนกันได้ (เช่น 1805 มีทั้งสองฝั่ง) จึงต้องส่ง source มาเสมอ
   */
  source: ScreeningSource;
  candidateRef: string;
  candidateName: string | null;
  record?: CandidateScreeningRecord;
  onSaved: (rec: CandidateScreeningRecord) => void;
}) {
  const [drinking, setDrinking] = useState<ScreeningAnswer>('unknown');
  const [smoking, setSmoking] = useState<ScreeningAnswer>('unknown');
  const [criminalRecord, setCriminalRecord] = useState<ScreeningAnswer>('unknown');
  const [criminalNote, setCriminalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // เปลี่ยนคน/โหลดผลมาใหม่ = เติมค่าที่บันทึกไว้ลงฟอร์ม
  useEffect(() => {
    setDrinking(record?.drinking ?? 'unknown');
    setSmoking(record?.smoking ?? 'unknown');
    setCriminalRecord(record?.criminalRecord ?? 'unknown');
    setCriminalNote(record?.criminalNote ?? '');
    setError(null);
    setSavedAt(null);
  }, [source, candidateRef, record]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const rec = await saveCandidateScreening({
        source,
        candidateRef,
        candidateName,
        drinking,
        smoking,
        criminalRecord,
        criminalNote: criminalNote.trim() || null,
      });
      onSaved(rec);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกผลคัดกรองไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const row = (
    label: string,
    value: ScreeningAnswer,
    set: (v: ScreeningAnswer) => void,
  ) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn('w-20 shrink-0 text-[11px]', DASH.muted)}>{label}</span>
      <div className="flex gap-1">
        {SCREENING_CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => set(c.value)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              value === c.value
                ? cn(TONE[c.tone].soft, TONE[c.tone].value)
                : cn(TONE.neutral.soft, DASH.muted, TONE.neutral.softHover),
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-2 rounded-xl border px-3 py-3', TONE.neutral.soft)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-xs font-semibold', DASH.cellStrong)}>ผลคัดกรอง</p>
        {record?.screenedByName ? (
          <span className={cn('text-[10px]', DASH.muted)}>บันทึกโดย {record.screenedByName}</span>
        ) : null}
      </div>
      {row('ดื่มเหล้า', drinking, setDrinking)}
      {row('สูบบุหรี่', smoking, setSmoking)}
      {row('มีคดี', criminalRecord, setCriminalRecord)}
      {criminalRecord === 'yes' ? (
        <textarea
          value={criminalNote}
          onChange={(e) => setCriminalNote(e.target.value)}
          placeholder="รายละเอียดคดี (ให้คนอ่านตัดสิน ไม่ถูกเอาไปคิดคะแนนอัตโนมัติ)"
          className="min-h-[52px] w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      ) : null}
      {error ? <p className={cn('text-[11px]', TONE.danger.value)}>{error}</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className={cn(
            'rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-60',
            TONE.primary.solid,
          )}
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกผลคัดกรอง'}
        </button>
        {savedAt ? (
          <span className={cn('text-[11px]', TONE.success.value)}>บันทึกแล้ว — ลำดับอัปเดตทันที</span>
        ) : null}
      </div>
    </div>
  );
}
