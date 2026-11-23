/**
 * ขั้นของฟอร์มส่งเอกสาร (หน้า /apply/documents · 22 พ.ย. 2569): ตรวจข้อมูล · อ่านและตอบ · ลงนามและส่ง · ใบรับหลังส่ง
 * กติกาของข้อมูลอยู่ `src/lib/documents/applicantForm.ts` ไฟล์นี้มีแต่หน้าจอ
 */
import { useId } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AddressFields from '@/components/documents/AddressFields';
import SignaturePad from '@/components/documents/SignaturePad';
import ThaiDateSelect from '@/components/documents/ThaiDateSelect';
import { TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import { cn } from '@/lib/utils';
import {
  ageOn,
  editForm,
  editPerson,
  fullName,
  nationalIdConflict,
  needsNationalIdConfirm,
  setConsent,
  unsign,
  type ApplicantForm,
  type PersonFieldKey,
  type UploadSlot,
} from '@/lib/documents/applicantForm';
import { applicantFileUrl, applicantPdfUrl, applicantTemplateUrl } from '@/lib/documents/applicantDocumentsApi';
import { PERSON_PREFIXES, SENDER_RELATIONS, SENDER_RELATION_LABEL, SIGNATURE_METHOD_LABEL, UPLOAD_LABEL, answerLabel, type SenderRelation } from '@/lib/documents/documentTypes';
import type { ApplicantState } from '@/lib/documents/documentViews';
import { formatAddress } from '@/lib/documents/thaiAddress';

export type StepProps = {
  form: ApplicantForm;
  setForm: (update: (form: ApplicantForm) => ApplicantForm) => void;
  state: ApplicantState;
  /** วันนี้ตามเวลาไทย YYYY-MM-DD */
  today: string;
};

const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

function Tick({ checked, onChange, children, testId }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; testId?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2 text-sm text-foreground">
      <Checkbox id={id} className="mt-0.5" checked={checked} onCheckedChange={(v) => onChange(v === true)} data-testid={testId} />
      <label htmlFor={id} className="cursor-pointer leading-relaxed">
        {children}
      </label>
    </div>
  );
}

function SourceImage({ k, slot, label }: { k: string; slot: UploadSlot | undefined; label: string }) {
  if (!slot) return null;
  const url = applicantFileUrl(k, slot.file.id);
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt={`ภาพ${label}ที่แนบ`} className="w-full rounded-xl border border-border" />
    </a>
  );
}

const ConflictNote = () => (
  <p className={cn('rounded-xl border p-3 text-sm', TONE.danger.soft, TONE.danger.value)} role="alert" data-testid="id-conflict">
    เลขบัตรประชาชนบนบัตรกับบนใบขับขี่ไม่ตรงกัน ตรวจกับภาพทั้งสองใบ ถ้าตรงตามเอกสารแล้วส่งต่อได้ เจ้าหน้าที่จะตรวจจุดนี้
  </p>
);

// ─── ขั้น 2 ตรวจข้อมูล ────────────────────────────────────────────────────────
export function StepReview({ form, setForm, state, today }: StepProps) {
  const id = useId();
  const p = form.person;
  const year = Number(today.slice(0, 4));
  const age = ageOn(p.dob, today);
  const text = (key: PersonFieldKey, label: string, opts: { span?: boolean; max?: number; numeric?: number; autoComplete?: string; placeholder?: string } = {}) => (
    <div className={cn('space-y-1.5', opts.span && 'col-span-2')}>
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input
        id={`${id}-${key}`}
        value={p[key]}
        maxLength={opts.numeric ?? opts.max ?? 100}
        inputMode={opts.numeric ? 'numeric' : undefined}
        autoComplete={opts.autoComplete ?? 'off'}
        placeholder={opts.placeholder}
        className={opts.numeric ? 'tabular-nums' : undefined}
        onChange={(e) => setForm((f) => editPerson(f, key, opts.numeric ? digits(e.target.value, opts.numeric) : e.target.value))}
      />
    </div>
  );
  const date = (key: PersonFieldKey, label: string, from: number, to: number, disabled = false) => (
    <div className="col-span-2 space-y-1.5">
      <Label>{label}</Label>
      <ThaiDateSelect value={p[key]} label={label} fromYear={from} toYear={to} disabled={disabled} onChange={(v) => setForm((f) => editPerson(f, key, v))} />
    </div>
  );

  return (
    <div className="space-y-6" data-testid="step-review">
      <section className="space-y-3">
        <h2 className="text-base font-medium text-foreground">ข้อมูลตามบัตรประชาชน</h2>
        <SourceImage k={state.inviteKey} slot={form.slots.id} label={UPLOAD_LABEL.id} />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>คำนำหน้า</Label>
            <Select value={p.prefix} onValueChange={(v) => setForm((f) => editPerson(f, 'prefix', v))}>
              <SelectTrigger aria-label="คำนำหน้า">
                <SelectValue placeholder="เลือกคำนำหน้า" />
              </SelectTrigger>
              <SelectContent>
                {PERSON_PREFIXES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {text('firstName', 'ชื่อ', { autoComplete: 'given-name' })}
          {text('lastName', 'นามสกุล', { autoComplete: 'family-name' })}
          {text('firstNameEn', 'ชื่อภาษาอังกฤษ')}
          {text('lastNameEn', 'นามสกุลภาษาอังกฤษ')}
          {text('nationalId', 'เลขบัตรประชาชน', { span: true, numeric: 13, placeholder: '13 หลัก' })}
          {needsNationalIdConfirm(form) ? (
            <div className={cn('col-span-2 space-y-2 rounded-xl border p-3', TONE.warn.soft)} data-testid="national-id-check">
              <p className={cn('text-sm', TONE.warn.value)}>เลขบัตรประชาชนนี้ไม่ผ่านการตรวจหลักสุดท้าย เทียบกับบัตรอีกครั้ง</p>
              <Tick checked={form.nationalIdConfirmed} onChange={(v) => setForm((f) => editForm(f, { nationalIdConfirmed: v }))}>
                เลขนี้ตรงกับบัตรแล้ว
              </Tick>
            </div>
          ) : null}
          {date('dob', 'วันเกิด', year - 80, year - 15)}
          <p className="col-span-2 text-sm text-muted-foreground" data-testid="age-line">
            อายุ <span className="tabular-nums">{age === null ? '—' : age}</span> ปี
          </p>
          {date('idIssued', 'วันออกบัตรประชาชน', year - 12, year)}
          {date('idExpiry', 'วันหมดอายุบัตรประชาชน', year - 10, year + 12, form.idLifetime)}
          <div className="col-span-2">
            <Tick checked={form.idLifetime} onChange={(v) => setForm((f) => editForm(v ? { ...f, person: { ...f.person, idExpiry: '' } } : f, { idLifetime: v }))}>
              บัตรตลอดชีพ ไม่มีวันหมดอายุ
            </Tick>
          </div>
          {text('phone', 'เบอร์มือถือ', { span: true, numeric: 10, autoComplete: 'tel', placeholder: '0812345678' })}
        </div>
      </section>

      <Separator />
      <section className="space-y-3">
        <h2 className="text-base font-medium text-foreground">ที่อยู่ตามทะเบียนบ้าน</h2>
        <AddressFields name="ตามทะเบียนบ้าน" value={form.registered} onChange={(registered) => setForm((f) => editForm(f, { registered }))} />
      </section>

      <Separator />
      <section className="space-y-3">
        <h2 className="text-base font-medium text-foreground">ที่อยู่ปัจจุบัน</h2>
        <Tick checked={form.sameAsRegistered} onChange={(v) => setForm((f) => editForm(f, { sameAsRegistered: v }))} testId="same-address">
          ที่อยู่ปัจจุบันเหมือนทะเบียนบ้าน
        </Tick>
        {form.sameAsRegistered ? (
          <p className="rounded-xl border border-border p-3 text-sm text-foreground" data-testid="same-address-text">
            {formatAddress(form.registered) || 'เลือกที่อยู่ตามทะเบียนบ้านให้ครบก่อน'}
          </p>
        ) : (
          <AddressFields name="ปัจจุบัน" value={form.current} onChange={(current) => setForm((f) => editForm(f, { current }))} />
        )}
      </section>

      <Separator />
      <section className="space-y-3">
        <h2 className="text-base font-medium text-foreground">ข้อมูลใบขับขี่</h2>
        <SourceImage k={state.inviteKey} slot={form.slots.license} label={UPLOAD_LABEL.license} />
        <div className="grid grid-cols-2 gap-3">
          {text('licenseNumber', 'เลขใบขับขี่', { span: true, max: 20 })}
          {text('licenseType', 'ประเภทใบขับขี่', { span: true, max: 80 })}
          {text('licenseNationalId', 'เลขบัตรประชาชนบนใบขับขี่', { span: true, numeric: 13, placeholder: '13 หลัก' })}
          {date('licenseIssued', 'วันออกใบขับขี่', year - 12, year)}
          {date('licenseExpiry', 'วันหมดอายุใบขับขี่', year - 10, year + 12, form.licenseLifetime)}
          <div className="col-span-2">
            <Tick checked={form.licenseLifetime} onChange={(v) => setForm((f) => editForm(v ? { ...f, person: { ...f.person, licenseExpiry: '' } } : f, { licenseLifetime: v }))}>
              ใบขับขี่ตลอดชีพ ไม่มีวันหมดอายุ
            </Tick>
          </div>
        </div>
        {nationalIdConflict(form) ? <ConflictNote /> : null}
      </section>

      <Separator />
      <Tick checked={form.reviewed} onChange={(v) => setForm((f) => ({ ...unsign(f), reviewed: v }))} testId="reviewed">
        ตรวจข้อมูลและที่อยู่เทียบกับภาพแล้ว ถูกต้องทุกช่อง
      </Tick>
    </div>
  );
}

// ─── ขั้น 3 อ่านและตอบ ────────────────────────────────────────────────────────
export function StepConsent({ form, setForm, state }: StepProps) {
  const id = useId();
  return (
    <div className="space-y-8" data-testid="step-consent">
      {state.documents.map((d, i) => (
        <section key={d.id} className="space-y-3" data-testid={`consent-${d.id}`}>
          <h2 className="text-base font-medium text-foreground">
            {i + 1}. {d.title}
          </h2>
          {Array.from({ length: d.pages }, (_, n) => {
            const url = applicantTemplateUrl(state.inviteKey, d.id, n + 1);
            return (
              <figure key={n} className="space-y-1">
                <a href={url} target="_blank" rel="noreferrer" className="block">
                  <img src={url} loading="lazy" alt={`${d.title} หน้า ${n + 1}`} className="w-full rounded-xl border border-border bg-white" />
                </a>
                <figcaption className="text-xs text-muted-foreground">
                  หน้า {n + 1} จาก {d.pages}
                </figcaption>
              </figure>
            );
          })}
          <RadioGroup value={form.consents[d.id] ?? ''} onValueChange={(v) => setForm((f) => setConsent(f, d.id, v))} aria-label={`คำตอบของ${d.title}`} className="gap-2">
            {d.answers.map((a) => (
              <div key={a.value} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <RadioGroupItem value={a.value} id={`${id}-${d.id}-${a.value}`} className="mt-0.5" />
                <Label htmlFor={`${id}-${d.id}-${a.value}`} className="cursor-pointer text-sm leading-relaxed">
                  {a.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </section>
      ))}
    </div>
  );
}

// ─── ขั้น 4 ลงนามและส่ง ───────────────────────────────────────────────────────
export function StepSign({ form, setForm, state, onEdit }: StepProps & { onEdit: (step: number) => void }) {
  const id = useId();
  const p = form.person;
  const name = fullName(form);
  const current = form.sameAsRegistered ? form.registered : form.current;
  const row = (label: string, value: string) => (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words text-foreground">{value || '—'}</dd>
    </div>
  );
  return (
    <div className="space-y-6" data-testid="step-sign">
      <section className="space-y-3">
        <h2 className="text-base font-medium text-foreground">ข้อมูลที่จะส่ง</h2>
        <dl className="space-y-2 rounded-xl border border-border p-3">
          {row('ชื่อ', `${p.prefix === 'อื่น ๆ' ? '' : p.prefix}${name}`)}
          {row('เลขบัตรประชาชน', p.nationalId)}
          {row('เบอร์มือถือ', p.phone)}
          {row('ตามทะเบียนบ้าน', formatAddress(form.registered))}
          {row('ปัจจุบัน', formatAddress(current))}
          {row('เลขใบขับขี่', p.licenseNumber)}
        </dl>
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(1)}>
          แก้ข้อมูล
        </Button>
        {nationalIdConflict(form) ? <ConflictNote /> : null}
      </section>

      <Separator />
      <section className="space-y-3">
        <h2 className="text-base font-medium text-foreground">คำตอบเอกสาร</h2>
        <dl className="space-y-2 rounded-xl border border-border p-3" data-testid="answers-summary">
          {state.documents.map((d) => (
            <div key={d.id} className="space-y-0.5 text-sm">
              <dt className="text-muted-foreground">{d.title}</dt>
              <dd className="text-foreground">{answerLabel(d.id, form.consents[d.id])}</dd>
            </div>
          ))}
        </dl>
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(2)}>
          แก้คำตอบ
        </Button>
      </section>

      <Separator />
      <section className="space-y-3">
        <h2 className="text-base font-medium text-foreground">ลงนาม</h2>
        <RadioGroup
          value={form.signMethod}
          onValueChange={(v) => setForm((f) => ({ ...unsign(f), signMethod: v === 'drawn' ? 'drawn' : 'typed' }))}
          aria-label="วิธีลงนาม"
          className="grid grid-cols-2 gap-2"
        >
          {(['typed', 'drawn'] as const).map((m) => (
            <div key={m} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <RadioGroupItem value={m} id={`${id}-sign-${m}`} />
              <Label htmlFor={`${id}-sign-${m}`} className="cursor-pointer text-sm">
                {SIGNATURE_METHOD_LABEL[m]}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-sign-name`}>ชื่อ-นามสกุลผู้ลงนาม</Label>
          <Input
            id={`${id}-sign-name`}
            value={form.signName}
            placeholder={name}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => setForm((f) => ({ ...f, signName: e.target.value, signatureIntent: false, confirmed: false }))}
          />
        </div>
        {form.signMethod === 'drawn' ? (
          <SignaturePad value={form.signImage} onChange={(signImage) => setForm((f) => ({ ...f, signImage, signatureIntent: false, confirmed: false }))} />
        ) : (
          <p className="rounded-xl border border-border bg-white p-4 text-center text-xl text-black" data-testid="typed-signature">
            {form.signName.trim() || '—'}
          </p>
        )}
        <Tick checked={form.signatureIntent} onChange={(v) => setForm((f) => ({ ...f, signatureIntent: v, confirmed: v ? f.confirmed : false }))} testId="sign-intent">
          ใช้ลายเซ็นนี้ลงนามเอกสารทั้ง {state.documents.length} ฉบับ ตามคำตอบที่เลือกไว้
        </Tick>
      </section>

      <Separator />
      <section className="space-y-3">
        <h2 className="text-base font-medium text-foreground">ผู้ส่ง</h2>
        <div className="flex items-center gap-3">
          <Avatar>
            {state.profile.pictureUrl ? <AvatarImage src={state.profile.pictureUrl} alt="รูปบัญชี LINE ที่ใช้ส่ง" /> : null}
            <AvatarFallback>{state.profile.displayName.slice(0, 1) || 'L'}</AvatarFallback>
          </Avatar>
          <p className="min-w-0 text-sm text-foreground">
            บัญชี LINE <span className="font-medium">{state.profile.displayName}</span>
          </p>
        </div>
        <RadioGroup
          value={form.senderRelation}
          onValueChange={(v) => setForm((f) => ({ ...f, senderRelation: (SENDER_RELATIONS as readonly string[]).includes(v) ? (v as SenderRelation) : '', confirmed: false }))}
          aria-label="ผู้ส่งเป็นใคร"
          className="grid grid-cols-2 gap-2"
        >
          {SENDER_RELATIONS.map((r) => (
            <div key={r} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <RadioGroupItem value={r} id={`${id}-sender-${r}`} />
              <Label htmlFor={`${id}-sender-${r}`} className="cursor-pointer text-sm">
                {SENDER_RELATION_LABEL[r]}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <Tick checked={form.confirmed} onChange={(v) => setForm((f) => ({ ...f, confirmed: v }))} testId="confirm-send">
          ยืนยันส่งเอกสารของ {state.applicant.name} ด้วยบัญชี LINE {state.profile.displayName}
        </Tick>
      </section>
    </div>
  );
}

// ─── หลังส่ง ─────────────────────────────────────────────────────────────────
export function SubmittedView({ state, receipt, answers }: { state: ApplicantState; receipt: { packetId: string; submittedAt: string }; answers: Record<string, string> | null }) {
  return (
    <div className="space-y-4" data-testid="submitted">
      <div className="space-y-1">
        <h1 className="text-xl font-medium text-foreground">ส่งเอกสารแล้ว</h1>
        <p className="text-sm text-muted-foreground">
          {formatDateTimeTh(receipt.submittedAt)} · เลขที่รับ <span className="tabular-nums" data-testid="receipt-id">{receipt.packetId.slice(0, 8).toUpperCase()}</span>
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {state.documents.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm text-foreground">{d.title}</p>
              <p className="text-xs text-muted-foreground">{answers ? answerLabel(d.id, answers[d.id]) : '—'}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <a href={applicantPdfUrl(state.inviteKey, d.id)} target="_blank" rel="noreferrer">
                เปิด PDF
              </a>
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">ต้องการแก้ไข ติดต่อเจ้าหน้าที่ที่ส่งลิงก์ให้</p>
    </div>
  );
}
