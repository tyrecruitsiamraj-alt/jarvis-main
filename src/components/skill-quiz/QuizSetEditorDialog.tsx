/**
 * ป๊อปสร้าง/แก้ชุดข้อสอบ (เจ้าของ 12 พ.ย. 2569) — ทักษะ + ข้อ ในฟอร์มเดียว
 * มีแต่ข้อปรนัย ติ๊กคำตอบที่ถูก (เจ้าของ 16 พ.ย. 2569 ถอดข้อเขียนตอบออกทั้งระบบ)
 * ตรวจฟอร์มด้วย `parseQuizSetInput` ตัวเดียวกับ server · แก้ชุดแล้วใบที่คนทำเริ่มไปแล้วไม่เปลี่ยน
 * "ใครเห็นชุดนี้" (16 พ.ย. 2569 แบบ Knowa): ทุกคน · ทั้ง BU · รายคน — คนสร้างกับ Admin เห็นเสมอ · ผลของคนทำเห็นตามชุด
 * รูป (17 พ.ย. 2569): คำถามใส่ได้ 1 รูป · ตัวเลือกใส่ได้ตัวละ 1 รูป — อัปโหลดทันทีที่เลือก ชุดเก็บแค่รหัสรูป
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  QUIZ_AI_SKILL_MAX,
  QUIZ_DEFAULT_GRADES,
  QUIZ_DEFAULT_HEADER,
  QUIZ_DEFAULT_PASS,
  QUIZ_MAX_CHOICES,
  parseQuizSetInput,
  quizChoiceImage,
  quizLocalId,
  type QuizQuestion,
  type QuizSetContent,
} from '@/lib/skillQuiz';
import { quizViewerMode, type QuizViewerMode } from '@/lib/skillQuizTaker';
import { fetchQuizPeople, quizImageUrl, saveQuizSet, uploadQuizImage, type QuizPerson, type QuizSetItem, type QuizViewersInput } from '@/lib/skillQuizApi';
import QuizImportPanel from './QuizImportPanel';

type Props = { open: boolean; onOpenChange: (v: boolean) => void; setId: string | null; initial: QuizSetItem | null; onSaved: () => void };

const VIEWER_MODES: { value: QuizViewerMode; label: string }[] = [
  { value: 'all', label: 'ทุกคน' },
  { value: 'bu', label: 'ทั้ง BU' },
  { value: 'people', label: 'เลือกเป็นรายคน' },
];

function blankContent(): QuizSetContent {
  const skillId = quizLocalId('s');
  return {
    title: '',
    roleLabel: '',
    headerLine: QUIZ_DEFAULT_HEADER,
    passScore: QUIZ_DEFAULT_PASS,
    grades: { ...QUIZ_DEFAULT_GRADES },
    skills: [{ id: skillId, name: '' }],
    questions: [blankQuestion(skillId)],
  };
}

function blankQuestion(skillId: string): QuizQuestion {
  return { id: quizLocalId('q'), skillId, kind: 'choice', prompt: '', choices: ['', ''], answer: 0, points: 1 };
}

export default function QuizSetEditorDialog({ open, onOpenChange, setId, initial, onSaved }: Props) {
  const [c, setC] = useState<QuizSetContent>(() => (initial ? initial.content : blankContent()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [viewers, setViewers] = useState<QuizViewersInput>({ mode: 'all', bus: [], userIds: [] });
  const [people, setPeople] = useState<{ people: QuizPerson[]; bus: string[]; myId: string } | null>(null);
  const [personQuery, setPersonQuery] = useState('');
  /** รูปกำลังขึ้นของช่องไหน — `${ข้อ}:q` คำถาม · `${ข้อ}:${ลำดับ}` ตัวเลือก */
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageTarget = useRef<{ qid: string; ci: number | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    setC(initial ? structuredClone(initial.content) : blankContent());
    setError(null);
    setImporting(false);
    setPersonQuery('');
    setViewers(
      initial
        ? { mode: quizViewerMode({ bus: initial.viewer_bus, userIds: initial.viewer_user_ids }), bus: initial.viewer_bus, userIds: initial.viewer_user_ids }
        : { mode: 'all', bus: [], userIds: [] },
    );
    let live = true;
    fetchQuizPeople()
      .then((p) => {
        if (!live) return;
        setPeople(p);
        // ชุดใหม่: ค่าเริ่ม = BU ของคนสร้าง (ไม่มี BU = ทุกคน)
        const myBu = p.people.find((x) => x.id === p.myId)?.bu;
        if (!initial && myBu && p.bus.includes(myBu)) setViewers({ mode: 'bu', bus: [myBu], userIds: [] });
      })
      .catch(() => live && setPeople({ people: [], bus: [], myId: '' }));
    return () => {
      live = false;
    };
  }, [open, initial]);

  const shownPeople = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    const list = (people?.people ?? []).filter((p) => p.id !== people?.myId);
    return q ? list.filter((p) => p.name.toLowerCase().includes(q) || (p.bu ?? '').toLowerCase().includes(q)) : list;
  }, [people, personQuery]);
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

  const patchQ = (id: string, p: Partial<QuizQuestion>) => setC((s) => ({ ...s, questions: s.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) }));

  /** ตั้ง/ถอดรูป — ci null = รูปคำถาม · id '' = ถอด */
  const setImage = (qid: string, ci: number | null, id: string) =>
    setC((s) => ({
      ...s,
      questions: s.questions.map((q) => {
        if (q.id !== qid) return q;
        if (ci === null) return { ...q, image: id || undefined };
        const choiceImages = q.choices.map((_, i) => (i === ci ? id : quizChoiceImage(q, i)));
        return { ...q, choiceImages: choiceImages.some(Boolean) ? choiceImages : undefined };
      }),
    }));

  const pickImage = (qid: string, ci: number | null) => {
    imageTarget.current = { qid, ci };
    fileRef.current?.click();
  };

  const onImageFile = async (file: File | undefined) => {
    const t = imageTarget.current;
    if (!file || !t) return;
    setUploading(`${t.qid}:${t.ci ?? 'q'}`);
    setError(null);
    try {
      setImage(t.qid, t.ci, await uploadQuizImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ใส่รูปไม่สำเร็จ');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    const parsed = parseQuizSetInput(c);
    if ('message' in parsed) return setError(parsed.message);
    setBusy(true);
    setError(null);
    try {
      if (viewers.mode === 'bu' && viewers.bus.length === 0) throw new Error('เลือก BU ที่เห็นชุดนี้');
      if (viewers.mode === 'people' && viewers.userIds.length === 0) throw new Error('เลือกคนที่เห็นชุดนี้');
      if (uploading) throw new Error('รอรูปขึ้นเสร็จก่อน');
      await saveQuizSet(setId, parsed.value, viewers);
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
          {/* เกณฑ์เกรดต่อชุด (เจ้าของ 17 พ.ย. 2569) — ชุดเก่าที่ยังไม่ตั้ง = 85/70/60 */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>เกรด (คะแนนรวมตั้งแต่)</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['a', 'b', 'c'] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <Label htmlFor={`quiz-grade-${k}`} className="w-4 shrink-0">
                    {k.toUpperCase()}
                  </Label>
                  <Input
                    id={`quiz-grade-${k}`}
                    type="number"
                    min={1}
                    max={100}
                    value={(c.grades ?? QUIZ_DEFAULT_GRADES)[k]}
                    onChange={(e) => setC({ ...c, grades: { ...(c.grades ?? QUIZ_DEFAULT_GRADES), [k]: Number(e.target.value) } })}
                  />
                </div>
              ))}
              <p className="flex items-center text-sm text-muted-foreground">D ต่ำกว่า {(c.grades ?? QUIZ_DEFAULT_GRADES).c}</p>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quiz-header">หัวรายงาน</Label>
            <Input id="quiz-header" value={c.headerLine} onChange={(e) => setC({ ...c, headerLine: e.target.value })} />
          </div>
          {/* Skill ของ AI (เจ้าของ 17 พ.ย. 2569) — AI ใช้ตอนร่างผลวิเคราะห์ของชุดนี้ · แก้แล้วกด "ให้ AI ร่างใหม่" ที่ใบผลได้เลย */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quiz-ai-skill">Skill ของ AI</Label>
            <Textarea
              id="quiz-ai-skill"
              value={c.aiSkill ?? ''}
              onChange={(e) => setC({ ...c, aiSkill: e.target.value })}
              rows={6}
              placeholder="วางความรู้และหลักคิดของผู้เชี่ยวชาญที่ให้ AI ใช้วิเคราะห์ผล"
            />
            <p className={cn('text-right text-xs tabular-nums', (c.aiSkill ?? '').length > QUIZ_AI_SKILL_MAX ? TONE.danger.value : 'text-muted-foreground')}>
              {(c.aiSkill ?? '').length.toLocaleString('th-TH')}/{QUIZ_AI_SKILL_MAX.toLocaleString('th-TH')}
            </p>
          </div>
        </div>

        <section className="space-y-2" data-testid="quiz-viewers">
          <h3 className="text-sm font-medium text-foreground">ใครเห็นชุดนี้</h3>
          <RadioGroup value={viewers.mode} onValueChange={(v) => setViewers((x) => ({ ...x, mode: v as QuizViewerMode }))} className="flex flex-wrap gap-4">
            {VIEWER_MODES.map((m) => (
              <Label key={m.value} htmlFor={`quiz-viewer-${m.value}`} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                <RadioGroupItem id={`quiz-viewer-${m.value}`} value={m.value} />
                {m.label}
              </Label>
            ))}
          </RadioGroup>
          {viewers.mode === 'bu' ? (
            <div className="flex flex-wrap gap-4 rounded-xl border border-border p-3">
              {(people?.bus ?? []).map((bu) => (
                <Label key={bu} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <Checkbox aria-label={bu} checked={viewers.bus.includes(bu)} onCheckedChange={(v) => setViewers((x) => ({ ...x, bus: toggle(x.bus, bu, v === true) }))} />
                  {bu}
                </Label>
              ))}
            </div>
          ) : null}
          {viewers.mode === 'people' ? (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <Input aria-label="ค้นหาชื่อ" placeholder="ค้นหาชื่อหรือ BU" value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} />
              <p className="text-xs tabular-nums text-muted-foreground">เลือกแล้ว {viewers.userIds.length} คน</p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {people === null ? (
                  <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
                ) : shownPeople.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่พบชื่อ</p>
                ) : (
                  shownPeople.map((p) => (
                    <Label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-normal hover:bg-muted/50">
                      <Checkbox
                        aria-label={p.name}
                        checked={viewers.userIds.includes(p.id)}
                        onCheckedChange={(v) => setViewers((x) => ({ ...x, userIds: toggle(x.userIds, p.id, v === true) }))}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.bu ?? '—'}</span>
                    </Label>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </section>

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
              <div className="flex flex-wrap items-end gap-3">
                {q.image ? <img src={quizImageUrl(q.image)} alt={`รูปข้อ ${i + 1}`} className="max-h-40 w-auto max-w-full rounded-lg border border-border" /> : null}
                {q.image ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImage(q.id, null, '')}>
                    <Trash2 /> ลบรูปคำถาม
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" disabled={uploading !== null} onClick={() => pickImage(q.id, null)}>
                    <ImagePlus /> {uploading === `${q.id}:q` ? 'กำลังใส่รูป…' : 'ใส่รูปคำถาม'}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <RadioGroup value={String(q.answer)} onValueChange={(v) => patchQ(q.id, { answer: Number(v) })} className="gap-2">
                  {q.choices.map((ch, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <RadioGroupItem value={String(ci)} id={`${q.id}-ans-${ci}`} aria-label={`ตัวเลือก ${ci + 1} ถูก`} />
                      {quizChoiceImage(q, ci) ? (
                        <img src={quizImageUrl(quizChoiceImage(q, ci))} alt={`รูปตัวเลือก ${ci + 1}`} className="h-12 w-auto max-w-24 shrink-0 rounded-lg border border-border object-contain" />
                      ) : null}
                      <Input
                        aria-label={`ตัวเลือก ${ci + 1}`}
                        value={ch}
                        onChange={(e) => patchQ(q.id, { choices: q.choices.map((x, xi) => (xi === ci ? e.target.value : x)) })}
                        placeholder={quizChoiceImage(q, ci) ? 'คำใต้รูป (ไม่ใส่ก็ได้)' : `ตัวเลือก ${ci + 1}`}
                      />
                      {quizChoiceImage(q, ci) ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setImage(q.id, ci, '')}>
                          ลบรูป
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" disabled={uploading !== null} onClick={() => pickImage(q.id, ci)}>
                          <ImagePlus /> {uploading === `${q.id}:${ci}` ? 'กำลังใส่…' : 'ใส่รูป'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={q.choices.length <= 2}
                        onClick={() => {
                          const choices = q.choices.filter((_, xi) => xi !== ci);
                          const imgs = q.choiceImages?.filter((_, xi) => xi !== ci);
                          const answer = q.answer === ci ? 0 : q.answer > ci ? q.answer - 1 : q.answer;
                          patchQ(q.id, { choices, answer, choiceImages: imgs?.some(Boolean) ? imgs : undefined });
                        }}
                      >
                        ลบ
                      </Button>
                    </div>
                  ))}
                </RadioGroup>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">วงกลมที่เลือก = คำตอบที่ถูก</span>
                  <Button type="button" variant="outline" size="sm" disabled={q.choices.length >= QUIZ_MAX_CHOICES} onClick={() => patchQ(q.id, { choices: [...q.choices, ''], ...(q.choiceImages ? { choiceImages: [...q.choiceImages, ''] } : {}) })}>
                    <Plus /> เพิ่มตัวเลือก
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {importing ? (
            <QuizImportPanel
              content={c}
              fallbackSkillId={c.questions[c.questions.length - 1]?.skillId ?? c.skills[0].id}
              onAdd={setC}
              onClose={() => setImporting(false)}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setC({ ...c, questions: [...c.questions, blankQuestion(c.questions[c.questions.length - 1]?.skillId ?? c.skills[0].id)] })}>
              <Plus /> เพิ่มข้อ
            </Button>
            {/* นำเข้าจากไฟล์แบบ KNOWA (เจ้าของ 15 พ.ย. 2569) — แผงเปิดใต้ข้อสุดท้าย ตรงที่กด */}
            <Button type="button" variant="outline" size="sm" disabled={importing} onClick={() => setImporting(true)} data-testid="quiz-import-open">
              <FileUp /> นำเข้าจากไฟล์
            </Button>
          </div>
        </section>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            void onImageFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
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
