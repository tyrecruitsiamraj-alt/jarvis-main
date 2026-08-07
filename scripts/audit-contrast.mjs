/**
 * เครื่องวัด contrast (WCAG AA) สำหรับรันในเบราว์เซอร์ — ไม่ใช่สคริปต์ node
 *
 * วิธีใช้: เปิดหน้าที่จะตรวจด้วย preview_start แล้ววางฟังก์ชันนี้ผ่าน javascript_tool
 *   const fails = auditContrast(document.querySelector('main'))
 * คืนรายการ element ที่ตกเกณฑ์ เรียงจากแย่สุด
 *
 * ⚠️ บทเรียนที่ทำให้ต้องมีไฟล์นี้ (7 ส.ค. 2569):
 * 1. **ซ้อนสีโปร่งใสต้องไล่จากล่างขึ้นบน** — เวอร์ชันแรกไล่จากบนลงล่าง
 *    รายงาน false positive 17 จุดในแผงเดียว พอแก้เหลือของจริง 3 จุด
 * 2. **พื้น gradient วัดไม่ได้ ต้องข้าม ไม่ใช่เดา** — hero การ์ดดำใช้ background-image
 *    ถ้าไม่ข้ามจะได้ตัวเลขมั่ว 20+ จุด
 * 3. เกณฑ์ต่างกันตามขนาด: ตัวใหญ่ (≥24px หรือ ≥18.66px หนา) ใช้ 3.0 ที่เหลือ 4.5
 * 4. ต้องข้ามของที่ซ่อนอยู่จริง (display/visibility/opacity 0 / aria-hidden)
 *    ไม่งั้นเมนูที่ยังไม่กางจะโผล่มาเป็น false positive
 * 5. วัดตอน Browser pane เปิดเท่านั้น — ปิดอยู่ innerWidth = 0 ค่าที่ได้ใช้ไม่ได้
 *
 * ธีม: สลับด้วย localStorage 'jarvis:theme' = 'dark' | 'light' แล้ว reload
 * (เปลี่ยน class บน <html> เฉย ๆ ไม่พอ เพราะ Tailwind กับ theme.ts อ่านคนละทาง)
 */
export const AUDIT_CONTRAST_SNIPPET = String.raw`
window.auditContrast = (root) => {
  const parse = (c) => { const m = (c || '').match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = (r) => {
    const f = r.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  // ประกอบชั้นสีจาก "ล่างขึ้นบน" — ทำกลับทางเมื่อไหร่ได้ false positive เพียบ
  const compose = (layers) => {
    let base = (parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255]).slice(0, 3);
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i]; const a = L[3] === undefined ? 1 : L[3];
      base = [0, 1, 2].map((k) => L[k] * a + base[k] * (1 - a));
    }
    return base;
  };
  // null = มีพื้น gradient/รูปคั่น วัดไม่ได้ ให้ข้าม ไม่ใช่เดา
  const bgOf = (el) => {
    const layers = []; let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor);
      if (c && (c[3] === undefined || c[3] > 0)) { layers.push(c); if (c[3] === undefined || c[3] >= 1) break; }
      n = n.parentElement;
    }
    return compose(layers);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return false;
      n = n.parentElement;
    }
    return true;
  };
  const out = [];
  for (const el of (root || document).querySelectorAll('*')) {
    const txt = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').trim();
    if (!txt || !visible(el)) continue;
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el); if (!bg) continue;
    const a = fg[3] === undefined ? 1 : fg[3];
    const eff = [0, 1, 2].map((k) => fg[k] * a + bg[k] * (1 - a));
    const r = ratio(eff, bg);
    const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (r < need) out.push({ r: +r.toFixed(2), need, txt: txt.slice(0, 24), cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 90) });
  }
  return out.sort((a, b) => a.r - b.r);
};
'auditContrast พร้อมใช้'
`;
