/**
 * /skill-test — แบบทดสอบพนักงาน (เจ้าของ 12 พ.ย. 2569)
 * แท็บ "ผลแบบทดสอบ" = ลิงก์ที่ส่งไปแล้ว + สถานะ + คะแนน · แท็บ "ชุดข้อสอบ" = สร้าง/แก้ชุด
 * ทางเดิน: สร้างชุด → สร้างลิงก์ (ใส่ชื่อพนักงาน) → คัดลอกส่ง → พนักงานทำ → AI ร่าง → เจ้าหน้าที่ตรวจ → บันทึกและโหลดรูป
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { CONVEYOR_VAULT } from '@/lib/soRecruitNav';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { QUIZ_STATUS_LABEL, type QuizAttemptStatus } from '@/lib/skillQuiz';
import {
  archiveQuizAttempt,
  archiveQuizSet,
  createQuizLink,
  fetchQuizAttempts,
  fetchQuizSets,
  quizLinkUrl,
  type QuizAttemptItem,
  type QuizSetItem,
} from '@/lib/skillQuizApi';

const STATUS_TONE: Record<QuizAttemptStatus, string> = { waiting: TONE.neutral.value, review: TONE.warn.value, ready: TONE.success.value };
const dateTh = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });

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
  const [sets, setSets] = useState<QuizSetItem[] | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; item: QuizSetItem | null } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
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

  const copyLink = async (a: { token: string; person_name: string }) => {
    const ok = await copyText(quizLinkUrl(a.token));
    setNotice(ok ? `คัดลอกลิงก์ของ ${a.person_name} แล้ว` : quizLinkUrl(a.token));
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
          tab === 'sets' ? (
            <Button type="button" onClick={() => setEditing({ id: null, item: null })}>
              <Plus /> สร้างชุดข้อสอบ
            </Button>
          ) : (
            <Button type="button" onClick={() => setLinkOpen(true)} disabled={!sets || sets.length === 0}>
              <Plus /> สร้างลิงก์
            </Button>
          )
        }
      />
      <div className="space-y-4 px-4 pb-8 md:px-6">
        <Tabs value={tab} onValueChange={(v) => setParams(v === 'sets' ? { tab: 'sets' } : {}, { replace: true })}>
          <TabsList>
            <TabsTrigger value="results">ผลแบบทดสอบ</TabsTrigger>
            <TabsTrigger value="sets">ชุดข้อสอบ</TabsTrigger>
          </TabsList>
        </Tabs>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="break-all text-sm text-muted-foreground">{notice}</p> : null}

        {tab === 'results' ? (
          <Card className="overflow-x-auto rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่</TableHead>
                  <TableHead>พนักงาน</TableHead>
                  <TableHead>ชุดข้อสอบ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">คะแนน</TableHead>
                  <TableHead>สร้างลิงก์</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts === null ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      กำลังโหลด…
                    </TableCell>
                  </TableRow>
                ) : attempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      ยังไม่มีลิงก์
                    </TableCell>
                  </TableRow>
                ) : (
                  attempts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">{a.doc_no}</TableCell>
                      <TableCell className="min-w-40">
                        <div>{a.person_name}</div>
                        {a.person_role ? <div className="text-xs text-muted-foreground">{a.person_role}</div> : null}
                      </TableCell>
                      <TableCell className="min-w-48">{a.title}</TableCell>
                      <TableCell className={cn('whitespace-nowrap', STATUS_TONE[a.status])}>
                        {QUIZ_STATUS_LABEL[a.status]}
                        {a.status === 'waiting' && a.opened_at ? ' · เปิดแล้ว' : ''}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{a.score === null ? '—' : `${a.score} · ${a.grade}`}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{dateTh(a.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {a.status === 'waiting' ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => void copyLink(a)}>
                            คัดลอกลิงก์
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" onClick={() => setOpenId(a.id)}>
                            ดูผล
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm({ kind: 'attempt', id: a.id, label: `ลิงก์ของ ${a.person_name}` })}>
                          ลบ
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="overflow-x-auto rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชุดข้อสอบ</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead className="text-right">ทักษะ</TableHead>
                  <TableHead className="text-right">ข้อ</TableHead>
                  <TableHead className="text-right">ส่งไปแล้ว</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sets === null ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      กำลังโหลด…
                    </TableCell>
                  </TableRow>
                ) : sets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      ยังไม่มีชุดข้อสอบ
                    </TableCell>
                  </TableRow>
                ) : (
                  sets.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="min-w-48">{s.content.title}</TableCell>
                      <TableCell>{s.content.roleLabel || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.content.skills.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.content.questions.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.attempts} คน</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ id: s.id, item: s })}>
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
        initial={editing?.item?.content ?? null}
        onSaved={() => {
          setNotice('บันทึกชุดข้อสอบแล้ว');
          load();
        }}
      />
      <QuizLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        sets={sets ?? []}
        onCreated={(a) => {
          load();
          void copyLink(a);
        }}
      />
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

/** ป๊อปสร้างลิงก์ — เลือกชุด + ชื่อพนักงาน · สร้างแล้วคัดลอกลิงก์ให้เลย */
function QuizLinkDialog({
  open,
  onOpenChange,
  sets,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sets: QuizSetItem[];
  onCreated: (a: { token: string; person_name: string }) => void;
}) {
  const [setId, setSetId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const first = sets[0];
    setSetId(first?.id ?? '');
    setRole(first?.content.roleLabel ?? '');
    setName('');
    setError(null);
  }, [open, sets]);

  const create = async () => {
    if (!setId) return setError('เลือกชุดข้อสอบ');
    if (!name.trim()) return setError('ใส่ชื่อพนักงาน');
    setBusy(true);
    setError(null);
    try {
      const a = await createQuizLink(setId, name.trim(), role.trim());
      onCreated({ token: a.token, person_name: name.trim() });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างลิงก์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>สร้างลิงก์ให้พนักงาน</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>ชุดข้อสอบ</Label>
            <Select
              value={setId}
              onValueChange={(v) => {
                setSetId(v);
                setRole(sets.find((s) => s.id === v)?.content.roleLabel ?? '');
              }}
            >
              <SelectTrigger aria-label="ชุดข้อสอบ">
                <SelectValue placeholder="เลือกชุดข้อสอบ" />
              </SelectTrigger>
              <SelectContent>
                {sets.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.content.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-person">ชื่อพนักงาน</Label>
            <Input id="quiz-person" value={name} onChange={(e) => setName(e.target.value)} placeholder="นายสมชาย ใจดี" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-person-role">ตำแหน่ง</Label>
            <Input id="quiz-person-role" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="button" disabled={busy} onClick={() => void create()}>
            สร้างและคัดลอกลิงก์
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
