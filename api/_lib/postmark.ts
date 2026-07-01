import { logError, logInfo } from './logger.js';

export type SendEmailInput = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  tag?: string;
};

export function isPostmarkConfigured(): boolean {
  const token = (process.env.POSTMARK_SERVER_TOKEN || '').trim();
  const sender = (process.env.EMAIL_SENDER || '').trim();
  return Boolean(token && sender);
}

export function getEmailSender(): string | null {
  const sender = (process.env.EMAIL_SENDER || '').trim();
  return sender || null;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const token = (process.env.POSTMARK_SERVER_TOKEN || '').trim();
  const from = getEmailSender();
  if (!token || !from) {
    throw new Error('POSTMARK_SERVER_TOKEN and EMAIL_SENDER must be configured');
  }

  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: from,
      To: input.to,
      Subject: input.subject,
      TextBody: input.textBody,
      HtmlBody: input.htmlBody || undefined,
      MessageStream: 'outbound',
      Tag: input.tag,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logError('postmark.send_failed', { status: res.status, detail: detail.slice(0, 500) });
    throw new Error('Failed to send email');
  }

  logInfo('postmark.send_ok', { to: input.to, tag: input.tag || 'default' });
}

export function getAppPublicUrl(): string {
  return (process.env.APP_PUBLIC_URL || process.env.VITE_APP_URL || '').trim().replace(/\/$/, '');
}
