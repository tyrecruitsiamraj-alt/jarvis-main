/** โดเมนอีเมลบริษัทที่อนุญาตให้ login / สมัคร (เช่น siamraj.com) */
export function getCompanyEmailDomains(): string[] {
  const raw = (process.env.JARVIS_COMPANY_EMAIL_DOMAINS || '').trim();
  if (raw) {
    return raw
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }
  const sender = (process.env.EMAIL_SENDER || '').trim().toLowerCase();
  const at = sender.lastIndexOf('@');
  if (at > 0 && at < sender.length - 1) {
    return [sender.slice(at + 1)];
  }
  return [];
}

export function isCompanyEmail(email: string): boolean {
  const domains = getCompanyEmailDomains();
  if (domains.length === 0) return true;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at >= normalized.length - 1) return false;
  const domain = normalized.slice(at + 1);
  return domains.includes(domain);
}

export function companyEmailRequiredMessage(): string {
  const domains = getCompanyEmailDomains();
  if (domains.length === 1) {
    return `กรุณาใช้อีเมลบริษัท @${domains[0]} เท่านั้น`;
  }
  return `กรุณาใช้อีเมลบริษัท (${domains.map((d) => `@${d}`).join(', ')}) เท่านั้น`;
}

export function isCompanyEmailLoginEnforced(): boolean {
  return getCompanyEmailDomains().length > 0;
}
