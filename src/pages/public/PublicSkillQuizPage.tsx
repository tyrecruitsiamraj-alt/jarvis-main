/**
 * /quiz/:token — พนักงานทำแบบทดสอบจากลิงก์ที่เจ้าหน้าที่ส่งให้ (เจ้าของ 12 พ.ย. 2569)
 * ไม่ต้องล็อกอิน · ตอบครบทุกข้อถึงส่งได้ · ส่งได้ครั้งเดียว · คำตอบที่กรอกค้างจำไว้ในเครื่อง (รีเฟรชไม่หาย)
 * ไม่โชว์คะแนนให้พนักงาน — เจ้าหน้าที่ตรวจก่อนส่งลูกค้า
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fetchPublicQuiz, submitPublicQuiz, type PublicQuiz } from '@/lib/skillQuizApi';
import { QUIZ_TEXT_ANSWER_MAX, type QuizAnswers } from '@/lib/skillQuiz';

const draftKey = (token: string) => `jarvis:quiz-draft:${token}`;

function readDraft(token: string): QuizAnswers {
  try {
    const raw = localStorage.getItem(draftKey(token));
    return raw ? (JSON.parse(raw) as QuizAnswers) : {};
  } catch {
    return {};
  }
}

export default function PublicSkillQuizPage() {
  const { token = '' } = useParams();
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers>(() => readDraft(token));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetchPublicQuiz(token)
      .then(setQuiz)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'เปิดแบบทดสอบไม่ได้'));
  }, [token]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(token), JSON.stringify(answers));
    } catch {
      /* เครื่องไม่ให้เก็บ = ไม่จำ */
    }
  }, [token, answers]);

  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);
  const answered = questions.filter((q) => {
    const v = answers[q.id];
    return q.kind === 'choice' ? typeof v === 'number' : typeof v === 'string' && v.trim() !== '';
  }).length;
  const firstMissing = questions.findIndex((q) => {
    const v = answers[q.id];
    return q.kind === 'choice' ? typeof v !== 'number' : !(typeof v === 'string' && v.trim());
  });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitPublicQuiz(token, answers);
      try {
        localStorage.removeItem(draftKey(token));
      } catch {
        /* ไม่เป็นไร */
      }
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
        <Card className="rounded-2xl p-5 text-sm text-foreground md:p-6">{loadError}</Card>
      </div>
    );
  }
  if (!quiz) {
    return <div className="mx-auto w-full max-w-2xl px-4 py-10 text-sm text-muted-foreground">กำลังโหลด…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 md:py-10">
      <Card className="space-y-1 rounded-2xl p-5 md:p-6">
        <h1 className="text-xl font-medium text-foreground">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">
          {quiz.personName}
          {quiz.personRole ? ` · ${quiz.personRole}` : ''}
        </p>
      </Card>

      {quiz.submitted || sent ? (
        <Card className="space-y-1 rounded-2xl p-5 text-sm text-foreground md:p-6" data-testid="quiz-sent">
          <p className="text-base font-medium">ส่งคำตอบแล้ว</p>
          <p className="text-muted-foreground">ขอบคุณที่ทำแบบทดสอบ เจ้าหน้าที่จะแจ้งผลให้ทราบ</p>
        </Card>
      ) : (
        <>
          {questions.map((q, i) => (
            <Card key={q.id} className="space-y-3 rounded-2xl p-5 md:p-6" data-testid="quiz-question">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-base text-foreground">
                  <span className="tabular-nums">{i + 1}.</span> {q.prompt}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{q.points} คะแนน</span>
              </div>
              {q.kind === 'choice' ? (
                <RadioGroup
                  value={typeof answers[q.id] === 'number' ? String(answers[q.id]) : ''}
                  onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
                  className="gap-2"
                >
                  {q.choices.map((c, ci) => (
                    <Label key={ci} htmlFor={`${q.id}-${ci}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm font-normal hover:bg-muted/50">
                      <RadioGroupItem id={`${q.id}-${ci}`} value={String(ci)} className="mt-0.5" />
                      <span className="whitespace-pre-wrap">{c}</span>
                    </Label>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  maxLength={QUIZ_TEXT_ANSWER_MAX}
                  rows={4}
                  placeholder="พิมพ์คำตอบ"
                />
              )}
            </Card>
          ))}
          <Card className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <span className="text-sm tabular-nums text-muted-foreground">
              ตอบแล้ว {answered}/{questions.length} ข้อ
            </span>
            <Button type="button" disabled={busy} onClick={() => (firstMissing >= 0 ? setError(`ยังไม่ได้ตอบข้อ ${firstMissing + 1}`) : setConfirm(true))}>
              ส่งคำตอบ
            </Button>
            {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
          </Card>
        </>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ส่งคำตอบ?</AlertDialogTitle>
            <AlertDialogDescription>ส่งแล้วกลับมาแก้ไม่ได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>กลับไปดูก่อน</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void submit(); }}>
              ส่งคำตอบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
