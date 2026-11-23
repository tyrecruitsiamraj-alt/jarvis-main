/**
 * LINE (LIFF) ฝั่งหน้าเว็บของผู้สมัคร — ขอ ID token ให้เซิร์ฟเวอร์เอาไปให้ LINE ยืนยันบัญชี (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 *
 * ใช้สิทธิ์ openid + profile เท่านั้น ไม่ขอสิทธิ์ส่งข้อความ · หน้าเว็บไม่ตัดสินว่าใครเป็นใคร (เซิร์ฟเวอร์ตรวจโทเคนกับ LINE เอง)
 * โหมดจำลอง (`mock`) มีเฉพาะเครื่องทดสอบ — เซิร์ฟเวอร์จริงไม่รับโทเคนจำลอง
 */
type Liff = {
  init: (v: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (v?: { redirectUri: string }) => void;
  logout: () => void;
  getIDToken: () => string | null;
  getDecodedIDToken: () => { exp?: number } | null;
  isInClient: () => boolean;
};
declare global {
  interface Window {
    liff?: Liff;
  }
}

const SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
const INVITE_KEY = 'jarvis-doc-invite';
const MOCK_SUB_KEY = 'jarvis-doc-mock-sub';

const TOKEN = /^[a-f0-9]{64}$/;

/**
 * รหัสลิงก์ที่อยู่บนแถบที่อยู่ตอนนี้ — `?invite=` ตรง ๆ หรือที่ LINE ห่อมาใน `liff.state` (ตอนเปิดผ่าน liff.line.me รอบแรก)
 * หน้าตาไม่ใช่รหัสลิงก์ = ไม่มี (ไม่ส่งของแปลกไปถามเซิร์ฟเวอร์)
 */
export function inviteFromUrl(search: string = window.location.search): string | null {
  const q = new URLSearchParams(search);
  const direct = q.get('invite');
  if (direct && TOKEN.test(direct)) return direct;
  const state = q.get('liff.state');
  if (state) {
    const inner = new URLSearchParams(state.includes('?') ? state.slice(state.indexOf('?') + 1) : state).get('invite');
    if (inner && TOKEN.test(inner)) return inner;
  }
  return null;
}

/** รหัสลิงก์ของรอบนี้ — จากแถบที่อยู่ หรือที่จำไว้ในแท็บนี้ระหว่างเด้งไปล็อกอิน LINE (sessionStorage ของแท็บ ไม่ค้างข้ามแท็บ) */
export function readInvite(): string | null {
  const fromUrl = inviteFromUrl();
  try {
    if (fromUrl) sessionStorage.setItem(INVITE_KEY, fromUrl);
    return fromUrl ?? sessionStorage.getItem(INVITE_KEY);
  } catch {
    return fromUrl;
  }
}

/** เปิดลิงก์สำเร็จแล้ว — เอารหัสลิงก์ออกจากแถบที่อยู่ (ไม่ค้างในประวัติ/ภาพหน้าจอ) */
export function hideInviteFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('invite') && !url.searchParams.has('liff.state')) return;
  url.searchParams.delete('invite');
  url.searchParams.delete('liff.state');
  window.history.replaceState(window.history.state, '', url.pathname + url.search);
}

export function forgetInvite(): void {
  try {
    sessionStorage.removeItem(INVITE_KEY);
  } catch {
    /* ไม่มีที่เก็บก็ไม่เป็นไร */
  }
}

const KEY_KEY = 'jarvis-doc-k';
/** คีย์ของลิงก์ที่เปิดสำเร็จแล้วในแท็บนี้ — โหลดหน้าใหม่แล้วใช้ต่อด้วยคุกกี้ได้ ไม่ต้องขอ LINE ซ้ำ (ไม่ใช่รหัสลิงก์ ใช้เปิดลิงก์เองไม่ได้) */
export function readOpenedKey(): string | null {
  try {
    const k = sessionStorage.getItem(KEY_KEY);
    return k && /^[a-f0-9]{16}$/.test(k) ? k : null;
  } catch {
    return null;
  }
}
export function rememberOpenedKey(k: string | null): void {
  try {
    if (k) sessionStorage.setItem(KEY_KEY, k);
    else sessionStorage.removeItem(KEY_KEY);
  } catch {
    /* ไม่จำก็ได้ */
  }
}

function loadSdk(): Promise<Liff> {
  if (window.liff) return Promise.resolve(window.liff);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.onload = () => (window.liff ? resolve(window.liff) : reject(new Error('โหลด LINE ไม่ได้')));
    s.onerror = () => reject(new Error('โหลด LINE ไม่ได้ ตรวจอินเทอร์เน็ตแล้วเปิดลิงก์อีกครั้ง'));
    document.head.appendChild(s);
  });
}

function mockToken(): string {
  let sub = '';
  try {
    sub = sessionStorage.getItem(MOCK_SUB_KEY) ?? '';
  } catch {
    /* ใช้ค่าใหม่ */
  }
  if (!/^U[a-f0-9]{32}$/.test(sub)) {
    sub = `U${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
    try {
      sessionStorage.setItem(MOCK_SUB_KEY, sub);
    } catch {
      /* ไม่จำก็ได้ */
    }
  }
  const name = new URLSearchParams(window.location.search).get('mockLine') || 'บัญชีทดสอบ';
  const json = JSON.stringify({ sub, name });
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return `mock.${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export type LineTokenResult = { idToken: string } | { redirecting: true };

/**
 * ขอ ID token — ยังไม่ล็อกอิน LINE = พาไปล็อกอิน (LINE ถามสิทธิ์ชื่อกับรูปที่นั่น) แล้วกลับมาหน้าเดิม
 * โทเคนหมดอายุ = ล็อกอินใหม่ (นอกแอป LINE) · ในแอป LINE เปิดลิงก์ใหม่ให้ LINE ออกโทเคนใหม่
 */
export async function getLineIdToken(config: { liffId: string; mock: boolean }): Promise<LineTokenResult> {
  if (config.mock && !config.liffId) return { idToken: mockToken() };
  const liff = await loadSdk();
  await liff.init({ liffId: config.liffId });
  const redirectUri = window.location.origin + window.location.pathname + window.location.search;
  const exp = liff.isLoggedIn() ? liff.getDecodedIDToken()?.exp : undefined;
  const expired = typeof exp === 'number' && exp * 1000 <= Date.now() + 5_000;
  if (liff.isLoggedIn() && expired) {
    if (liff.isInClient()) {
      window.location.href = `https://liff.line.me/${config.liffId}?invite=${encodeURIComponent(readInvite() ?? '')}`;
      return { redirecting: true };
    }
    liff.logout();
  }
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri });
    return { redirecting: true };
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('LINE ยังไม่ส่งข้อมูลบัญชีมา เปิดลิงก์อีกครั้ง');
  return { idToken };
}
