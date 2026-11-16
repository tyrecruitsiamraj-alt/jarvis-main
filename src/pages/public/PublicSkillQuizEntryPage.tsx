/**
 * /quiz/s/:setToken — ลิงก์เดียวของชุดข้อสอบ (เจ้าของ 16 พ.ย. 2569 · แบบ Knowa)
 * ครั้งแรก: กรอก ชื่อ นามสกุล เบอร์โทร อายุ เลขบัตร วันเกิด + ยินยอม PDPA → ได้ใบของตัวเองที่ /quiz/:token
 * เคยกรอกแล้ว: เลขบัตร + วันเกิด → กลับไปใบเดิม (ส่งแล้ว = เห็นแค่ "ส่งคำตอบแล้ว") · ทำชุดเดิมได้ครั้งเดียว
 * ตรวจฟอร์มด้วยตัวเดียวกับ server (`parseQuizTakerInput`)
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PdpaConsentCheck from '@/components/shared/PdpaConsentCheck';
import { PDPA_CONSENT_REQUIRED_MESSAGE, PDPA_CONSENT_TEXT_APPLICANT } from '@/lib/pdpaConsent';
import { ageOn, parseQuizResumeInput, parseQuizTakerInput } from '@/lib/skillQuizTaker';
import { fetchPublicQuizSet, resumePublicQuiz, startPublicQuiz, type PublicQuizSet, type QuizTakerForm } from '@/lib/skillQuizApi';

const BKK_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pad = (n: number) => String(n).padStart(2, '0');

/** วันเกิด 3 ช่อง (วัน · เดือน · ปี พ.ศ.) → YYYY-MM-DD ค.ศ. · ยังเลือกไม่ครบ = '' */
function BirthDateSelect({ id, value, onChange, today }: { id: string; value: string; onChange: (v: string) => void; today: string }) {
  const [parts, setParts] = useState(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? { d: String(Number(m[3])), m: String(Number(m[2])), y: m[1] } : { d: '', m: '', y: '' };
  });
  const thisYear = Number(today.slice(0, 4));
  const years = useMemo(() => Array.from({ length: 66 }, (_, i) => thisYear - 15 - i), [thisYear]);
  const set = (p: Partial<typeof parts>) => {
    const next = { ...parts, ...p };
    setParts(next);
    onChange(next.d && next.m && next.y ? `${next.y}-${pad(Number(next.m))}-${pad(Number(next.d))}` : '');
  };
  return (
    <div className="grid grid-cols-3 gap-2" id={id}>
      <Select value={parts.d} onValueChange={(d) => set({ d })}>
        <SelectTrigger aria-label="วันเกิด">
          <SelectValue placeholder="วัน" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 31 }, (_, i) => (
            <SelectItem key={i} value={String(i + 1)}>
              {i + 1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={parts.m} onValueChange={(m) => set({ m })}>
        <SelectTrigger aria-label="เดือนเกิด">
          <SelectValue placeholder="เดือน" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={parts.y} onValueChange={(y) => set({ y })}>
        <SelectTrigger aria-label="ปีเกิด (พ.ศ.)">
          <SelectValue placeholder="ปี" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y + 543}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const BLANK: QuizTakerForm = { firstName: '', lastName: '', phone: '', age: '', citizenId: '', birthDate: '' };

export default function PublicSkillQuizEntryPage() {
  const { setToken = '' } = useParams();
  const navigate = useNavigate();
  const today = useMemo(() => BKK_DAY.format(new Date()), []);
  const [quiz, setQuiz] = useState<PublicQuizSet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'new' | 'resume'>('new');
  const [f, setF] = useState<QuizTakerForm>(BLANK);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicQuizSet(setToken)
      .then(setQuiz)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'เปิดแบบทดสอบไม่ได้'));
  }, [setToken]);

  const patch = (p: Partial<QuizTakerForm>) => setF((x) => ({ ...x, ...p }));
  const onBirth = (birthDate: string) => {
    const age = birthDate ? ageOn(birthDate, today) : null;
    setF((x) => ({ ...x, birthDate, age: x.age || age === null ? x.age : String(age) }));
  };

  const go = async () => {
    setError(null);
    if (mode === 'new') {
      const checked = parseQuizTakerInput({ ...f, age: Number(f.age) }, today);
      if ('message' in checked) return setError(checked.message);
      if (!consent) return setError(PDPA_CONSENT_REQUIRED_MESSAGE);
    } else {
      const checked = parseQuizResumeInput(f, today);
      if ('message' in checked) return setError(checked.message);
    }
    setBusy(true);
    try {
      const token = mode === 'new' ? await startPublicQuiz(setToken, f, consent) : await resumePublicQuiz(setToken, f.citizenId, f.birthDate);
      navigate(`/quiz/${token}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลองใหม่อีกครั้ง');
      setBusy(false);
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
          {quiz.roleLabel ? `${quiz.roleLabel} · ` : ''}
          <span className="tabular-nums">{quiz.questionCount}</span> ข้อ
        </p>
      </Card>

      <Card className="space-y-4 rounded-2xl p-5 md:p-6" data-testid="quiz-entry">
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v === 'resume' ? 'resume' : 'new');
            setError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">ทำครั้งแรก</TabsTrigger>
            <TabsTrigger value="resume">เคยกรอกแล้ว</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-3 sm:grid-cols-2">
          {mode === 'new' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="taker-first">ชื่อ</Label>
                <Input id="taker-first" autoComplete="given-name" value={f.firstName} onChange={(e) => patch({ firstName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taker-last">นามสกุล</Label>
                <Input id="taker-last" autoComplete="family-name" value={f.lastName} onChange={(e) => patch({ lastName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taker-phone">เบอร์โทร</Label>
                <Input id="taker-phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="0812345678" value={f.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taker-age">อายุ</Label>
                <Input id="taker-age" type="number" inputMode="numeric" min={15} max={80} value={f.age} onChange={(e) => patch({ age: e.target.value })} />
              </div>
            </>
          ) : null}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="taker-citizen">เลขบัตรประชาชน</Label>
            <Input
              id="taker-citizen"
              inputMode="numeric"
              autoComplete="off"
              maxLength={17}
              placeholder="13 หลัก"
              value={f.citizenId}
              onChange={(e) => patch({ citizenId: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="taker-birth">วันเดือนปีเกิด</Label>
            <BirthDateSelect key={mode} id="taker-birth" value={f.birthDate} onChange={onBirth} today={today} />
          </div>
        </div>

        {mode === 'new' ? <PdpaConsentCheck checked={consent} onChange={setConsent} text={PDPA_CONSENT_TEXT_APPLICANT} /> : null}

        <div className="space-y-2">
          <Button type="button" className="w-full sm:w-auto" disabled={busy} onClick={() => void go()}>
            {mode === 'new' ? 'เริ่มทำแบบทดสอบ' : 'เข้าแบบทดสอบ'}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </Card>
    </div>
  );
}
