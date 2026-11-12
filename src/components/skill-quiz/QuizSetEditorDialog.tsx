/**
 * ป๊อปสร้าง/แก้ชุดข้อสอบ (เจ้าของ 12 พ.ย. 2569) — ทักษะ + ข้อ ในฟอร์มเดียว
 * ชนิดข้อแล้วแต่คนสร้าง (Choice เจ้าของ): ปรนัย = ติ๊กคำตอบที่ถูก · เขียนตอบ = ใส่แนวคำตอบให้ AI/เจ้าหน้าที่ใช้ให้คะแนน
 * ตรวจฟอร์มด้วย `parseQuizSetInput` ตัวเดียวกับ server · แก้ชุดแล้วลิงก์ที่สร้างไปแล้วไม่เปลี่ยน
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  QUIZ_DEFAULT_HEADER,
  QUIZ_DEFAULT_PASS,
  QUIZ_KIND_LABEL,
  QUIZ_MAX_CHOICES,
  parseQuizSetInput,
  quizLocalId,
  type QuizQuestion,
  type QuizSetContent,
} from '@/lib/skillQuiz';
import { saveQuizSet } from '@/lib/skillQuizApi';

type Props = { open: boolean; onOpenChange: (v: boolean) => void; setId: string | null; initial: QuizSetContent | null; onSaved: () => void };

function blankContent(): QuizSetContent {
  const skillId = quizLocalId('s');
  return {
    title: '',
    roleLabel: '',
    headerLine: QUIZ_DEFAULT_HEADER,
    passScore: QUIZ_DEFAULT_PASS,
    skills: [{ id: skillId, name: '' }],
    questions: [blankQuestion(skillId)],
  };
}

function blankQuestion(skillId: string): QuizQuestion {
  return { id: quizLocalId('q'), skillId, kind: 'choice', prompt: '', choices: ['', ''], answer: 0, points: 1, guide: '' };
}

export default function QuizSetEditorDialog({ open, onOpenChange, setId, initial, onSaved }: Props) {
  const [c, setC] = useState<QuizSetContent>(() => initial ?? blankContent());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setC(initial ? structuredClone(initial) : blankContent());
      setError(null);
    }
  }, [open, initial]);

  const patchQ = (id: string, p: Partial<QuizQuestion>) => setC((s) => ({ ...s, questions: s.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) }));

  const save = async () => {
    const parsed = parseQuizSetInput(c);
    if ('message' in parsed) return setError(parsed.message);
    setBusy(true);
    setError(null);
    try {
      await saveQuizSet(setId, parsed.value);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const full = c.questions.reduce((a, q) => a + (Number(q.points) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{setId ? 'แก้ชุดข้อสอบ' : 'สร้างชุดข้อสอบ'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quiz-title">ชื่อชุดข้อสอบ</Label>
            <Input id="quiz-title" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder="รายงานประเมินทักษะช่างอาคาร" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-role">ตำแหน่ง</Label>
            <Input id="quiz-role" value={c.roleLabel} onChange={(e) => setC({ ...c, roleLabel: e.target.value })} placeholder="Building Maintenance Technician" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-pass">เกณฑ์ผ่านรายทักษะ (คะแนน)</Label>
            <Input id="quiz-pass" type="number" min={1} max={100} value={c.passScore} onChange={(e) => setC({ ...c, passScore: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quiz-header">หัวรายงาน</Label>
            <Input id="quiz-header" value={c.headerLine} onChange={(e) => setC({ ...c, headerLine: e.target.value })} />
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">ทักษะ</h3>
          {c.skills.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <Input
                aria-label={`ทักษะที่ ${i + 1}`}
                value={s.name}
                onChange={(e) => setC({ ...c, skills: c.skills.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })}
                placeholder="ระบบไฟฟ้าอาคาร"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={c.skills.length <= 1}
                onClick={() => {
                  const rest = c.skills.filter((x) => x.id !== s.id);
                  setC({ ...c, skills: rest, questions: c.questions.map((q) => (q.skillId === s.id ? { ...q, skillId: rest[0].id } : q)) });
                }}
              >
                <Trash2 /> ลบ
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setC({ ...c, skills: [...c.skills, { id: quizLocalId('s'), name: '' }] })}>
            <Plus /> เพิ่มทักษะ
          </Button>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            ข้อสอบ <span className="tabular-nums text-muted-foreground">{c.questions.length} ข้อ · เต็ม {full} คะแนน</span>
          </h3>
          {c.questions.map((q, i) => (
            <div key={q.id} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium tabular-nums">ข้อ {i + 1}</span>
                <Select value={q.skillId} onValueChange={(v) => patchQ(q.id, { skillId: v })}>
                  <SelectTrigger className="h-9 w-48" aria-label="ทักษะของข้อนี้">
                    <SelectValue placeholder="เลือกทักษะ" />
                  </SelectTrigger>
                  <SelectContent>
                    {c.skills.map((s, si) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name.trim() || `ทักษะที่ ${si + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={q.kind}
                  onValueChange={(v) =>
                    patchQ(q.id, v === 'text' ? { kind: 'text', choices: [], answer: null } : { kind: 'choice', choices: q.choices.length >= 2 ? q.choices : ['', ''], answer: 0 })
                  }
                >
                  <SelectTrigger className="h-9 w-32" aria-label="ชนิดข้อ">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="choice">{QUIZ_KIND_LABEL.choice}</SelectItem>
                    <SelectItem value="text">{QUIZ_KIND_LABEL.text}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5">
                  <Input
                    aria-label="คะแนนของข้อนี้"
                    type="number"
                    min={1}
                    max={100}
                    className="h-9 w-20"
                    value={q.points}
                    onChange={(e) => patchQ(q.id, { points: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">คะแนน</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  disabled={c.questions.length <= 1}
                  onClick={() => setC({ ...c, questions: c.questions.filter((x) => x.id !== q.id) })}
                >
                  <Trash2 /> ลบข้อ
                </Button>
              </div>
              <Textarea aria-label="คำถาม" rows={2} value={q.prompt} onChange={(e) => patchQ(q.id, { prompt: e.target.value })} placeholder="คำถาม" />
              {q.kind === 'choice' ? (
                <div className="space-y-2">
                  <RadioGroup value={String(q.answer ?? 0)} onValueChange={(v) => patchQ(q.id, { answer: Number(v) })} className="gap-2">
                    {q.choices.map((ch, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <RadioGroupItem value={String(ci)} id={`${q.id}-ans-${ci}`} aria-label={`ตัวเลือก ${ci + 1} ถูก`} />
                        <Input
                          aria-label={`ตัวเลือก ${ci + 1}`}
                          value={ch}
                          onChange={(e) => patchQ(q.id, { choices: q.choices.map((x, xi) => (xi === ci ? e.target.value : x)) })}
                          placeholder={`ตัวเลือก ${ci + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={q.choices.length <= 2}
                          onClick={() => {
                            const choices = q.choices.filter((_, xi) => xi !== ci);
                            const answer = q.answer === ci ? 0 : (q.answer ?? 0) > ci ? (q.answer ?? 0) - 1 : q.answer;
                            patchQ(q.id, { choices, answer });
                          }}
                        >
                          ลบ
                        </Button>
                      </div>
                    ))}
                  </RadioGroup>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">วงกลมที่เลือก = คำตอบที่ถูก</span>
                    <Button type="button" variant="outline" size="sm" disabled={q.choices.length >= QUIZ_MAX_CHOICES} onClick={() => patchQ(q.id, { choices: [...q.choices, ''] })}>
                      <Plus /> เพิ่มตัวเลือก
                    </Button>
                  </div>
                </div>
              ) : (
                <Textarea aria-label="แนวคำตอบ" rows={2} value={q.guide} onChange={(e) => patchQ(q.id, { guide: e.target.value })} placeholder="แนวคำตอบที่ถูก (ใช้ให้คะแนน ไม่โชว์ให้พนักงาน)" />
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setC({ ...c, questions: [...c.questions, blankQuestion(c.questions[c.questions.length - 1]?.skillId ?? c.skills[0].id)] })}>
            <Plus /> เพิ่มข้อ
          </Button>
        </section>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy}>
            บันทึกชุดข้อสอบ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
