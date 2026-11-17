/**
 * /skill-test — แบบทดสอบพนักงาน (เจ้าของ 12 พ.ย. 2569)
 * แท็บ "ผลแบบทดสอบ" = คนที่กรอกเข้ามา + สถานะ + คะแนน · แท็บ "ชุดข้อสอบ" = สร้าง/แก้ชุด + ลิงก์ของชุด
 * ทางเดิน (16 พ.ย. 2569 แบบ Knowa): สร้างชุด (เลือกใครเห็น) → คัดลอกลิงก์ของชุดส่ง → คนทำกรอกข้อมูล+ยินยอม PDPA
 * (17 พ.ย. 2569) ปุ่ม "ส่งลิงก์" เปิดป๊อป QR + ส่งทาง LINE + โหลดรูป QR · ปุ่มคัดลอกลิงก์บนแถวยังอยู่
 * (17 พ.ย. 2569) ช่องค้นหาบนแถบบน — ผล: เลขที่/ชื่อ/เบอร์/ชุด · ชุด: ชื่อชุด/ตำแหน่ง · คำค้นใช้ร่วมทั้งสองแท็บ
 * (17 พ.ย. 2569) แท็บผล = รายชื่อชุดก่อน กดชุดแล้วค่อยเห็นคนทำ (`?set=`) — เจ้าของ "ไม่งั้นมันจะปนกันไปหมด"
 * → ทำ → AI ร่าง → เจ้าหน้าที่ตรวจ → บันทึกและโหลดรูป · ลิงก์ละคน (ใส่ชื่อพนักงาน) ถอดแล้ว
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import QuizSetEditorDialog from '@/components/skill-quiz/QuizSetEditorDialog';
import QuizResultDialog from '@/components/skill-quiz/QuizResultDialog';
import QuizShareDialog from '@/components/skill-quiz/QuizShareDialog';
import { useHeaderSearch } from '@/hooks/useHeaderSearch';
import { CONVEYOR_VAULT } from '@/lib/soRecruitNav';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { QUIZ_STATUS_LABEL, type QuizAttemptStatus } from '@/lib/skillQuiz';
import { quizViewerMode } from '@/lib/skillQuizTaker';
import {
  archiveQuizAttempt,
  archiveQuizSet,
  fetchQuizAttempts,
  fetchQuizSets,
  quizSetLinkUrl,
  type QuizAttemptItem,
  type QuizSetItem,
} from '@/lib/skillQuizApi';

const STATUS_TONE: Record<QuizAttemptStatus, string> = { waiting: TONE.neutral.value, review: TONE.warn.value, ready: TONE.success.value };
/** ทุกคน · BU LBD, LBA · 3 คน (คนสร้างกับ Admin เห็นเสมอ) */
function viewersLabel(s: QuizSetItem): string {
  const mode = quizViewerMode({ bus: s.viewer_bus, userIds: s.viewer_user_ids });
  if (mode === 'bu') return `BU ${s.viewer_bus.join(', ')}`;
  if (mode === 'people') return `${s.viewer_user_ids.length} คน`;
  return 'ทุกคน';
}

const dateTh = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });

/** คำค้นตรงกับข้อความไหนก็ได้ (ไม่สนตัวพิมพ์ · เบอร์พิมพ์มีขีดก็เจอ) */
function matches(q: string, fields: (string | null | undefined)[]): boolean {
  const digits = q.replace(/\D/g, '');
  return fields.some((f) => {
    const v = (f ?? '').toLowerCase();
    return v.includes(q) || (digits.length >= 3 && v.replace(/\D/g, '').includes(digits));
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function SkillQuizPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'sets' ? 'sets' : 'results';
  /** แท็บผล: ชุดที่กดเข้าไปดูคนทำ · null = รายชื่อชุด */
  const openSetId = tab === 'results' ? params.get('set') : null;
  const [sets, setSets] = useState<QuizSetItem[] | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; item: QuizSetItem | null } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [share, setShare] = useState<{ title: string; url: string } | null>(null);
  const [search, setSearch] = useState('');
  useHeaderSearch({ value: search, onChange: setSearch, placeholder: 'ค้นหาชื่อ เลขที่ ชุดข้อสอบ' });
  const q = search.trim().toLowerCase();
  const shownAttempts = useMemo(
    () => attempts?.filter((a) => a.set_id === openSetId && (!q || matches(q, [a.doc_no, a.person_name, a.phone, a.title]))) ?? null,
    [attempts, openSetId, q],
  );
  /** แท็บผลหน้าแรก: ทุกชุดที่เห็นได้ + ยอดคนทำแยกสถานะ · ค้นหาเจอชื่อชุดหรือคนทำในชุดนั้น */
  const resultSets = useMemo(() => {
    if (!sets || !attempts) return null;
    return sets
      .map((s) => {
        const mine = attempts.filter((a) => a.set_id === s.id);
        const count = (st: QuizAttemptStatus) => mine.filter((a) => a.status === st).length;
        const last = mine.reduce<string | null>((m, a) => (m && m > a.created_at ? m : a.created_at), null);
        const hit = !q || matches(q, [s.content.title, s.content.roleLabel]) || mine.some((a) => matches(q, [a.doc_no, a.person_name, a.phone]));
        return { set: s, total: mine.length, waiting: count('waiting'), review: count('review'), ready: count('ready'), last, hit };
      })
      .filter((r) => r.hit);
  }, [sets, attempts, q]);
  const openSetTitle = openSetId ? (sets?.find((s) => s.id === openSetId)?.content.title ?? attempts?.find((a) => a.set_id === openSetId)?.title ?? '') : '';
  const shownSets = useMemo(() => (sets && q ? sets.filter((s) => matches(q, [s.content.title, s.content.roleLabel])) : sets), [sets, q]);
  const [confirm, setConfirm] = useState<{ kind: 'set' | 'attempt'; id: string; label: string } | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([fetchQuizSets(), fetchQuizAttempts()])
      .then(([s, a]) => {
        setSets(s);
        setAttempts(a);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'โหลดไม่ได้'));
  }, []);
  useEffect(load, [load]);

  const title = CONVEYOR_VAULT.find((v) => v.key === 'skill-test')?.label ?? 'แบบทดสอบพนักงาน';

  const copyLink = async (s: QuizSetItem) => {
    if (!s.public_token) return;
    const url = quizSetLinkUrl(s.public_token);
    const ok = await copyText(url);
    // คัดลอกไม่ได้ = เปิดป๊อปส่งลิงก์แทน (เจ้าของ 17 พ.ย. 2569: ลิงก์ไม่ต้องโชว์บนหน้า)
    if (ok) setNotice(`คัดลอกลิงก์ชุด ${s.content.title} แล้ว`);
    else setShare({ title: s.content.title, url });
  };

  const doArchive = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === 'set') await archiveQuizSet(confirm.id);
      else await archiveQuizAttempt(confirm.id);
      setNotice(`ลบ ${confirm.label} แล้ว`);
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    } finally {
      setConfirm(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={title}
        subtitle=""
        actions={
          <Button type="button" onClick={() => setEditing({ id: null, item: null })}>
            <Plus /> สร้างชุดข้อสอบ
          </Button>
        }
      />
      <div className="space-y-4 px-4 pb-8 md:px-6">
        <Tabs value={tab} onValueChange={(v) => setParams(v === 'sets' ? { tab: 'sets' } : {}, { replace: true })}>
          <TabsList>
            {/* ชุดข้อสอบไว้หน้า (เจ้าของ 17 พ.ย. 2569 "สลับตำแหน่งกัน") — เปิดหน้ายังอยู่ผลแบบทดสอบเหมือนเดิม */}
            <TabsTrigger value="sets">ชุดข้อสอบ</TabsTrigger>
            <TabsTrigger value="results">ผลแบบทดสอบ</TabsTrigger>
          </TabsList>
        </Tabs>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="break-all text-sm text-muted-foreground">{notice}</p> : null}

        {tab === 'results' && !openSetId ? (
          <Card className="overflow-x-auto rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชุดข้อสอบ</TableHead>
                  <TableHead className="text-right">คนทำ</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{QUIZ_STATUS_LABEL.waiting}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{QUIZ_STATUS_LABEL.review}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{QUIZ_STATUS_LABEL.ready}</TableHead>
                  <TableHead>ล่าสุด</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultSets === null ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      กำลังโหลด…
                    </TableCell>
                  </TableRow>
                ) : resultSets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      {q ? `ไม่พบ "${search.trim()}"` : 'ยังไม่มีชุดข้อสอบ'}
                    </TableCell>
                  </TableRow>
                ) : (
                  resultSets.map((r) => (
                    <TableRow key={r.set.id} className="cursor-pointer" onClick={() => setParams({ set: r.set.id })}>
                      <TableCell className="min-w-48 font-medium">{r.set.content.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.total} คน</TableCell>
                      <TableCell className="text-right tabular-nums">{r.waiting}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', r.review > 0 && STATUS_TONE.review)}>{r.review}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ready}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{r.last ? dateTh(r.last) : '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => setParams({ set: r.set.id })}>
                          ดูคนทำ
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        ) : tab === 'results' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setParams({})}>
                <ChevronLeft /> ทุกชุด
              </Button>
              <h2 className="text-base font-medium">{openSetTitle}</h2>
            </div>
            <Card className="overflow-x-auto rounded-2xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่</TableHead>
                    <TableHead>คนทำ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">คะแนน</TableHead>
                    <TableHead>เริ่มทำ</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownAttempts === null ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        กำลังโหลด…
                      </TableCell>
                    </TableRow>
                  ) : shownAttempts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        {q ? `ไม่พบ "${search.trim()}"` : 'ยังไม่มีคนทำ'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    shownAttempts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">{a.doc_no}</TableCell>
                        <TableCell className="min-w-40">
                          <div>{a.person_name}</div>
                          {a.phone ? <div className="text-xs tabular-nums text-muted-foreground">{a.phone}</div> : null}
                        </TableCell>
                        <TableCell className={cn('whitespace-nowrap', STATUS_TONE[a.status])}>
                          {QUIZ_STATUS_LABEL[a.status]}
                          {a.status === 'waiting' && a.opened_at ? ' · เปิดแล้ว' : ''}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{a.score === null ? '—' : `${a.score} · ${a.grade}`}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{dateTh(a.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => setOpenId(a.id)}>
                            ดูผล
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm({ kind: 'attempt', id: a.id, label: `ผลของ ${a.person_name}` })}>
                            ลบ
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        ) : (
          <Card className="overflow-x-auto rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชุดข้อสอบ</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead className="text-right">ทักษะ</TableHead>
                  <TableHead className="text-right">ข้อ</TableHead>
                  <TableHead>ใครเห็น</TableHead>
                  <TableHead className="text-right">คนทำ</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownSets === null ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      กำลังโหลด…
                    </TableCell>
                  </TableRow>
                ) : shownSets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      {q ? `ไม่พบ "${search.trim()}"` : 'ยังไม่มีชุดข้อสอบ'}
                    </TableCell>
                  </TableRow>
                ) : (
                  shownSets.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="min-w-48">{s.content.title}</TableCell>
                      <TableCell>{s.content.roleLabel || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.content.skills.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.content.questions.length}</TableCell>
                      <TableCell className="whitespace-nowrap">{viewersLabel(s)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.attempts} คน</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          type="button"
                          size="sm"
                          disabled={!s.public_token}
                          onClick={() => s.public_token && setShare({ title: s.content.title, url: quizSetLinkUrl(s.public_token) })}
                        >
                          ส่งลิงก์
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled={!s.public_token} onClick={() => void copyLink(s)}>
                          คัดลอกลิงก์
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing({ id: s.id, item: s })}>
                          แก้
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm({ kind: 'set', id: s.id, label: `ชุด ${s.content.title}` })}>
                          ลบ
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <QuizSetEditorDialog
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        setId={editing?.id ?? null}
        initial={editing?.item ?? null}
        onSaved={() => {
          setNotice('บันทึกชุดข้อสอบแล้ว');
          load();
        }}
      />
      <QuizShareDialog share={share} onOpenChange={(v) => !v && setShare(null)} />
      <QuizResultDialog attemptId={openId} onOpenChange={(v) => !v && setOpenId(null)} onChanged={load} />
      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ{confirm?.label}?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ไม่ลบ</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doArchive()}>ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
