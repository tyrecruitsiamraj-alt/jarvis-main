/**
 * ป๊อปผลแบบทดสอบของคนหนึ่งคน (เจ้าของ 12 พ.ย. 2569) — Choice "AI ร่าง แล้วเจ้าหน้าที่แก้ได้"
 * คะแนนรายทักษะ · คำตอบทุกข้อ (ถูก/ผิด) · บทวิเคราะห์ 3 หัวแก้ได้ · บันทึกแล้วโหลดรูปส่งลูกค้า · มีแต่ข้อปรนัย (16 พ.ย. 2569)
 * ตัวเลขทุกตัวจาก `scoreQuiz` ตัวเดียวกับรูปและตาราง
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useBranding } from '@/contexts/BrandingContext';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { QUIZ_STATUS_LABEL, quizAttemptStatus, quizChoiceImage, quizChoiceLabel, quizSkillTone, scoreQuiz, type QuizAnalysis } from '@/lib/skillQuiz';
import { draftQuizWithAi, fetchQuizAttempt, quizImageUrl, saveQuizReview, type QuizAttemptDetail } from '@/lib/skillQuizApi';
import { downloadQuizReportPng } from '@/lib/skillQuizReportImage';

const BIRTH_TH = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

type Props = { attemptId: string | null; onOpenChange: (v: boolean) => void; onChanged: () => void };

const EMPTY: QuizAnalysis = { strengths: '', gap: '', advice: '' };
const SECTIONS: { key: keyof QuizAnalysis; label: string }[] = [
  { key: 'strengths', label: 'จุดแข็ง' },
  { key: 'gap', label: 'Skill Gap' },
  { key: 'advice', label: 'ข้อเสนอแนะต่อ Operation' },
];

export default function QuizResultDialog({ attemptId, onOpenChange, onChanged }: Props) {
  const { config: branding } = useBranding();
  const [a, setA] = useState<QuizAttemptDetail | null>(null);
  const [analysis, setAnalysis] = useState<QuizAnalysis>(EMPTY);
  const [busy, setBusy] = useState<null | 'save' | 'png' | 'ai'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const adopt = useCallback((d: QuizAttemptDetail) => {
    setA(d);
    setAnalysis(d.analysis ?? EMPTY);
  }, []);

  useEffect(() => {
    setA(null);
    setNotice(null);
    if (!attemptId) return;
    fetchQuizAttempt(attemptId)
      .then(adopt)
      .catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'เปิดผลไม่ได้'));
  }, [attemptId, adopt]);

  // ส่งมาไม่ถึง 3 นาที ยังไม่มีบทวิเคราะห์ = AI กำลังร่างอยู่เบื้องหลัง → ถามซ้ำทุก 5 วิ
  const aiRunning = Boolean(a?.submitted_at && !a.analysis && !a.ai_error && Date.now() - new Date(a.submitted_at).getTime() < 3 * 60_000);
  useEffect(() => {
    if (!aiRunning || !attemptId) return;
    const t = window.setInterval(() => {
      fetchQuizAttempt(attemptId)
        .then((d) => {
          if (d.analysis || d.ai_error) adopt(d);
        })
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(t);
  }, [aiRunning, attemptId, adopt]);

  const r = a?.answers ? scoreQuiz(a.content, a.answers) : null;

  const save = async (thenPng: boolean) => {
    if (!a || !r) return;
    setBusy(thenPng ? 'png' : 'save');
    setNotice(null);
    try {
      const d = await saveQuizReview(a.id, { analysis, reviewed: true });
      adopt(d);
      onChanged();
      if (thenPng) {
        const ok = await downloadQuizReportPng({
          content: d.content,
          answers: d.answers ?? {},
          analysis: d.analysis ?? analysis,
          personName: d.person_name,
          personRole: d.person_role,
          docNo: d.doc_no,
          submittedAt: d.submitted_at ?? d.created_at,
          logoSrc: branding.logoDataUrl,
        });
        setNotice(ok ? 'บันทึกและโหลดรูปแล้ว' : 'บันทึกแล้ว แต่เซฟรูปไม่ได้ ลองอีกครั้ง');
      } else setNotice('บันทึกแล้ว');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const redraft = async () => {
    if (!a) return;
    setBusy('ai');
    setNotice(null);
    try {
      adopt(await draftQuizWithAi(a.id));
      setNotice('AI ร่างใหม่แล้ว ตรวจก่อนบันทึก');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'AI ร่างไม่ได้');
    } finally {
      setBusy(null);
    }
  };

  const status = a ? QUIZ_STATUS_LABEL[quizAttemptStatus(a)] : '';

  return (
    <Dialog open={attemptId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{a ? `${a.person_name} · ${a.doc_no}` : 'ผลแบบทดสอบ'}</DialogTitle>
        </DialogHeader>
        {a?.first_name ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-border p-4 text-sm sm:grid-cols-4" data-testid="quiz-taker">
            <div>
              <dt className="text-muted-foreground">เบอร์โทร</dt>
              <dd className="tabular-nums">{a.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">อายุ</dt>
              <dd className="tabular-nums">{a.age === null ? '—' : `${a.age} ปี`}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">วันเกิด</dt>
              <dd className="tabular-nums">{a.birth_date ? BIRTH_TH.format(new Date(`${a.birth_date}T00:00:00Z`)) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">เลขบัตร</dt>
              <dd className="whitespace-nowrap tabular-nums">{a.citizen_id_masked ?? '—'}</dd>
            </div>
          </dl>
        ) : null}
        {!a ? (
          <p className="text-sm text-muted-foreground">{notice ?? 'กำลังโหลด…'}</p>
        ) : !a.answers || !r ? (
          <p className="text-sm text-muted-foreground">{a.opened_at ? 'เปิดลิงก์แล้ว ยังไม่ส่งคำตอบ' : 'ยังไม่ได้เปิดลิงก์'}</p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {a.content.title} · {status}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">คะแนนทักษะรวม</p>
                <p className="text-3xl font-medium tabular-nums">
                  {r.score}
                  <span className="text-base text-muted-foreground"> /100</span>
                </p>
                <p className="text-sm">Grade {r.grade}</p>
              </div>
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">ทักษะผ่านเกณฑ์</p>
                <p className="text-3xl font-medium tabular-nums">{`${r.passedSkills}/${r.skills.length}`}</p>
                <p className="text-sm text-muted-foreground">เกณฑ์ขั้นต่ำ {a.content.passScore} คะแนน</p>
              </div>
            </div>

            <section className="space-y-3">
              {r.skills.map((s) => (
                <div key={s.skillId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{s.name}</span>
                    <span className={cn('tabular-nums', !s.passed && TONE.danger.value)}>
                      {s.score}/100
                      {s.passed ? '' : ' · ไม่ผ่าน'}
                    </span>
                  </div>
                  <Progress value={s.score} className="h-2" indicatorClassName={TONE[quizSkillTone(s.score, a.content.passScore)].dot} />
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">ผลวิเคราะห์ความสามารถ</h3>
                <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void redraft()}>
                  ให้ AI ร่างใหม่
                </Button>
              </div>
              {aiRunning ? <p className="text-sm text-muted-foreground">AI กำลังร่าง…</p> : null}
              {a.ai_error && !a.analysis ? <p className={cn('text-sm', TONE.warn.value)}>AI ร่างไม่ได้: {a.ai_error}</p> : null}
              {SECTIONS.map((s) => (
                <div key={s.key} className="space-y-1.5">
                  <Label htmlFor={`quiz-an-${s.key}`}>{s.label}</Label>
                  <Textarea id={`quiz-an-${s.key}`} rows={2} value={analysis[s.key]} onChange={(e) => setAnalysis({ ...analysis, [s.key]: e.target.value })} />
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">คำตอบ</h3>
              {a.content.questions.map((q, i) => {
                const ans = a.answers?.[q.id];
                const skill = a.content.skills.find((s) => s.id === q.skillId)?.name ?? '';
                const right = ans === q.answer;
                return (
                  <div key={q.id} className="rounded-xl border border-border p-3 text-sm">
                    <p className="text-muted-foreground">
                      ข้อ {i + 1} · {skill} · {q.points} คะแนน
                    </p>
                    <p className="whitespace-pre-wrap">{q.prompt}</p>
                    {q.image ? <img src={quizImageUrl(q.image)} alt={`รูปข้อ ${i + 1}`} loading="lazy" className="my-2 max-h-32 w-auto max-w-full rounded-lg border border-border" /> : null}
                    <p className={right ? TONE.success.value : TONE.danger.value}>
                      {right ? 'ถูก' : 'ผิด'} · ตอบ {quizChoiceLabel(q, Number(ans)) || '—'}
                      {right ? '' : ` · ที่ถูก ${quizChoiceLabel(q, q.answer)}`}
                    </p>
                    {/* ตัวเลือกเป็นรูป: วางรูปที่ตอบ (และที่ถูก ถ้าตอบผิด) ให้เทียบได้ */}
                    {[Number(ans), ...(right ? [] : [q.answer])].some((ci) => quizChoiceImage(q, ci)) ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {[Number(ans), ...(right ? [] : [q.answer])].map((ci, k) =>
                          quizChoiceImage(q, ci) ? (
                            <figure key={k} className="space-y-1">
                              <img src={quizImageUrl(quizChoiceImage(q, ci))} alt={quizChoiceLabel(q, ci)} loading="lazy" className="max-h-24 w-auto rounded-lg border border-border" />
                              <figcaption className="text-xs text-muted-foreground">{k === 0 ? 'ที่ตอบ' : 'ที่ถูก'}</figcaption>
                            </figure>
                          ) : null,
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          </div>
        )}
        {notice && a ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        {a?.answers ? (
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void save(false)}>
              บันทึก
            </Button>
            <Button type="button" disabled={busy !== null} onClick={() => void save(true)}>
              บันทึกและโหลดรูป
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
