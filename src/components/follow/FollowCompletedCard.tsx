import type { FollowStopScope } from '@/lib/followApi';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import FollowCompleteControls from '@/components/follow/FollowCompleteControls';
import { useListPagination } from '@/hooks/useListPagination';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { AFTERCARE_TOPIC } from '@/lib/aftercareRounds';
import { moveToAftercare } from '@/lib/aftercareApi';
import { completeFollowEntry, createFollowRounds } from '@/lib/followApi';
import type { FollowGroup } from '@/lib/followGrouping';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcome } from '@/lib/followOutcome';
import { scheduleCallsByDay } from '@/lib/followWizard';
import {
  COMPLETION_REASON_SHORT,
  COMPLETION_REASON_TONE,
  followedSpan,
  reasonBlocksAftercare,
  selectAwaitingDecision,
  type CompletedFollowPerson,
} from '@/lib/followCompletion';
import {
  CONTINUE_DAY_PRESETS,
  CONTINUE_MAX_DAYS,
  MOVE_DAY_PRESETS,
  MOVE_MAX_ROUNDS,
  MOVE_MODE_LABEL,
  buildContinueCalls,
  buildMoveCalls,
  continueStartYmd,
  firstContinueDraft,
  firstMoveRound,
  isAftercareTopic,
  lastFollowYmd,
  moveBaseYmd,
  moveRoundDays,
  nextMoveRound,
  openFollowRounds,
  validateContinue,
  validateMoveRounds,
  type ContinueDraft,
  type MoveRoundDraft,
  type MoveRoundMode,
} from '@/lib/followAftercareMove';
import type { ScheduleCall } from '@/lib/followWizard';
import { friendlyErrorText } from '@/lib/friendlyError';

/**
 * การ์ด **"ติดตามครบ"** บนหน้าติดตาม (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * เจ้าของ: *"ติดตามนาย ก ตั้งแต่วันที่ 1-7 ติดตามครบเอาชื่อมากองไว้แล้วให้คนไปกดว่าจะย้าย
 * ไปติดตามหลังเริ่มงานไหม ถ้าติดตามจะให้ติดตามในอีกกี่วันข้างหน้า"*
 * Choice: การ์ดแยกบนหน้า · ปุ่ม 3/7/30 + พิมพ์เอง + เพิ่มรอบเองได้ · ตั้งได้ว่า AI หรือคนโทร
 * · "ไม่ย้าย" = เลือกผลปิดงาน 5 แบบ · "ย้าย" = ปิดงานชุดเดิมเป็น "ไปแล้ว"
 * · 5 ต.ค. 2569: ย้าย = นับจากวันติดตามวันสุดท้ายแล้วบวกต่อกัน (3 → 7 → 15 → 30) ·
 *   ไม่ย้าย = ปิดงาน หรือ **ติดตามต่อ** อีก N วัน (ชื่อกลับไปตารางติดตาม · ครบแล้วกลับมากองนี้)
 *
 * 🔴 รับ `groups` จากหน้าแม่ (ชุดของแท็บที่เปิด · ไม่ผ่านตัวกรองงานจบหรือยัง/วันที่)
 *    ยอดกับรายชื่อมาจากชุดเดียวกันเสมอ · ใครอยู่ในกองตัดสินที่ `followCompletion.ts` ที่เดียว
 * 🔴 ว่างก็ยังอยู่ (กติกาทั้งระบบ 1 ต.ค. 2569) — หัวการ์ด 0 คน + แถว "ไม่มี…"
 * 🔴 ห้ามซ้อน Dialog — ป๊อปทั้งสองเปิดจากการ์ดบนหน้า ไม่ได้อยู่ในป๊อปอื่น
 * ⚠️ รอบถามความเป็นอยู่ใช้โครงติดตามเดิม (หัวข้อ `AFTERCARE_TOPIC`) — ไม่ทำระบบโทรใหม่
 */
const FollowCompletedCard: React.FC<{
  groups: FollowGroup[];
  /** ทีมของแท็บที่เปิด — รอบใหม่ต้องอยู่แท็บเดียวกับชุดเดิม */
  followTeam?: 'replacement';
  /** ทำเสร็จแล้วให้หน้าแม่โหลดรายการใหม่ */
  onChanged: () => void;
  /** เวลาปัจจุบัน — เทสต์ล็อกวันได้ */
  now?: () => Date;
}> = ({ groups, followTeam, onChanged, now = () => new Date() }) => {
  const people = useMemo(() => selectAwaitingDecision(groups), [groups]);
  const { pageItems, bar } = useListPagination(people, 10);
  const [moving, setMoving] = useState<CompletedFollowPerson | null>(null);
  const [closing, setClosing] = useState<CompletedFollowPerson | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** ข้อความล่าสุดมาจากการย้ายไปดูแลหลังเริ่มงาน — โชว์ปุ่มพาไปดู (4 ต.ค. 2569 "ต้องมีทางเข้า และทางเอากลับ") */
  const [noticeMoved, setNoticeMoved] = useState(false);
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm" data-testid="follow-completed-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 md:px-5">
        <h2 className="text-sm font-medium text-foreground">ติดตามครบ</h2>
        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums', TONE.neutral.chip)}>
          {people.length.toLocaleString('th-TH')} คน
        </span>
      </div>

      {notice ? (
        <p
          role="status"
          className={cn(
            'flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs font-medium md:px-5',
            TONE.success.soft,
            TONE.success.value,
          )}
        >
          <span>{notice}</span>
          {noticeMoved ? (
            <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={() => navigate('/aftercare')}>
              ไปหน้าดูแลหลังเริ่มงาน
            </Button>
          ) : null}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className={cn('border-b border-border', DASH.tableHead)}>
              <th className="min-w-[200px] px-4 py-2.5 text-[11px] font-medium md:px-5">ชื่อ</th>
              <th className="min-w-[140px] px-3 py-2.5 text-[11px] font-medium">หน่วยงาน</th>
              <th className="min-w-[130px] px-3 py-2.5 text-[11px] font-medium">ผลการติดตาม</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-medium md:px-5">จัดการ</th>
            </tr>
          </thead>
          <tbody data-testid="follow-completed-rows">
            {people.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  ไม่มีคนที่ติดตามครบ
                </td>
              </tr>
            ) : null}
            {pageItems.map((p) => {
              const g = p.group;
              const aftercare = isAftercareTopic(g.topic);
              const tone = COMPLETION_REASON_TONE[p.reason];
              const span = followedSpan(g);
              return (
                <tr key={g.key} className="border-b border-border/50 align-middle last:border-0">
                  <td className="px-4 py-3 md:px-5">
                    <span className="block text-sm font-medium text-foreground">{g.name}</span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">{g.phone}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{g.unitName || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium', TONE[tone].chip)}>
                      {COMPLETION_REASON_SHORT[p.reason]}
                    </span>
                    {/* "ติดตามมากี่วัน" (Journey ข้อ 14 · 3 ต.ค. 2569) — ช่วงวันแรกถึงวันสุดท้ายของชุด */}
                    {span ? (
                      <span
                        className="block text-[11px] tabular-nums text-muted-foreground"
                        title={`${formatYmdDmyBe(span.from)}${span.to !== span.from ? ` – ${formatYmdDmyBe(span.to)}` : ''} · ${span.calls.toLocaleString('th-TH')} สาย`}
                      >
                        ติดตามมา {span.days.toLocaleString('th-TH')} วัน · {span.calls.toLocaleString('th-TH')} สาย
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 md:px-5">
                    <span className="flex flex-wrap items-center justify-end gap-1.5">
                      {/* ตอบว่าไม่ไป = ไม่มีอะไรให้ดูแลต่อ → เหลือแต่ปิดงาน */}
                      {reasonBlocksAftercare(p.reason) ? null : (
                        <Button
                          type="button"
                          size="xs"
                          onClick={() => {
                            setNotice(null);
                            setMoving(p);
                          }}
                        >
                          {aftercare ? 'ตามต่อ' : 'ย้ายไปดูแลหลังเริ่มงาน'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setNotice(null);
                          setClosing(p);
                        }}
                      >
                        {aftercare ? 'ไม่ตามต่อ' : 'ไม่ย้าย'}
                      </Button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ListPaginationBar {...bar} className="px-4 pb-3 md:px-5" />

      <MoveToAftercareDialog
        key={`move-${moving?.group.key ?? 'none'}`}
        person={moving}
        followTeam={followTeam}
        now={now}
        onClose={() => setMoving(null)}
        onDone={(text) => {
          setMoving(null);
          setNotice(text);
          setNoticeMoved(true);
          onChanged();
        }}
      />
      <NotMovingDialog
        key={`close-${closing?.group.key ?? 'none'}`}
        person={closing}
        followTeam={followTeam}
        now={now}
        onClose={() => setClosing(null)}
        onDone={(text) => {
          setClosing(null);
          setNotice(text);
          setNoticeMoved(false);
          onChanged();
        }}
      />
    </Card>
  );
};

/** สายล่าสุดของชุดที่มีเบอร์เจ้าหน้าที่ — รอบใหม่ใช้คนรับผิดชอบคนเดิม */
function staffPhoneOf(group: FollowGroup): string {
  for (let i = group.rounds.length - 1; i >= 0; i -= 1) {
    const v = (group.rounds[i].staff_phone ?? '').trim();
    if (v) return v;
  }
  return '';
}

/**
 * ป๊อปตั้งรอบดูแลหลังเริ่มงาน — ตั้งได้หลายรอบ แต่ละรอบเลือกอีกกี่วัน / เวลา / AI หรือคนโทร
 *
 * ลำดับที่ทำ (ห้ามสลับ):
 *   ① ลงทะเบียนดูแลหลังเริ่มงาน (upsert ตามเบอร์ — กดซ้ำไม่เกิดแถวซ้ำ)
 *   ② สร้างรอบถามความเป็นอยู่ **แผนละวัน** group_id เดียว (กติกาเดียวกับตารางหลายวัน)
 *   ③ ปิดงานชุดเดิมเป็น "ไปแล้ว" — ปิดพลาดไม่ล้มทั้งงาน (ยังกดปิดเองได้)
 * ② ล้มกลางทาง ⇒ ไม่ทำ ③ (คนยังอยู่ในกอง) + บอกว่าตั้งไปแล้วกี่สาย ไม่เงียบ
 */
const MoveToAftercareDialog: React.FC<{
  person: CompletedFollowPerson | null;
  followTeam?: 'replacement';
  now: () => Date;
  onClose: () => void;
  onDone: (notice: string) => void;
}> = ({ person, followTeam, now, onClose, onDone }) => {
  // เปิดคนใหม่ = ฟอร์มเริ่มใหม่ — หน้าแม่ใส่ `key` ตามคน (remount) ห้ามค้างรอบของคนก่อน
  const [rounds, setRounds] = useState<MoveRoundDraft[]>(() => [firstMoveRound()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const g = person?.group ?? null;
  const aftercare = isAftercareTopic(g?.topic);
  const title = aftercare ? 'ตามต่อ' : 'ย้ายไปดูแลหลังเริ่มงาน';
  const today = now();
  /** วันฐาน = วันติดตามวันสุดท้ายของชุด (ไม่ย้อนหลังวันนี้) · รอบแรกนับจากวันฐาน รอบถัดไปบวกต่อจากรอบก่อน */
  const lastYmd = g ? lastFollowYmd(g.rounds, today) : null;
  const baseYmd = lastYmd ? moveBaseYmd(lastYmd, today) : null;
  const roundDays = baseYmd ? moveRoundDays(rounds, baseYmd) : rounds.map(() => null);

  const patch = (i: number, next: Partial<MoveRoundDraft>) =>
    setRounds((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...next } : r)));

  const submit = async () => {
    if (!g || !baseYmd || busy) return;
    const invalid = validateMoveRounds(rounds, baseYmd, now());
    if (invalid) {
      setError(invalid);
      return;
    }
    const calls = buildMoveCalls(rounds, baseYmd, staffPhoneOf(g));
    const latest = g.rounds[g.rounds.length - 1];
    setBusy(true);
    setError(null);
    let created = 0;
    try {
      await moveToAftercare({
        phone: g.phone,
        full_name: g.name,
        unit_name: g.unitName,
        site_code: g.siteCode,
        from_follow_id: latest?.id ?? null,
        source: 'follow_done',
      });
    } catch (e) {
      setError(friendlyErrorText(e, 'ย้ายไปดูแลหลังเริ่มงานไม่สำเร็จ'));
      setBusy(false);
      return;
    }
    try {
      const groupId = crypto.randomUUID();
      for (const { calls: dayCalls } of scheduleCallsByDay(calls)) {
        const first = dayCalls[0];
        await createFollowRounds({
          recipient_name: g.name,
          recipient_phone: g.phone,
          topic: AFTERCARE_TOPIC,
          follow_team: followTeam,
          staff_phone: first.staffPhone || undefined,
          scheduled_at: first.scheduledAt,
          call_round: first.callRound,
          call_mode: first.callMode,
          group_id: groupId,
          unit_name: g.unitName ?? undefined,
          site_code: g.siteCode ?? undefined,
          rounds: dayCalls.map((c) => ({
            scheduled_at: c.scheduledAt,
            staff_phone: c.staffPhone || undefined,
            call_round: c.callRound,
            call_mode: c.callMode,
          })),
        });
        created += dayCalls.length;
      }
    } catch (e) {
      const why = friendlyErrorText(e, 'ตั้งรอบไม่สำเร็จ');
      setError(created > 0 ? `${why} — ตั้งไปแล้ว ${created} จาก ${calls.length} สาย` : why);
      setBusy(false);
      return;
    }
    for (const r of openFollowRounds(g.rounds)) {
      try {
        await completeFollowEntry(r.id, 'went');
      } catch {
        // ปิดไม่ได้ก็ไม่ล้ม — การย้ายสำเร็จแล้ว ยังกดปิดเองได้ที่ป๊อปของสายนั้น
      }
    }
    setBusy(false);
    onDone(`${title} ${g.name} แล้ว · ตั้ง ${calls.length} รอบ`);
  };

  return (
    <Dialog open={Boolean(person)} onOpenChange={(o) => (!o && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {g ? `${g.name}${g.unitName ? ` · ${g.unitName}` : ''}` : ''}
          </DialogDescription>
        </DialogHeader>

        {lastYmd && baseYmd ? (
          <p className="text-xs text-muted-foreground" data-testid="move-base-day">
            ติดตามวันสุดท้าย <span className="tabular-nums text-foreground">{formatYmdDmyBe(lastYmd)}</span>
            {baseYmd !== lastYmd ? (
              <>
                {' · '}นับจากวันนี้ <span className="tabular-nums text-foreground">{formatYmdDmyBe(baseYmd)}</span>
              </>
            ) : null}
          </p>
        ) : null}

        <ol className="space-y-2" aria-label="รอบโทร">
          {rounds.map((r, i) => {
            const day = roundDays[i];
            return (
              <li key={i} className="space-y-2 rounded-xl border border-border/70 p-3" data-testid="move-round">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">รอบที่ {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconXs"
                    disabled={rounds.length <= 1 || busy}
                    onClick={() => setRounds((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`เอารอบที่ ${i + 1} ออก`}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{i === 0 ? 'อีก' : 'ต่ออีก'}</span>
                  {MOVE_DAY_PRESETS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="xs"
                      variant={r.days.trim() === String(d) ? 'default' : 'outline'}
                      aria-pressed={r.days.trim() === String(d)}
                      disabled={busy}
                      onClick={() => patch(i, { days: String(d) })}
                    >
                      {d}
                    </Button>
                  ))}
                  {/* ช่องกรอกของระบบกว้างเต็มเสมอ (jarvis-soft-field) — ครอบให้กว้างตายตัวแทนการแก้คลาสของช่อง */}
                  <div className="w-20">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={365}
                      value={r.days}
                      disabled={busy}
                      onChange={(e) => patch(i, { days: e.target.value })}
                      aria-label={`จำนวนวันของรอบที่ ${i + 1}`}
                      className="h-9 text-xs tabular-nums"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">วัน</span>
                  <span className="text-xs tabular-nums text-foreground" data-testid="move-round-day">
                    {day ? formatYmdDmyBe(day) : '—'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <TimeSelect24
                    value={r.time}
                    onChange={(v) => patch(i, { time: v })}
                    disabled={busy}
                    label={`เวลาของรอบที่ ${i + 1}`}
                    className="min-h-9"
                  />
                  <span className="flex items-center gap-1" role="group" aria-label={`ใครโทรรอบที่ ${i + 1}`}>
                    {(Object.keys(MOVE_MODE_LABEL) as MoveRoundMode[]).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="xs"
                        variant={r.mode === m ? 'default' : 'outline'}
                        aria-pressed={r.mode === m}
                        disabled={busy}
                        onClick={() => patch(i, { mode: m })}
                      >
                        {MOVE_MODE_LABEL[m]}
                      </Button>
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <Button
          type="button"
          size="xs"
          variant="outline"
          className="w-fit"
          disabled={rounds.length >= MOVE_MAX_ROUNDS || busy}
          onClick={() => setRounds((prev) => [...prev, nextMoveRound(prev)])}
        >
          <Plus aria-hidden /> เพิ่มรอบ
        </Button>

        {error ? (
          <p role="alert" className={cn('text-xs font-medium', TONE.danger.value)}>
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            {busy ? 'กำลังบันทึก…' : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * ป๊อป "ไม่ย้าย" — สองทาง (เจ้าของ 5 ต.ค. 2569: *"ไม่ย้ายเพราะอะไร จะติดตามต่อหรอ ถ้าติดตามต่อติดตามต่ออีกกี่วัน"*)
 *   ① **ติดตามต่อ** อีก N วัน วันละ 1 สาย (เรื่องเดิม · ทีมเดิม · คนรับผิดชอบเดิม) — รอบเก่าไม่ปิด
 *      มีนัดข้างหน้าแล้ว ⇒ หลุดจากกองนี้เอง ไปอยู่ตารางติดตาม · ครบแล้วกลับมาให้ตัดสินอีกรอบ
 *   ② **ปิดงาน** เลือกผล แล้วปิดทุกรอบที่ยังเปิดของชุดนี้ (ของเดิม)
 * ชุดดูแลหลังเริ่มงานไม่มีทาง ① (มีปุ่ม "ตามต่อ" บนแถวอยู่แล้ว)
 */
const NotMovingDialog: React.FC<{
  person: CompletedFollowPerson | null;
  followTeam?: 'replacement';
  now: () => Date;
  onClose: () => void;
  onDone: (notice: string) => void;
}> = ({ person, followTeam, now, onClose, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContinueDraft>(() => firstContinueDraft());
  const g = person?.group ?? null;
  const aftercare = isAftercareTopic(g?.topic);
  const title = aftercare ? 'ไม่ตามต่อ' : 'ไม่ย้าย';
  const today = now();
  const startYmd = g ? continueStartYmd(lastFollowYmd(g.rounds, today), today) : null;
  const preview: ScheduleCall[] =
    g && startYmd && !validateContinue(draft)
      ? buildContinueCalls(draft, startYmd, staffPhoneOf(g), lastCallRoundOf(g))
      : [];
  const patch = (next: Partial<ContinueDraft>) => setDraft((prev) => ({ ...prev, ...next }));

  const complete = async (outcome: FollowOutcome, note?: string, stopScope?: FollowStopScope) => {
    if (!g || busy) return;
    setBusy(true);
    setError(null);
    let failed = 0;
    const open = openFollowRounds(g.rounds);
    for (const r of open) {
      try {
        await completeFollowEntry(r.id, outcome, note, stopScope);
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    if (failed > 0) {
      setError(`ปิดไม่สำเร็จ ${failed} จาก ${open.length} สาย — ลองกดอีกครั้ง`);
      return;
    }
    onDone(`ปิดงาน ${g.name} แล้ว · ${FOLLOW_OUTCOME_LABEL[outcome]}`);
  };

  /** ติดตามต่อ — สร้างแผนละวัน group_id ใหม่ชุดเดียว (กติกาเดียวกับตารางหลายวัน) · ล้มกลางทางต้องบอกว่าตั้งไปกี่สาย */
  const continueFollow = async () => {
    if (!g || !startYmd || busy) return;
    const invalid = validateContinue(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    const calls = buildContinueCalls(draft, startYmd, staffPhoneOf(g), lastCallRoundOf(g));
    if (calls.length === 0) {
      setError('ตั้งสายไม่ได้');
      return;
    }
    setBusy(true);
    setError(null);
    let created = 0;
    try {
      const groupId = crypto.randomUUID();
      for (const { calls: dayCalls } of scheduleCallsByDay(calls)) {
        const first = dayCalls[0];
        await createFollowRounds({
          recipient_name: g.name,
          recipient_phone: g.phone,
          topic: g.topic,
          follow_team: followTeam,
          staff_phone: first.staffPhone || undefined,
          scheduled_at: first.scheduledAt,
          call_round: first.callRound,
          call_mode: first.callMode,
          group_id: groupId,
          unit_name: g.unitName ?? undefined,
          site_code: g.siteCode ?? undefined,
          rounds: dayCalls.map((c) => ({
            scheduled_at: c.scheduledAt,
            staff_phone: c.staffPhone || undefined,
            call_round: c.callRound,
            call_mode: c.callMode,
          })),
        });
        created += dayCalls.length;
      }
    } catch (e) {
      const why = friendlyErrorText(e, 'ตั้งสายไม่สำเร็จ');
      setError(created > 0 ? `${why} — ตั้งไปแล้ว ${created} จาก ${calls.length} สาย` : why);
      setBusy(false);
      return;
    }
    setBusy(false);
    const last = calls[calls.length - 1];
    onDone(
      `ติดตาม ${g.name} ต่อ ${calls.length} วัน · ${formatYmdDmyBe(calls[0].day)}${
        last.day !== calls[0].day ? ` – ${formatYmdDmyBe(last.day)}` : ''
      }`,
    );
  };

  return (
    <Dialog
      open={Boolean(person)}
      onOpenChange={(o) => {
        if (!o && !busy) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{g ? `${g.name}${g.unitName ? ` · ${g.unitName}` : ''}` : ''}</DialogDescription>
        </DialogHeader>

        {aftercare ? null : (
          <section className="space-y-2 rounded-xl border border-border/70 p-3" data-testid="continue-follow">
            <h3 className="text-sm font-medium text-foreground">ติดตามต่อ</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">อีก</span>
              {CONTINUE_DAY_PRESETS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="xs"
                  variant={draft.days.trim() === String(d) ? 'default' : 'outline'}
                  aria-pressed={draft.days.trim() === String(d)}
                  disabled={busy}
                  onClick={() => patch({ days: String(d) })}
                >
                  {d}
                </Button>
              ))}
              <div className="w-20">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={CONTINUE_MAX_DAYS}
                  value={draft.days}
                  disabled={busy}
                  onChange={(e) => patch({ days: e.target.value })}
                  aria-label="ติดตามต่ออีกกี่วัน"
                  className="h-9 text-xs tabular-nums"
                />
              </div>
              <span className="text-xs text-muted-foreground">วัน</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TimeSelect24
                value={draft.time}
                onChange={(v) => patch({ time: v })}
                disabled={busy}
                label="เวลาโทรติดตามต่อ"
                className="min-h-9"
              />
              <span className="flex items-center gap-1" role="group" aria-label="ใครโทรติดตามต่อ">
                {(Object.keys(MOVE_MODE_LABEL) as MoveRoundMode[]).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="xs"
                    variant={draft.mode === m ? 'default' : 'outline'}
                    aria-pressed={draft.mode === m}
                    disabled={busy}
                    onClick={() => patch({ mode: m })}
                  >
                    {MOVE_MODE_LABEL[m]}
                  </Button>
                ))}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs tabular-nums text-foreground" data-testid="continue-preview">
                {preview.length > 0
                  ? `${formatYmdDmyBe(preview[0].day)}${
                      preview.length > 1 ? ` – ${formatYmdDmyBe(preview[preview.length - 1].day)}` : ''
                    } · ${preview.length.toLocaleString('th-TH')} สาย`
                  : '—'}
              </span>
              <Button type="button" size="sm" disabled={busy || preview.length === 0} onClick={() => void continueFollow()}>
                {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                ติดตามต่อ
              </Button>
            </div>
          </section>
        )}

        {aftercare ? null : <h3 className="text-sm font-medium text-foreground">ปิดงาน</h3>}
        <FollowCompleteControls alwaysOpen busy={busy} onComplete={complete} />
        {error ? (
          <p role="alert" className={cn('text-xs font-medium', TONE.danger.value)}>
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

/** สายที่สูงสุดของชุด (ไม่นับยกเลิก) — ติดตามต่อนับเลขสายต่อจากนี้ */
function lastCallRoundOf(group: FollowGroup): number {
  let max = 0;
  for (const r of group.rounds) {
    if (r.cancelled) continue;
    const n = Number(r.call_round ?? 0);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max > 0 ? max : group.rounds.filter((r) => !r.cancelled).length;
}

export default FollowCompletedCard;
