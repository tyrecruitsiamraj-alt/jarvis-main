/**
 * ═══ หน้าเข้าสู่ระบบ — **หน้าตาของ `tundralogin_v3.html` การทำงานของเรา** ═══
 *
 * เจ้าของส่ง mockup มา 27 ส.ค. 2569 แล้วสั่ง: *"ถ้าใช้ได้ก็ใช้ แต่อยากให้มีแค่แบบของเรา
 * เหมือนอยากได้ค่าภาพกับอะไรต่าง ๆ ของเขา แต่การทำงานเป็นแบบเรา"*
 * ⚠️ รอบแรกผมไปสลับภาพเป็นฉากออฟฟิศของเราเอง โดนย้ำว่า
 * *"บ้าหรอ จะเอาแบบไฟล์ HTML ที่ส่งให้ดิ ทำนอกเหนือจากที่สั่งอีกแล้ว"*
 * ⇒ **หน้าตายกมาเป๊ะ ห้ามตีความเอง** ภาพป่า · จานกระดาษ-เขียวป่า · ตัวอักษร Instrument Sans
 * · การ์ดกระจก · ช่องกรอกมุมโค้ง · ปุ่มแคปซูลเขียวป่า · เส้น "หรือ" ตัวพิมพ์ใหญ่
 * (ค่าสีทุกตัวอยู่ที่ `FRONT_SCENE` · ชั้นของฉากอยู่ที่ `PhotoScene`)
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
import { FRONT_SCENE } from '@/lib/designTokens';
import PhotoScene from '@/components/shared/PhotoScene';
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

/** เส้นบางในการ์ด — สูตรเดียวกับ mockup */
const HAIRLINE = 'rgba(28, 57, 39, .11)';

/** ป้ายชื่อช่องกรอก */
const FIELD_LABEL = 'mb-2 ml-0.5 block text-xs font-medium';

/**
 * ช่องกรอกของ mockup — พื้นขาวโปร่ง ขอบเขียวจาง มีไฮไลต์ด้านใน
 * ⚠️ ทับ `jarvis-soft-field` ของระบบเพราะหน้านี้เป็นจานกระดาษ ไม่ใช่จานฟ้าของแอป
 */
const FIELD_CLASS = 'h-[46px] rounded-xl text-[15px] shadow-none';
const FIELD_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, .58)',
  borderColor: HAIRLINE,
  color: FRONT_SCENE.ink,
  boxShadow: 'inset 0 1px rgba(255,255,255,.6)',
};

/** ปุ่มลงมือ — แคปซูลเขียวป่าไล่เฉด */
const FOREST_BTN: React.CSSProperties = {
  background: `linear-gradient(180deg, ${FRONT_SCENE.forest2}, ${FRONT_SCENE.forest})`,
  color: FRONT_SCENE.paper,
  boxShadow: '0 9px 22px rgba(22, 50, 33, .18)',
};

/** ปุ่ม SSO — แคปซูลกระจกขาว (`.sso` ของ mockup) */
const SSO_BTN: React.CSSProperties = {
  background: 'rgba(255, 255, 255, .46)',
  border: `1px solid ${HAIRLINE}`,
  color: FRONT_SCENE.ink,
};

/** การ์ดกระจก — `.card` ของ mockup (ไม่ใช่ `jarvis-frost` ที่เป็นจานฟ้าของแอป) */
const GLASS_CARD: React.CSSProperties = {
  background: `linear-gradient(180deg, ${FRONT_SCENE.glassStrong}, ${FRONT_SCENE.glass})`,
  border: `1px solid rgba(255, 255, 255, .66)`,
  boxShadow:
    '0 26px 80px rgba(18, 39, 26, .18), 0 2px 8px rgba(18, 39, 26, .05), inset 0 1px rgba(255,255,255,.7)',
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
          <label htmlFor="login-email" className={FIELD_LABEL} style={{ color: FRONT_SCENE.muted }}>
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
              style={{ color: FRONT_SCENE.muted }}
            >
              {hint}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="login-password" className={FIELD_LABEL} style={{ color: FRONT_SCENE.muted }}>
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
              style={{ color: FRONT_SCENE.ink }}
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
        style={FOREST_BTN}
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
        style={{ color: FRONT_SCENE.muted }}
      >
        หรือ
      </span>
      <div className="h-px flex-1" style={{ background: HAIRLINE }} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
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
        color: FRONT_SCENE.ink,
      }}
    >
      <PhotoScene />

      {/* ตราบริษัทมุมซ้ายบน — ตำแหน่งเดียวกับ `.brand` ของ mockup แต่เป็นตราของเรา */}
      <motion.div
        {...rise(0)}
        className="absolute left-4 top-4 z-20 flex items-center gap-2.5 sm:left-8 sm:top-7"
      >
        <BrandMark size="sm" />
        <span
          className="text-[13px] font-semibold tracking-[0.015em]"
          style={{ color: 'rgba(19, 37, 27, .82)' }}
        >
          <BrandTitle />
        </span>
      </motion.div>

      {/* 🔴 เนื้อหาเลื่อนได้ — mockup ล็อกจอไว้ ซึ่งทำให้มือถือเข้าระบบไม่ได้ */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 pb-28 pt-24">
        {/* หัวเรื่อง — ทรงเดียวกับ mockup (ตัวใหญ่ ชิดกัน คำเน้นเป็นเขียวจาง) */}
        <motion.div {...rise(0.05)} className="max-w-[720px] text-center">
          {/* ⚠️ mockup ตั้ง `letter-spacing:-.045em` ซึ่งเป็นค่าของฟอนต์อังกฤษ —
              ตัวไทยสระ/วรรณยุกต์ซ้อนกันจนอ่านยาก จึงคลายเหลือ -0.01em
              (นี่คือ "ปรับให้เป็นภาษาเรา" ไม่ใช่เปลี่ยนดีไซน์) */}
          <h1
            className="text-[clamp(32px,5vw,60px)] font-[610] leading-[1.06] tracking-[-0.01em]"
            style={{ textShadow: '0 1px 10px rgba(255,255,255,.45), 0 1px 0 rgba(255,255,255,.4)' }}
          >
            ยินดีต้อนรับ
            <span className="font-[560]" style={{ color: FRONT_SCENE.sageStrong }}>
              กลับเข้าระบบ
            </span>
          </h1>
          {/* ⚠️ mockup ใช้เทาจาง .62 บนพื้นครีม — ทับป่าแล้วอ่านไม่ออก
              เข้มขึ้น + เงาขาวใต้ตัวอักษร (ยังเป็นตัวหนังสือบนภาพ ไม่ใช่กล่องทึบ) */}
          <p
            className="mx-auto mt-3.5 max-w-[52ch] text-[14.5px] leading-[1.6]"
            style={{
              color: 'rgba(18, 33, 24, .88)',
              textShadow: '0 1px 8px rgba(255,255,255,.55), 0 1px 2px rgba(255,255,255,.7)',
            }}
          >
            {todayLabel} — เข้าสู่ระบบด้วยบัญชีองค์กรของคุณ
          </p>
        </motion.div>

        {/* สองการ์ดวางคู่บนจอใหญ่ · ซ้อนกันบนมือถือ
            🔴 การ์ด "ดูประกาศงาน" ต้องมีอยู่ — เจ้าของทักตอนผมยุบเหลือบรรทัดเล็ก ๆ
            (*"แล้วการ์ด ดูประกาศงานอะ"*) เป็นทางเข้าของคนหางาน ไม่ใช่ของเสริม */}
        {/* ⚠️ `items-center` ไม่ใช่ `items-stretch` — บน production เหลือปุ่ม Microsoft
            ปุ่มเดียว การ์ดล็อกอินจึงเตี้ยมาก ถ้าสั่งยืดให้เท่าการ์ดขวาจะได้กล่องว่างสูงเปล่า ๆ
            (วัดบนจอจริงแล้วเจอ) ⇒ ให้แต่ละการ์ดสูงเท่าเนื้อของตัวเอง */}
        <div className="flex w-full flex-col items-center justify-center gap-4 lg:flex-row lg:items-center lg:gap-5">
        {/* การ์ดกระจก — `.card` ของ mockup */}
        <motion.div {...rise(0.22)} className="w-full max-w-[410px]">
          <div className="rounded-3xl p-6" style={GLASS_CARD}>
            {authConfig === null && configError ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm" style={{ color: FRONT_SCENE.muted }}>
                  เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบว่า API ทำงานอยู่แล้วลองใหม่
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setConfigError(false);
                    setConfigAttempt((n) => n + 1);
                  }}
                  className="mx-auto min-h-11 rounded-full border-0"
                  style={FOREST_BTN}
                >
                  ลองอีกครั้ง
                </Button>
              </div>
            ) : authConfig === null ? (
              <p
                className="flex items-center justify-center gap-2 py-8 text-sm"
                style={{ color: FRONT_SCENE.muted }}
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
                  <p className="py-4 text-center text-sm" style={{ color: FRONT_SCENE.muted }}>
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
                    style={{ color: 'rgba(21, 37, 28, .50)' }}
                  >
                    เฉพาะผู้ใช้ที่ได้รับสิทธิ์ในองค์กรเท่านั้น
                  </p>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* ── การ์ดที่สอง: ทางเข้าของคนหางาน ──
            🔴 ของเดิมเป็นการ์ดข้างขวาบนจอใหญ่ + ปุ่มในการ์ดล็อกอินบนมือถือ (สองที่)
            รอบนี้เหลือ**การ์ดเดียว เห็นครบทุกจอ** ทรงกระจกเดียวกับการ์ดล็อกอิน */}
        <motion.div {...rise(0.3)} className="w-full max-w-[410px]">
          <div
            className="flex h-full flex-col justify-between rounded-3xl p-6"
            style={GLASS_CARD}
          >
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: FRONT_SCENE.muted }}
              >
                สำหรับผู้สมัครงาน
              </p>
              <p
                className="mt-2 text-[19px] font-semibold leading-snug"
                style={{ color: FRONT_SCENE.ink }}
              >
                ดูประกาศรับสมัครพนักงาน
              </p>
              <p
                className="mt-1.5 text-[13px] leading-relaxed"
                style={{ color: 'rgba(21, 37, 28, .62)' }}
              >
                เลือกตำแหน่งที่สนใจแล้วกรอกใบสมัครได้ทันที — ไม่ต้องมีบัญชี ไม่ต้องเข้าสู่ระบบ
                ทีมสรรหาจะติดต่อกลับ
              </p>
            </div>

            {/* ตราบริษัทตัวใหญ่ — ที่เดียวกับของเดิมในการ์ดขวา */}
            <div className="flex flex-1 items-center justify-center py-6">
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute h-32 w-32 rounded-full blur-2xl"
                  style={{ background: 'rgba(255, 241, 208, .55)' }}
                  aria-hidden
                />
                <BrandMark size="xl" className="relative z-10" />
              </div>
            </div>

            <Link
              to="/apply"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-[filter] hover:brightness-110"
              style={FOREST_BTN}
            >
              เปิดบอร์ดประกาศรับสมัคร
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </motion.div>
        </div>
      </div>

    </div>
  );
};

export default LoginPage;
