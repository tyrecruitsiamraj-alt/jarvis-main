/**
 * ═══ หน้าเข้าสู่ระบบ — **หน้าตาของ `tundralogin_v3.html` การทำงานของเรา** ═══
 *
 * เจ้าของส่ง mockup มา 27 ส.ค. 2569 แล้วสั่ง: *"ถ้าใช้ได้ก็ใช้ แต่อยากให้มีแค่แบบของเรา
 * เหมือนอยากได้ค่าภาพกับอะไรต่าง ๆ ของเขา แต่การทำงานเป็นแบบเรา"*
 * ⚠️ รอบแรกผมไปสลับภาพเป็นฉากออฟฟิศของเราเอง โดนย้ำว่า
 * *"บ้าหรอ จะเอาแบบไฟล์ HTML ที่ส่งให้ดิ ทำนอกเหนือจากที่สั่งอีกแล้ว"*
 * ⇒ **หน้าตายกมาเป๊ะ ห้ามตีความเอง** ภาพป่า · จานกระดาษ-เขียวป่า · ตัวอักษร Instrument Sans
 * · การ์ดกระจก · ช่องกรอกมุมโค้ง · ปุ่มแคปซูลเขียวป่า · เส้น "หรือ" ตัวพิมพ์ใหญ่
 * (ค่าสีทุกตัวอยู่ที่ `LOGIN_SCENE` · ชั้นของฉากอยู่ที่ `PhotoScene`)
 *
 * 🔴 **ฉากเดิม จานสีใหม่** (เจ้าของเคาะ 5 ก.ย. 2569: *"หน้า Login กลับไปพื้นหลังเดิม
 * ที่เปลี่ยนโทนเป็น ขาว + navy + burgundy เล็กน้อย"*)
 * ⇒ **ภาพป่ากับชั้นฉากของ mockup อยู่ครบเหมือนเดิม** (`<PhotoScene />`)
 * เปลี่ยนแค่ *จานสีที่ทาบบนฉาก* — ตัวหนังสือกรมท่า ปุ่มเบอร์กันดี การ์ดกระจกขาว
 * เหตุ: *"ของฉันมันมีหลาย BU ถ้าเขียวเยอะไปมันจะดูเป็นการขายพวกงานสวนเกิน"*
 * ⚠️ เคยลองทาบผ้ากรมท่าทับภาพทั้งใบ (4 ก.ย.) แล้ว **ทึบจนอ่านยาก** — ถอดทิ้งแล้ว
 * ⚠️ หุ่นยนต์ผู้ช่วยเคยมาอยู่หน้านี้รอบเดียว เจ้าของสั่งย้ายไป **หน้าหลัก** (5 ก.ย. 2569)
 *
 * **ตัดออกแค่ของที่ไม่ใช่ "หน้าตา" แต่เป็นการทำงาน (เจ้าของสั่งว่าการทำงานเป็นของเรา):**
 * - แถบเมนู Overview/Pricing/Book a Demo — เมนูขายของ ระบบในบ้านไม่มีอะไรจะขาย
 * - 🔴 "Create an account" — ระบบ HR สมัครเองไม่ได้ ผู้ดูแลเพิ่มให้เท่านั้น
 * - `autocomplete="off"` — สั่งห้ามตัวจำรหัสผ่านช่วยกรอก ทั้งบริษัทใช้กันหมด
 *
 * 🔴 **ตรรกะเข้าระบบไม่ถูกแตะแม้แต่บรรทัดเดียว** — โหลด config + retry 3 ครั้ง ·
 * ข้อความ error ของ Microsoft OAuth · กฎ `shouldShowPasswordUi` · `returnTo` ที่กัน
 * open redirect · ทางเข้าบอร์ดรับสมัคร · ทุกอย่างเป็นของเดิมทั้งหมด
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';

import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { LOGIN_SCENE } from '@/lib/designTokens';
import PhotoScene from '@/components/shared/PhotoScene';
import BrandIntro from '@/components/auth/BrandIntro';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { shouldShowPasswordUi, type AuthConfig as SharedAuthConfig } from '@/lib/authConfig';
import { cn } from '@/lib/utils';

/**
 * รูปร่างที่หน้านี้ใช้ — ต่อยอดจาก type กลาง (`@/lib/authConfig`) โดยบังคับให้ฟิลด์
 * ที่หน้า Login ต้องมีจริง เป็น required · กฎ "โชว์ของรหัสผ่านไหม" ใช้ของกลางที่เดียว
 */
type AuthConfig = SharedAuthConfig & {
  devRoleLogin: boolean;
  emailLoginGate: boolean;
  companyEmailRequired: boolean;
  allowedDomains: string[];
  companyEmailHint: string | null;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  no_account: 'บัญชี Microsoft นี้ยังไม่ได้ลงทะเบียนในระบบ — ติดต่อผู้ดูแล',
  disabled: 'บัญชีนี้ถูกปิดใช้งาน',
  domain: 'กรุณาใช้อีเมลบริษัทที่อนุญาตเท่านั้น',
  state: 'เซสชันหมดอายุ — กรุณาลองเข้าสู่ระบบอีกครั้ง',
  oauth: 'เข้าสู่ระบบ Microsoft ไม่สำเร็จ — ลองใหม่อีกครั้ง',
  azure_not_configured: 'การเข้าสู่ระบบด้วย Microsoft ยังไม่พร้อม — ติดต่อผู้ดูแลระบบให้ตั้งค่า Azure AD',
};

/** เส้นผมของการ์ด — กรมท่าจาง ๆ บนพื้นขาว (มาจาก token ที่เดียว) */
const HAIRLINE = LOGIN_SCENE.line;

/** รัศมีขาวหนุนตัวหนังสือที่วางบนภาพป่าโดยตรง — เหลือใช้แค่ตราบริษัทมุมซ้ายบน */
const TEXT_ON_PHOTO = '0 1px 0 rgba(255,255,255,.55), 0 2px 20px rgba(255,255,255,.75)';

/** ป้ายชื่อช่องกรอก */
const FIELD_LABEL = 'mb-2 ml-0.5 block text-xs font-medium';

/**
 * ช่องกรอกของ mockup — พื้นขาวโปร่ง ขอบเขียวจาง มีไฮไลต์ด้านใน
 * ⚠️ ทับ `jarvis-soft-field` ของระบบเพราะหน้านี้เป็นจานกระดาษ ไม่ใช่จานฟ้าของแอป
 */
const FIELD_CLASS = 'h-[46px] rounded-xl text-[15px] shadow-none';
const FIELD_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, .92)',
  borderColor: HAIRLINE,
  color: LOGIN_SCENE.ink,
  boxShadow: 'inset 0 1px rgba(18, 32, 60, .04)',
};

/** ปุ่มลงมือ — แคปซูลเบอร์กันดีไล่เฉด ตัวหนังสือขาว */
const PRIMARY_BTN: React.CSSProperties = {
  background: `linear-gradient(180deg, ${LOGIN_SCENE.burgundy2}, ${LOGIN_SCENE.burgundy})`,
  color: LOGIN_SCENE.canvas,
  boxShadow: '0 10px 24px rgba(140, 47, 57, .26)',
};

/** ปุ่ม SSO — แคปซูลขาว ตัวหนังสือกรมท่า */
const SSO_BTN: React.CSSProperties = {
  background: 'rgba(255, 255, 255, .96)',
  border: `1px solid ${HAIRLINE}`,
  color: LOGIN_SCENE.ink,
};

/** การ์ดกระจก — ขาวโปร่งบนพื้นขาว เห็นเป็นใบด้วย "เงา" ไม่ใช่ด้วยสี */
const GLASS_CARD: React.CSSProperties = {
  background: `linear-gradient(180deg, ${LOGIN_SCENE.glassStrong}, ${LOGIN_SCENE.glass})`,
  border: `1px solid ${HAIRLINE}`,
  boxShadow:
    '0 26px 70px rgba(18, 32, 60, .12), 0 2px 8px rgba(18, 32, 60, .05), inset 0 1px rgba(255,255,255,.9)',
  backdropFilter: 'blur(28px) saturate(1.28)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.28)',
};

/**
 * จังหวะไล่โผล่ — ยกจาก mockup (หัวเรื่อง → การ์ด → ท้าย เหลื่อมกันทีละเสี้ยววินาที)
 *
 * ⚠️ **แอปนี้ไม่มี `MotionConfig`** ⇒ framer-motion ไม่ได้เคารพ `prefers-reduced-motion`
 * ให้เอง ต้องกั้นเองที่นี่ (mockup กั้นด้วย media query ในไฟล์ CSS ของมัน)
 */
function useRise() {
  const reduced = useReducedMotion();
  return (delay: number) =>
    reduced
      ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
        };
}

// ─── Email / Password form ────────────────────────────────────────────────────
function EmailPasswordForm({
  hint,
  onError,
}: {
  hint: string | null;
  onError: (msg: string) => void;
}) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    onError('');
    if (!email.trim() || !password) {
      setFormError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setSubmitting(true);
    const err = await signIn(email.trim(), password);
    setSubmitting(false);
    if (err) {
      setFormError(err);
      return;
    }
    const returnTo = searchParams.get('returnTo');
    const safe =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/';
    navigate(safe, { replace: true });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div className="space-y-3">
        <div>
          <label htmlFor="login-email" className={FIELD_LABEL} style={{ color: LOGIN_SCENE.muted }}>
            อีเมล
          </label>
          {/* 🔴 `autoComplete` ต้องคงไว้ — ทั้งบริษัทใช้ตัวจำรหัสผ่าน
              (mockup ใส่ `autocomplete="off"` ทั้งฟอร์ม ซึ่งกวนเปล่า ๆ) */}
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={submitting}
            aria-describedby={hint ? 'login-email-hint' : undefined}
            className={FIELD_CLASS}
            style={FIELD_STYLE}
          />
          {/* 🔴 คำใบ้โดเมนบริษัทเป็น **บรรทัดใต้ช่อง** ไม่ใช่ placeholder
              (ของเดิมยัดเป็น placeholder ⇒ บนมือถือถูกตัดกลางประโยคเป็น "…เท่านั้ั"
              และหายทันทีที่เริ่มพิมพ์ ซึ่งเป็นตอนที่ต้องเห็นที่สุด) */}
          {hint ? (
            <p
              id="login-email-hint"
              className="mt-1.5 text-[11px] leading-4"
              style={{ color: LOGIN_SCENE.muted }}
            >
              {hint}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="login-password" className={FIELD_LABEL} style={{ color: LOGIN_SCENE.muted }}>
            รหัสผ่าน
          </label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              disabled={submitting}
              className={cn(FIELD_CLASS, 'pr-10')}
              style={FIELD_STYLE}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100 opacity-60"
              style={{ color: LOGIN_SCENE.ink }}
              aria-label={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {formError ? (
        <p className="text-xs text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      {/* ปุ่มลงมือ = แคปซูลเขียวป่าไล่เฉด ตาม mockup */}
      <Button
        type="submit"
        disabled={submitting}
        className="mt-1.5 min-h-12 w-full rounded-full border-0 text-[15px] font-semibold hover:brightness-110"
        style={PRIMARY_BTN}
      >
        {submitting ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            กำลังเข้าสู่ระบบ…
          </>
        ) : (
          'เข้าสู่ระบบ'
        )}
      </Button>
    </form>
  );
}

// ─── Microsoft button ─────────────────────────────────────────────────────────
function MicrosoftLoginButton() {
  const { signInWithMicrosoft } = useAuth();
  return (
    <Button
      type="button"
      onClick={() => signInWithMicrosoft('/')}
      className="min-h-12 w-full rounded-full text-[15px] font-medium hover:brightness-[1.04]"
      style={SSO_BTN}
    >
      {/* ⚠️ สี่เหลี่ยม 4 สีเป็น **สีแบรนด์ Microsoft** ต้องเป๊ะ — ข้อยกเว้นของกติกา "ห้าม hex ดิบ" */}
      <svg viewBox="0 0 21 21" className="shrink-0" aria-hidden>
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
      เข้าสู่ระบบด้วย Microsoft
    </Button>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3" role="separator">
      <div className="h-px flex-1" style={{ background: HAIRLINE }} />
      <span
        className="text-[11px] uppercase tracking-[0.08em]"
        style={{ color: LOGIN_SCENE.muted }}
      >
        หรือ
      </span>
      <div className="h-px flex-1" style={{ background: HAIRLINE }} />
    </div>
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * ═══ ซ้ายมือของหน้าเข้าสู่ระบบ — **ระบบนี้ทำอะไรให้** ═══
 * (เจ้าของสั่ง 4 ก.ย. 2569: *"แบ่งครึ่งซ้ายขวา ขวาเป็น Login ซ้ายเป็นแบบอธิบายระบบ
 * อธิบายแบบด้วยลูกเล่นที่เท่ ๆ"*)
 *
 * **ลูกเล่นที่ใช้** — ทำจาก state + utility ล้วน ๆ:
 *   1. สี่บรรทัดงานไล่โผล่ทีละอัน แล้ว **ไฮไลต์ไล่ลงมาเรื่อย ๆ** เหมือนสายพานเดิน
 *   2. จุดสถานะเต้น (`animate-pulse` ของ Tailwind)
 *
 * ⚠️ **เลิกใช้คำหัวเรื่องสลับวน** (เจ้าของทัก 5 ก.ย. 2569: *"ดูไม่สมูทเลย คำมันแปลก ๆ"*)
 * ของเดิมเป็น "ระบบสรรหาที่ทำให้" + คำสลับ ⇒ ต่อกันแล้วเป็นประโยคที่คนไทยไม่พูด
 * ("ระบบสรรหาที่ทำให้ไม่มีใบขอตกหล่น") และตอนสลับคำสองคำซ้อนกันเห็นเป็นเงา
 * ⇒ เปลี่ยนเป็นประโยคเดียวนิ่ง ๆ ที่อ่านรู้เรื่อง ลูกเล่นเหลือที่สายพานอย่างเดียว
 * 🔴 **ไม่มี CSS ใหม่สักบรรทัด** (กฎเจ้าของ 4 ก.ย. 2569) — ใช้ `animate-in` ของ
 * tailwindcss-animate + `transition` + `animate-pulse` ที่มีอยู่แล้ว
 * 🔴 สีทุกสีมาจาก `LOGIN_SCENE` (จานสีของหน้านี้) ไม่มี hex ดิบ
 */
const INTRO_STEPS = [
  { title: 'รับใบขอจากหน่วยงาน', desc: 'ทุกใบบอกเองว่าค้างมากี่วัน ใบไหนต้องรีบ' },
  { title: 'ปล่อยประกาศ + จับคู่คน', desc: 'ลงประกาศทีเดียวหลายช่องทาง แล้ว AI แนะนำคนให้' },
  { title: 'ให้ AI โทรแทน', desc: 'โทรตามนัด บันทึกผลเอง คุยไม่ได้ค่อยส่งต่อให้คน' },
  { title: 'ตามจนถึงวันเริ่มงาน', desc: 'ติดตามต่อหลังเริ่มงาน กันหลุดในเดือนแรก' },
] as const;

const SystemIntro: React.FC<{ rise: ReturnType<typeof useRise> }> = ({ rise }) => {
  const [activeStep, setActiveStep] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // ผู้ใช้ตั้งค่าไม่เอาแอนิเมชัน = อยู่นิ่ง ๆ (กติกาเดิมของโปรเจกต์)
    if (reduceMotion) return;
    const t = window.setInterval(() => setActiveStep((n) => (n + 1) % INTRO_STEPS.length), 1600);
    return () => window.clearInterval(t);
  }, [reduceMotion]);

  return (
    /**
     * 🔴 พื้นกระจก**บางกว่า**การ์ดล็อกอิน (ไม่มีเงาหนา) — ไม่งั้นกลายเป็น "สองการ์ด"
     * ซึ่งเป็นสิ่งที่เจ้าของเพิ่งสั่งเอาออก · ฝั่งนี้เป็นคำอธิบาย ฝั่งขวาคือของที่ต้องกด
     */
    <motion.div
      {...rise(0.12)}
      className="w-full rounded-3xl p-6"
      style={{
        /* ทึบพอให้ตัวหนังสืออ่านออกบนกิ่งไม้ที่ลายพร้อย (เจ้าของทัก 5 ก.ย. 2569) */
        background: LOGIN_SCENE.glassStrong,
        border: `1px solid ${HAIRLINE}`,
        backdropFilter: 'blur(20px) saturate(1.2)',
      }}
    >
      <p
        className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: LOGIN_SCENE.muted }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: LOGIN_SCENE.accent }}
          aria-hidden
        />
        ONE RECRUIT · ONE SOLUTION · ONE STOP
      </p>

      <h2
        className="mt-2 text-[clamp(20px,2.2vw,26px)] font-[610] leading-snug"
        style={{ color: LOGIN_SCENE.ink }}
      >
        งานสรรหา ครบ จบ ที่เดียว
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: LOGIN_SCENE.muted }}>
        ตั้งแต่รับใบขอ ปล่อยประกาศ ให้ AI โทรตาม จนถึงวันเริ่มงาน
      </p>

      {/* สายพาน 4 ขั้น — ไฮไลต์ไล่ลงมาเรื่อย ๆ ให้เห็นว่างานไหลยังไง */}
      <ol className="mt-5 space-y-1.5">
        {INTRO_STEPS.map((s, i) => {
          const on = i === activeStep;
          return (
            <li
              key={s.title}
              className={cn(
                'flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-all duration-500 ease-out',
                'animate-in fade-in slide-in-from-left-4',
                i === 1 && 'delay-75',
                i === 2 && 'delay-150',
                i === 3 && 'delay-200',
              )}
              style={
                on
                  ? {
                      background: 'rgba(255, 255, 255, .96)',
                      boxShadow: '0 8px 22px rgba(18, 32, 60, .10)',
                    }
                  : undefined
              }
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-500"
                style={
                  on
                    ? { background: LOGIN_SCENE.burgundy, color: LOGIN_SCENE.canvas }
                    : { background: 'rgba(18, 32, 60, .07)', color: LOGIN_SCENE.muted }
                }
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[14px] font-semibold leading-snug"
                  style={{ color: LOGIN_SCENE.ink }}
                >
                  {s.title}
                </span>
                <span
                  className="block text-[12.5px] leading-relaxed"
                  style={{ color: LOGIN_SCENE.muted }}
                >
                  {s.desc}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
};

const LoginPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rise = useRise();

  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  // แสดง error จาก OAuth (Microsoft) ที่เด้งกลับมาทาง ?auth_error=
  useEffect(() => {
    const code = searchParams.get('auth_error');
    if (!code) return;
    setError(AUTH_ERROR_MESSAGES[code] || 'เข้าสู่ระบบไม่สำเร็จ');
    const next = new URLSearchParams(searchParams);
    next.delete('auth_error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // โหลด config พร้อม retry — กันหน้า Login ค้าง "กำลังโหลด" ถ้า API ยังไม่พร้อม
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    (async () => {
      for (let attempt = 1; attempt <= 3 && !cancelled; attempt++) {
        try {
          const r = await apiFetch('/api/auth/config');
          if (cancelled) return;
          if (r.ok) {
            const data = (await r.json()) as AuthConfig;
            if (!cancelled) {
              setAuthConfig(data);
              setConfigError(false);
            }
            return;
          }
        } catch {
          /* ลองใหม่ */
        }
        if (attempt < 3) {
          await new Promise((resolve) => {
            timer = window.setTimeout(resolve, 1500 * attempt);
          });
        }
      }
      if (!cancelled) setConfigError(true);
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [configAttempt]);

  const showMicrosoft = authConfig?.microsoftLogin ?? false;
  /**
   * แสดงฟอร์มอีเมล+รหัสผ่านไหม — **กฎอยู่ที่ `shouldShowPasswordUi` ที่เดียว**
   * (ใช้ร่วมกับปุ่ม/เมนู "เปลี่ยนรหัสผ่าน" ในเปลือกแอป ไม่งั้นซ่อนไม่ครบ)
   * เจ้าของสั่ง 22 ส.ค. 2569 ให้ล็อกเข้าทางปุ่ม Microsoft · fail-safe อยู่ในฟังก์ชันนั้น
   */
  const showEmail = shouldShowPasswordUi(authConfig);
  const noWayIn = !showEmail && !showMicrosoft;

  return (
    <div
      className="relative min-h-[100dvh] overflow-x-hidden"
      /* 🔴 เปลี่ยนเป็น Kanit ตามคำสั่งล่าสุด 4 ก.ย. 2569 (*"ทั้งระบบต้องเป็น font Kanit"*)
         — ทับคำสั่งเดิมที่ให้ยก mockup มาเป๊ะด้วย Instrument Sans */
      style={{
        fontFamily: "Kanit, system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: LOGIN_SCENE.ink,
      }}
    >
      <PhotoScene />
      {/* ผ้าขาวไล่เฉดจากขอบบน — ทำให้หัวเรื่องอ่านออกโดยไม่ต้องมีกรอบ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[46vh]"
        style={{
          background: `linear-gradient(180deg, ${LOGIN_SCENE.glassStrong} 0%, ${LOGIN_SCENE.glass} 42%, transparent 100%)`,
        }}
      />

      {/* ตราบริษัทมุมซ้ายบน — ตำแหน่งเดียวกับ `.brand` ของ mockup แต่เป็นตราของเรา */}
      <motion.div
        {...rise(0)}
        className="absolute left-4 top-4 z-20 flex items-center gap-2.5 sm:left-8 sm:top-7"
      >
        <BrandMark size="sm" />
        <span
          className="text-[13px] font-semibold tracking-[0.015em]"
          style={{ color: LOGIN_SCENE.ink, textShadow: TEXT_ON_PHOTO }}
        >
          <BrandTitle />
        </span>
      </motion.div>

      {/* ฉากเปิด "SO RECRUIT" พุ่งเข้าทีละตัว — สั้น · ข้ามได้ · โชว์ครั้งเดียวต่อการเปิดเบราว์เซอร์
          (เจ้าของขอลองเล่น 4 ก.ย. 2569 · ดูเหตุผลทั้งชุดใน BrandIntro.tsx) */}
      <BrandIntro />

      {/* 🔴 เนื้อหาเลื่อนได้ — mockup ล็อกจอไว้ ซึ่งทำให้มือถือเข้าระบบไม่ได้ */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 pb-16 pt-20">
        {/* หัวเรื่อง — ทรงเดียวกับ mockup (ตัวใหญ่ ชิดกัน คำเน้นเป็นเขียวจาง) */}
        {/* 🔴 **ไม่มีกรอบ** (เจ้าของทัก 5 ก.ย. 2569: *"ไม่เอากรอบแบบนี้ มันดูเสร่อมาก"*)
            แต่ตัวหนังสือยังต้องอ่านออกบนกิ่งไม้ที่ลายพร้อย ⇒ ใช้ **ผ้าไล่เฉดขาวเต็มความกว้าง**
            ที่ด้านบนของหน้าแทน — ไม่มีขอบ ไม่มีมุม ไม่อ่านเป็น "การ์ด" (ผ้าอยู่ที่ชั้นฉาก) */}
        <motion.div {...rise(0.05)} className="max-w-[720px] text-center">
          {/* ⚠️ mockup ตั้ง `letter-spacing:-.045em` ซึ่งเป็นค่าของฟอนต์อังกฤษ —
              ตัวไทยสระ/วรรณยุกต์ซ้อนกันจนอ่านยาก จึงคลายเหลือ -0.01em */}
          <h1
            className="text-[clamp(30px,4.6vw,54px)] font-[610] leading-[1.1] tracking-[-0.01em]"
            style={{ color: LOGIN_SCENE.ink }}
          >
            ยินดีต้อนรับ
            <span className="font-[560]" style={{ color: LOGIN_SCENE.accent }}>
              กลับมา
            </span>
          </h1>
          <p
            className="mx-auto mt-2.5 max-w-[52ch] text-[14.5px] leading-[1.6]"
            style={{ color: LOGIN_SCENE.ink }}
          >
            {todayLabel} · เข้าสู่ระบบด้วยบัญชีองค์กร
          </p>
        </motion.div>

        {/* ── ซ้าย: อธิบายระบบ · ขวา: เข้าสู่ระบบ (เจ้าของสั่ง 4 ก.ย. 2569) ──
            🔴 การ์ด "ดูประกาศรับสมัคร" **ถูกเอาออก**ตามคำสั่งเดียวกัน
            (เดิมเป็นการ์ดขวาคู่กับฟอร์ม) · ทางเข้าของคนหางาน **ไม่หาย** —
            ย้ายไปเป็นลิงก์ใต้ฟอร์มล็อกอิน ยังกดจากหน้านี้ได้เหมือนเดิม
            ⚠️ คำสั่งนี้ทับของเดิม 2 ก.ย. ที่เคยสั่งว่าการ์ดนั้น "ต้องมีอยู่" */}
        <div className="grid w-full max-w-[980px] items-center gap-6 lg:grid-cols-2 lg:gap-10">
        {/* ═══ ซ้าย — ระบบนี้ทำอะไรให้บ้าง ═══
            🔴 บนมือถือสลับให้ **ฟอร์มเข้าระบบมาก่อน** (order) — จอแคบเรียงเป็นแถวเดียว
            ถ้าปล่อยตามลำดับโค้ด คนต้องเลื่อนผ่านคำอธิบายยาว ๆ กว่าจะถึงช่องกรอก */}
        <div className="order-2 lg:order-1">
          <SystemIntro rise={rise} />
        </div>

        <motion.div {...rise(0.22)} className="order-1 w-full max-w-[410px] lg:order-2">
          <div className="flex h-full flex-col rounded-3xl p-6" style={GLASS_CARD}>
            {authConfig === null && configError ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm" style={{ color: LOGIN_SCENE.muted }}>
                  เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบว่า API ทำงานอยู่แล้วลองใหม่
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setConfigError(false);
                    setConfigAttempt((n) => n + 1);
                  }}
                  className="mx-auto min-h-11 rounded-full border-0"
                  style={PRIMARY_BTN}
                >
                  ลองอีกครั้ง
                </Button>
              </div>
            ) : authConfig === null ? (
              <p
                className="flex items-center justify-center gap-2 py-8 text-sm"
                style={{ color: LOGIN_SCENE.muted }}
              >
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                กำลังโหลด…
              </p>
            ) : (
              <>
                {showEmail ? (
                  <EmailPasswordForm
                    hint={authConfig.companyEmailHint}
                    onError={(msg) => setError(msg || null)}
                  />
                ) : null}

                {showEmail && showMicrosoft ? <OrDivider /> : null}

                {showMicrosoft ? <MicrosoftLoginButton /> : null}

                {noWayIn ? (
                  <p className="py-4 text-center text-sm" style={{ color: LOGIN_SCENE.muted }}>
                    ยังไม่มีวิธีเข้าสู่ระบบที่เปิดใช้งาน — ติดต่อผู้ดูแลระบบ
                  </p>
                ) : null}

                {error ? (
                  <p className="mt-4 text-center text-xs text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                {noWayIn ? null : (
                  <p
                    className="mt-4 text-center text-[11px]"
                    style={{ color: LOGIN_SCENE.muted }}
                  >
                    เฉพาะผู้ใช้ที่ได้รับสิทธิ์ในองค์กรเท่านั้น
                  </p>
                )}

                {/* 🔴 ทางเข้าของ **คนหางาน** — การ์ดใบเดิมถูกเอาออก (เจ้าของสั่ง 4 ก.ย. 2569)
                    แต่ทางเข้าห้ามหาย เพราะคนนอกเข้าเว็บนี้เพื่อสมัครงาน ไม่ได้มาล็อกอิน */}
                <div className="mt-5 border-t pt-4 text-center" style={{ borderColor: HAIRLINE }}>
                  <p className="text-[11px]" style={{ color: LOGIN_SCENE.muted }}>
                    ไม่ได้เป็นพนักงาน? มาสมัครงานได้เลย ไม่ต้องมีบัญชี
                  </p>
                  <Link
                    to="/apply"
                    className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-semibold transition-[filter] hover:brightness-110"
                    style={PRIMARY_BTN}
                  >
                    เปิดบอร์ดประกาศรับสมัคร
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </>
            )}
          </div>
        </motion.div>

        </div>
      </div>

    </div>
  );
};

export default LoginPage;
