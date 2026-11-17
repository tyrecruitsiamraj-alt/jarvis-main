/**
 * ป๊อป "Skill ของ AI" (เจ้าของ 17 พ.ย. 2569 "Skill มันต้องฝังแยกชุดเลยหรอ" → คลัง Skill เลือกต่อชุด)
 * รายการ Skill · เพิ่ม · แก้ · ลบ ในป๊อปเดียว (ฟอร์มฝังในป๊อปนี้ ไม่ซ้อน Dialog)
 * ชุดข้อสอบเลือก Skill ที่ป๊อปสร้าง/แก้ชุด · แก้ที่นี่แล้วทุกชุดที่เลือกตัวนั้นใช้ตาม (กด "ให้ AI ร่างใหม่" ที่ใบผลได้เลย)
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { QUIZ_AI_SKILL_MAX, QUIZ_AI_SKILL_NAME_MAX, parseQuizAiSkillInput, type QuizAiSkill } from '@/lib/skillQuiz';
import { archiveAiSkill, fetchAiSkills, saveAiSkill } from '@/lib/skillQuizApi';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onChanged?: () => void };

const dateTh = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });

export default function AiSkillsDialog({ open, onOpenChange, onChanged }: Props) {
  const [skills, setSkills] = useState<QuizAiSkill[] | null>(null);
  /** null = รายการ · { id: null } = เพิ่มใหม่ · { id } = แก้ */
  const [form, setForm] = useState<{ id: string | null; name: string; body: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAiSkills()
      .then(setSkills)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'โหลดไม่ได้'));
  }, []);
  useEffect(() => {
    if (!open) return;
    setForm(null);
    setConfirmId(null);
    setError(null);
    load();
  }, [open, load]);

  const save = async () => {
    if (!form) return;
    const parsed = parseQuizAiSkillInput(form);
    if ('message' in parsed) return setError(parsed.message);
    setBusy(true);
    setError(null);
    try {
      await saveAiSkill(form.id, parsed.value);
      setForm(null);
      load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await archiveAiSkill(id);
      setConfirmId(null);
      load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form ? (form.id ? 'แก้ Skill' : 'เพิ่ม Skill') : 'Skill ของ AI'}</DialogTitle>
          <DialogDescription className="sr-only">คลัง Skill ที่ AI ใช้วิเคราะห์ผลแบบทดสอบ</DialogDescription>
        </DialogHeader>

        {form ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ai-skill-name">ชื่อ Skill</Label>
              <Input
                id="ai-skill-name"
                value={form.name}
                maxLength={QUIZ_AI_SKILL_NAME_MAX}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ผู้เชี่ยวชาญวิศวกรรมอาคาร"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-skill-body">เนื้อหา</Label>
              <Textarea
                id="ai-skill-body"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={14}
                placeholder="วางความรู้และหลักคิดของผู้เชี่ยวชาญที่ให้ AI ใช้วิเคราะห์ผล"
              />
              <p className={cn('text-right text-xs tabular-nums', form.body.length > QUIZ_AI_SKILL_MAX ? TONE.danger.value : 'text-muted-foreground')}>
                {form.body.length.toLocaleString('th-TH')}/{QUIZ_AI_SKILL_MAX.toLocaleString('th-TH')}
              </p>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>
                ยกเลิก
              </Button>
              <Button type="button" disabled={busy} onClick={() => void save()}>
                {busy ? 'กำลังบันทึก…' : 'บันทึก Skill'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => setForm({ id: null, name: '', body: '' })}>
                เพิ่ม Skill
              </Button>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {skills === null ? (
                <li className="px-3 py-3 text-sm text-muted-foreground">กำลังโหลด…</li>
              ) : skills.length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted-foreground">ยังไม่มี Skill</li>
              ) : (
                skills.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {s.body.length.toLocaleString('th-TH')} ตัวอักษร · แก้ล่าสุด {dateTh(s.updated_at)}
                        {s.updated_by_name ? ` · ${s.updated_by_name}` : ''}
                      </p>
                    </div>
                    {confirmId === s.id ? (
                      <>
                        <span className="text-sm">ลบ {s.name}?</span>
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmId(null)}>
                          ไม่ลบ
                        </Button>
                        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void remove(s.id)}>
                          ลบ
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => setForm({ id: s.id, name: s.name, body: s.body })}>
                          แก้
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(s.id)}>
                          ลบ
                        </Button>
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
