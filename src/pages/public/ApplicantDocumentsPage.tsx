/**
 * /apply/documents — ผู้สมัครส่งเอกสารจากลิงก์ที่เจ้าหน้าที่ส่งให้ใน LINE (เจ้าของ 22 พ.ย. 2569)
 *
 * ไม่ต้องมีบัญชีในระบบ: เปิดลิงก์ → LINE ยืนยันบัญชี (ชื่อกับรูป) → ถ่ายบัตรประชาชน ใบขับขี่ ทะเบียนบ้าน → ตรวจข้อมูลที่อ่านได้
 * → อ่านและตอบเอกสาร 5 ฉบับ → ลงนาม → ส่ง · ส่งได้ครั้งเดียวต่อลิงก์ (กดซ้ำได้ชุดเดิม)
 * กติกาข้อมูลอยู่ `src/lib/documents/applicantForm.ts` · เซิร์ฟเวอร์ตรวจซ้ำทุกอย่าง (`/api/public/applicant-documents`)
 * OCR ทำบนเครื่องผู้สมัคร (โหลดเมื่อแนบภาพแรก) · สิ่งที่กรอกจำไว้ในแท็บนี้ กันหน้าโหลดใหม่ตอนเปิดกล้อง
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PdpaConsentCheck from '@/components/shared/PdpaConsentCheck';
import DocumentUploadCard from '@/components/documents/DocumentUploadCard';
import { StepConsent, StepReview, StepSign, SubmittedView } from '@/components/documents/ApplicantSteps';
import { TONE } from '@/lib/designTokens';
import { formatDateTimeTh, toYmdBangkok } from '@/lib/dateTh';
import { PDPA_CONSENT_TEXT_APPLICANT } from '@/lib/pdpaConsent';
import { cn } from '@/lib/utils';
import {
  ApplicantApiError,
  applicantFileUrl,
  fetchApplicantConfig,
  fetchApplicantReceipt,
  fetchApplicantState,
  openApplicantSession,
  readApplicantImageOnServer,
  submitApplicantPacket,
  uploadApplicantImage,
} from '@/lib/documents/applicantDocumentsApi';
import {
  FORM_STEPS,
  blankForm,
  clearDraft,
  confirmSlotImage,
  loadDraft,
  markSlotReading,
  packetBody,
  saveDraft,
  setSlotFile,
  setSlotOcr,
  stepError,
  unsign,
  type ApplicantForm,
} from '@/lib/documents/applicantForm';
import { DOC_TYPES, UPLOAD_KINDS, type UploadKind } from '@/lib/documents/documentTypes';
import type { ApplicantState } from '@/lib/documents/documentViews';
import { forgetInvite, getLineIdToken, hideInviteFromUrl, inviteFromUrl, readInvite, readOpenedKey, rememberOpenedKey } from '@/lib/documents/liff';
import { PacketError, validatePacket } from '@/lib/documents/packetValidation';

type Phase = 'opening' | 'stopped' | 'form' | 'sent';
type Receipt = { packetId: string; submittedAt: string };

const storage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};
const loadOcr = () => import('@/lib/documents/browserOcr');

export default function ApplicantDocumentsPage() {
  const [phase, setPhase] = useState<Phase>('opening');
  const [opening, setOpening] = useState('กำลังเปิดลิงก์…');
  /** เปิดต่อไม่ได้ — ข้อความ + กดลองใหม่ได้ไหม */
  const [stopped, setStopped] = useState<{ text: string; retry: boolean } | null>(null);
  const [state, setState] = useState<ApplicantState | null>(null);
  const [form, setFormRaw] = useState<ApplicantForm>(blankForm);
  const [step, setStep] = useState(0);
  const [work, setWork] = useState<{ kind: UploadKind; text: string } | null>(null);
  const [slotErrors, setSlotErrors] = useState<Partial<Record<UploadKind, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const blobs = useRef<Partial<Record<UploadKind, Blob>>>({});
  /** อ่านบัตรด้วยโมเดลบนเซิร์ฟเวอร์ของบริษัทก่อน (ตั้งไว้ที่หน้าตั้งค่า · 23 พ.ย. 2569) — ล้มเมื่อไหร่ใช้ตัวอ่านในมือถือ */
  const serverOcr = useRef(false);
  const today = useMemo(() => toYmdBangkok(new Date()), []);
  const setForm = useCallback((update: (f: ApplicantForm) => ApplicantForm) => setFormRaw(update), []);

  const stop = useCallback((text: string, retry: boolean) => {
    setStopped({ text, retry });
    setPhase('stopped');
  }, []);

  const showSent = useCallback((s: ApplicantState, r: Receipt) => {
    clearDraft(storage(), s.inviteKey);
    setState(s);
    setReceipt(r);
    setPhase('sent');
    window.scrollTo({ top: 0 });
    void loadOcr()
      .then((m) => m.disposeOcr())
      .catch(() => undefined);
    fetchApplicantReceipt(s.inviteKey)
      .then((x) => setAnswers(x.consents))
      .catch(() => setAnswers(null));
  }, []);

  const enter = useCallback(
    (s: ApplicantState) => {
      rememberOpenedKey(s.inviteKey);
      if (s.submitted) return showSent(s, s.submitted);
      if (s.documents.length !== DOC_TYPES.length) return stop('ระบบส่งเอกสารยังตั้งค่าไม่ครบ ติดต่อเจ้าหน้าที่ที่ส่งลิงก์นี้', false);
      const saved = loadDraft(storage(), s);
      setState(s);
      setFormRaw(saved?.form ?? blankForm());
      setStep(saved?.step ?? 0);
      setPhase('form');
    },
    [showSent, stop],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const config = await fetchApplicantConfig();
        if (!alive) return;
        if (!config.enabled) return stop('ระบบส่งเอกสารปิดอยู่ ติดต่อเจ้าหน้าที่ที่ส่งลิงก์นี้', false);
        serverOcr.current = config.serverOcr === true;
        // โหลดหน้าใหม่ระหว่างกรอก: ใช้รอบเดิมต่อ (คุกกี้) ไม่ต้องขอ LINE ซ้ำ · มีลิงก์ใหม่บนแถบที่อยู่ = เปิดลิงก์นั้น
        const k = inviteFromUrl() ? null : readOpenedKey();
        let opened = k ? await fetchApplicantState(k).catch(() => null) : null;
        if (!opened) {
          readInvite();
          setOpening('กำลังเชื่อม LINE…');
          const token = await getLineIdToken(config);
          if (!alive) return;
          if ('redirecting' in token) return setOpening('กำลังพาไปที่ LINE…');
          const invite = readInvite();
          if (!invite) return stop('เปิดจากลิงก์ที่เจ้าหน้าที่ส่งให้ใน LINE', false);
          setOpening('กำลังเปิดลิงก์…');
          opened = await openApplicantSession(invite, token.idToken);
          hideInviteFromUrl();
          forgetInvite();
        }
        if (alive) enter(opened);
      } catch (e) {
        if (!alive) return;
        const refused = e instanceof ApplicantApiError && e.status >= 400 && e.status < 500 && e.status !== 429;
        if (refused) rememberOpenedKey(null);
        stop(e instanceof Error && e.message ? e.message : 'เปิดลิงก์ไม่ได้ ลองอีกครั้ง', !refused);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enter, stop]);

  // จำสิ่งที่กรอกไว้ในแท็บนี้ (ไม่รวมลายเซ็น)
  useEffect(() => {
    if (phase === 'form' && state) saveDraft(storage(), state.inviteKey, step, form);
  }, [phase, state, step, form]);

  useEffect(
    () => () => {
      void loadOcr()
        .then((m) => m.disposeOcr())
        .catch(() => undefined);
    },
    [],
  );

  /** เซิร์ฟเวอร์บอกว่ารอบหมด/ส่งไปแล้ว = เปลี่ยนจอตามจริง · อย่างอื่นคืนข้อความให้ใบนั้น */
  const apiProblem = useCallback(
    async (e: unknown): Promise<string | null> => {
      if (e instanceof ApplicantApiError && state) {
        if (e.status === 401 || e.status === 410 || e.code === 'invite_mismatch') {
          stop(e.message, false);
          return null;
        }
        if (e.code === 'already_sent') {
          const s = await fetchApplicantState(state.inviteKey).catch(() => null);
          if (s?.submitted) {
            showSent(s, s.submitted);
            return null;
          }
        }
      }
      return e instanceof Error && e.message ? e.message : 'ทำรายการไม่ได้ ลองอีกครั้ง';
    },
    [showSent, state, stop],
  );

  const read = async (kind: UploadKind, fileId: string, blob: Blob) => {
    if (serverOcr.current && state) {
      setWork({ kind, text: 'กำลังอ่านข้อมูลจากภาพ อาจใช้เวลาราว 1 นาที…' });
      try {
        const result = await readApplicantImageOnServer(state.inviteKey, fileId);
        setForm((f) => setSlotOcr(f, kind, fileId, result));
        return;
      } catch {
        // เซิร์ฟเวอร์อ่านไม่ได้/ช้าเกิน → อ่านในมือถือต่อ ผู้สมัครไม่ต้องทำอะไรเพิ่ม
      }
    }
    try {
      const ocr = await loadOcr();
      const result = await ocr.recognizeDocument(blob, kind, (text) => setWork({ kind, text }));
      setForm((f) => setSlotOcr(f, kind, fileId, result));
    } catch {
      setForm((f) => setSlotOcr(f, kind, fileId, null));
      setSlotErrors((x) => ({ ...x, [kind]: 'อ่านข้อมูลจากภาพไม่ได้ กด "อ่านอีกครั้ง" หรือกรอกเองในขั้นถัดไป' }));
    }
  };

  const pick = async (kind: UploadKind, file: File) => {
    if (!state || work || !form.noticeAccepted) return;
    setError(null);
    setSlotErrors((x) => ({ ...x, [kind]: '' }));
    setWork({ kind, text: 'กำลังเตรียมภาพ…' });
    try {
      const ocr = await loadOcr();
      const prepared = await ocr.prepareImage(file, kind);
      setWork({ kind, text: 'กำลังส่งภาพ…' });
      const saved = await uploadApplicantImage(state.inviteKey, kind, prepared.blob);
      blobs.current[kind] = prepared.blob;
      setForm((f) => setSlotFile(f, kind, saved, prepared.quality.warnings));
      if (kind !== 'house') await read(kind, saved.id, prepared.blob);
    } catch (e) {
      const text = await apiProblem(e);
      if (text) setSlotErrors((x) => ({ ...x, [kind]: text }));
    } finally {
      setWork(null);
    }
  };

  const readAgain = async (kind: UploadKind) => {
    const slot = form.slots[kind];
    if (!state || !slot || work) return;
    setSlotErrors((x) => ({ ...x, [kind]: '' }));
    setWork({ kind, text: 'กำลังเตรียมอ่านภาพ…' });
    try {
      let blob = blobs.current[kind];
      if (!blob) {
        const r = await fetch(applicantFileUrl(state.inviteKey, slot.file.id), { credentials: 'same-origin', cache: 'no-store' });
        if (!r.ok) throw new ApplicantApiError(r.status, 'error', 'เปิดภาพที่แนบไว้ไม่ได้ แนบภาพใหม่อีกครั้ง');
        blob = await r.blob();
        blobs.current[kind] = blob;
      }
      setForm((f) => markSlotReading(f, kind));
      await read(kind, slot.file.id, blob);
    } catch (e) {
      setForm((f) => setSlotOcr(f, kind, slot.file.id, null));
      const text = await apiProblem(e);
      if (text) setSlotErrors((x) => ({ ...x, [kind]: text }));
    } finally {
      setWork(null);
    }
  };

  const go = (next: number) => {
    if (!state || work || sending) return;
    if (next > step) {
      for (let s = step; s < next; s++) {
        const problem = stepError(form, s, { today, documents: state.documents });
        if (problem) {
          setError(problem);
          return;
        }
      }
    }
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const submit = async () => {
    if (!state || sending || work) return;
    setError(null);
    const body = packetBody(form, state);
    try {
      validatePacket(body, { today, noticeVersion: state.noticeVersion, templates: Object.fromEntries(state.documents.map((d) => [d.id, d.hash])) });
    } catch (e) {
      setError(e instanceof PacketError ? e.message : 'ตรวจข้อมูลอีกครั้ง');
      return;
    }
    setSending(true);
    try {
      const done = await submitApplicantPacket(state.inviteKey, body);
      showSent(state, { packetId: done.packetId, submittedAt: done.submittedAt });
    } catch (e) {
      const api = e instanceof ApplicantApiError ? e : null;
      if (api && (api.status === 0 || api.status >= 500)) {
        // เน็ตหลุดกลางทาง ชุดอาจบันทึกไปแล้ว — ถามเซิร์ฟเวอร์ก่อน ไม่บอกว่าส่งแล้วถ้ายังไม่มีเลขที่รับ
        const s = await fetchApplicantState(state.inviteKey).catch(() => null);
        if (s?.submitted) showSent(s, s.submitted);
        else setError('ยังส่งไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วกด "ส่งเอกสาร" อีกครั้ง');
      } else if (api && (api.code === 'stale_template' || api.code === 'stale_form')) {
        // ต้นฉบับเปลี่ยนรุ่นระหว่างกรอก — โหลดรุ่นใหม่ ล้างคำตอบและลายเซ็น ให้อ่านแล้วตอบใหม่
        const s = await fetchApplicantState(state.inviteKey).catch(() => null);
        if (s && !s.submitted && s.documents.length === DOC_TYPES.length) {
          setState(s);
          setForm((f) => ({ ...unsign(f), consents: {} }));
          setStep(2);
          setError('เอกสารเปลี่ยนรุ่นแล้ว อ่านและเลือกคำตอบอีกครั้ง');
          window.scrollTo({ top: 0 });
        } else setError(api.message);
      } else {
        const text = await apiProblem(e);
        if (text) setError(text);
      }
    } finally {
      setSending(false);
    }
  };

  if (phase === 'opening') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 text-sm text-muted-foreground" role="status" data-testid="documents-opening">
        {opening}
      </div>
    );
  }
  if (phase === 'stopped' || !state) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 md:py-10">
        <Card className="space-y-3 rounded-2xl p-5 md:p-6" data-testid="documents-stopped">
          <h1 className="text-xl font-medium text-foreground">ส่งเอกสาร</h1>
          <p className="text-sm text-foreground" role="alert">
            {stopped?.text ?? 'เปิดลิงก์ไม่ได้ ลองอีกครั้ง'}
          </p>
          {stopped?.retry ? (
            <Button type="button" onClick={() => window.location.reload()}>
              ลองอีกครั้ง
            </Button>
          ) : null}
        </Card>
      </div>
    );
  }

  const profile = (
    <div className="flex items-center gap-3">
      <Avatar>
        {state.profile.pictureUrl ? <AvatarImage src={state.profile.pictureUrl} alt="รูปบัญชี LINE ที่ใช้ส่ง" /> : null}
        <AvatarFallback>{state.profile.displayName.slice(0, 1) || 'L'}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground" data-testid="line-name">
          LINE: {state.profile.displayName}
        </p>
        <p className="text-xs text-muted-foreground">ลิงก์ใช้ได้ถึง {formatDateTimeTh(state.expiresAt)}</p>
      </div>
    </div>
  );
  const header = (
    <Card className="space-y-3 rounded-2xl p-5 md:p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-medium text-foreground">ส่งเอกสาร</h1>
        <p className="text-sm text-muted-foreground" data-testid="applicant-line">
          {[state.applicant.name, state.applicant.jobLabel].filter(Boolean).join(' · ')}
        </p>
      </div>
      {profile}
    </Card>
  );

  if (phase === 'sent' && receipt) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 md:py-10">
        {header}
        <Card className="rounded-2xl p-5 md:p-6">
          <SubmittedView state={state} receipt={receipt} answers={answers} />
        </Card>
      </div>
    );
  }

  const busy = Boolean(work) || sending;
  const last = step === FORM_STEPS.length - 1;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 md:py-10">
      {header}

      <ol className="grid grid-cols-4 gap-1" aria-label="ขั้นตอน">
        {FORM_STEPS.map((label, i) => (
          <li key={label}>
            <Button
              type="button"
              size="sm"
              variant={i === step ? 'default' : 'outline'}
              className="h-auto w-full flex-col gap-0.5 whitespace-normal px-1 py-2"
              aria-current={i === step ? 'step' : undefined}
              disabled={busy || i > step}
              onClick={() => go(i)}
              data-testid={`step-tab-${i}`}
            >
              <span className="tabular-nums">{i + 1}</span>
              <span>{label}</span>
            </Button>
          </li>
        ))}
      </ol>

      <Card className="space-y-4 rounded-2xl p-5 md:p-6" data-testid={`step-${step}`}>
        {step === 0 ? (
          <>
            <h2 className="text-base font-medium text-foreground">ถ่ายเอกสาร 3 ใบ</h2>
            <PdpaConsentCheck
              checked={form.noticeAccepted}
              onChange={(v) => setForm((f) => ({ ...unsign(f), noticeAccepted: v }))}
              text={PDPA_CONSENT_TEXT_APPLICANT}
              disabled={busy}
            />
            <p className="text-sm text-muted-foreground">ถ่ายให้เห็นทั้งใบ ตัวหนังสือชัด ไม่มีแสงสะท้อน</p>
            {UPLOAD_KINDS.map((kind) => (
              <DocumentUploadCard
                key={kind}
                kind={kind}
                slot={form.slots[kind]}
                imageUrl={form.slots[kind] ? applicantFileUrl(state.inviteKey, form.slots[kind]!.file.id) : null}
                enabled={form.noticeAccepted && !busy}
                busyText={work?.kind === kind ? work.text : null}
                error={slotErrors[kind] || null}
                onPick={(file) => void pick(kind, file)}
                onReadAgain={() => void readAgain(kind)}
                onConfirm={(v) => setForm((f) => confirmSlotImage(f, kind, v))}
              />
            ))}
          </>
        ) : null}
        {step === 1 ? (
          <>
            <h2 className="text-base font-medium text-foreground">ตรวจข้อมูล</h2>
            <StepReview form={form} setForm={setForm} state={state} today={today} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <h2 className="text-base font-medium text-foreground">อ่านเอกสารและเลือกคำตอบ</h2>
            <StepConsent form={form} setForm={setForm} state={state} today={today} />
          </>
        ) : null}
        {step === 3 ? <StepSign form={form} setForm={setForm} state={state} today={today} onEdit={go} /> : null}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" variant="outline" className={cn(step === 0 && 'invisible')} disabled={busy || step === 0} onClick={() => go(step - 1)}>
          ย้อนกลับ
        </Button>
        {last ? (
          <Button type="button" size="lg" disabled={busy} onClick={() => void submit()} data-testid="submit-documents">
            {sending ? 'กำลังส่ง…' : 'ส่งเอกสาร'}
          </Button>
        ) : (
          <Button type="button" size="lg" disabled={busy} onClick={() => go(step + 1)} data-testid="next-step">
            ถัดไป
          </Button>
        )}
      </div>
      {error ? (
        <p className={cn('rounded-xl border p-3 text-sm', TONE.danger.soft, TONE.danger.value)} role="alert" data-testid="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
