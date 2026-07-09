import { getAppPublicUrl } from './postmark.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMagicLinkEmail(loginUrl: string, expiresMinutes: number) {
  const safeUrl = escapeHtml(loginUrl);
  const subject = 'ลิงก์เข้าสู่ระบบ Jarvis';
  const textBody = [
    'สวัสดีครับ/ค่ะ',
    '',
    'คลิกลิงก์ด้านล่างเพื่อเข้าสู่ระบบ Jarvis:',
    loginUrl,
    '',
    `ลิงก์นี้ใช้ได้ ${expiresMinutes} นาที และใช้ได้ครั้งเดียว`,
    'หากคุณไม่ได้ขอเข้าสู่ระบบ สามารถละเว้นอีเมลนี้ได้',
  ].join('\n');

  const htmlBody = `
    <p>สวัสดีครับ/ค่ะ</p>
    <p>คลิกปุ่มด้านล่างเพื่อเข้าสู่ระบบ <strong>Jarvis</strong></p>
    <p style="margin: 24px 0;">
      <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#141210;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">
        เข้าสู่ระบบ
      </a>
    </p>
    <p style="font-size:13px;color:#666;">ลิงก์นี้ใช้ได้ ${expiresMinutes} นาที และใช้ได้ครั้งเดียว</p>
    <p style="font-size:12px;color:#999;">หากปุ่มใช้ไม่ได้ คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${safeUrl}</p>
  `.trim();

  return { subject, textBody, htmlBody };
}

export function buildPasswordResetEmail(resetUrl: string, expiresMinutes: number) {
  const safeUrl = escapeHtml(resetUrl);
  const subject = 'รีเซ็ตรหัสผ่าน Jarvis';
  const textBody = [
    'สวัสดีครับ/ค่ะ',
    '',
    'คลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่:',
    resetUrl,
    '',
    `ลิงก์นี้ใช้ได้ ${expiresMinutes} นาที`,
    'หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน สามารถละเว้นอีเมลนี้ได้',
  ].join('\n');

  const htmlBody = `
    <p>สวัสดีครับ/ค่ะ</p>
    <p>คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่สำหรับ <strong>Jarvis</strong></p>
    <p style="margin: 24px 0;">
      <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#141210;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">
        ตั้งรหัสผ่านใหม่
      </a>
    </p>
    <p style="font-size:13px;color:#666;">ลิงก์นี้ใช้ได้ ${expiresMinutes} นาที</p>
    <p style="font-size:12px;color:#999;">หากปุ่มใช้ไม่ได้ คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${safeUrl}</p>
  `.trim();

  return { subject, textBody, htmlBody };
}

export function buildAuthUrl(path: string): string {
  const base = getAppPublicUrl();
  return base ? `${base}${path}` : path;
}
