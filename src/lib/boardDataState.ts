/**
 * ═══ สภาพของข้อมูลที่หน้าจอกำลังถืออยู่ — "กำลังโหลด" ≠ "พัง" ≠ "ไม่มีสิทธิ์" ═══
 *
 * 🔴 **ทำไมต้องมีไฟล์นี้ (วัดเจอจริง 29-31 ส.ค. 2569):**
 * หน้ากล่องงานเปิดไม่ติด 4 ครั้งจาก 6 (เส้นดึงใบขอค้างครบ 60 วิแล้วตาย) — **ตอนตาย
 * ทุกก้อนขึ้นเลข 0** (ทั้งหมด 0 · ปล่อยแล้ว 0 · ยังไม่ปล่อย 0) มีแค่บรรทัดแดงเล็ก ๆ ว่า Timeout
 * คนอ่านเชื่อว่าไม่มีใบขอเลย ทั้งที่ของจริงมี 304 ใบ
 *
 * ต้นเหตุในโค้ดเดิม: ตัวโหลดทั้งสองเส้น **กลืน error แล้วแกล้งว่าสำเร็จ**
 *   - อ่านทะเบียนปล่อยไม่ได้ → `setReleases([])` = "ยังไม่มีใบไหนปล่อย"
 *   - อ่านประกาศไม่ได้ → `setPostingsLoaded(true)` = "โหลดครบแล้ว ไม่มีประกาศ"
 * ทั้งสองอันแปลง "ไม่รู้" เป็น "รู้ว่าไม่มี" ซึ่งเป็นคนละเรื่องกันคนละโลก
 *
 * 🔴 **กติกา: ไม่รู้ ต้องบอกว่าไม่รู้ ห้ามแปลงเป็นศูนย์**
 * (กติกาแม่ของโปรเจกต์: จอที่ **บอกผิด** แย่กว่าจอที่เงียบ)
 *
 * ⚠️ **"ไม่มีสิทธิ์" ต้องแยกจาก "พัง"** — คนที่ role ไม่มี grant จะโดน 403 ทุกครั้ง
 * ถ้าเหมารวมเป็น "พัง" เขาจะกดลองใหม่ไปเรื่อย ๆ โดยไม่มีวันสำเร็จ (หนี้ Redteam ข้อ 1)
 */

/** สภาพของ **หนึ่งเส้นข้อมูล** */
export type FeedState = 'loading' | 'ready' | 'failed' | 'forbidden';

/** สภาพรวมของตัวเลขทั้งหัวจอ */
export type LedgerStatus = 'loading' | 'ready' | 'broken';

export type LedgerState = {
  status: LedgerStatus;
  /** พังเพราะอะไร — `null` เมื่อยังไม่พัง */
  reason: 'failed' | 'forbidden' | null;
};

/**
 * รวมสภาพของหลายเส้นเป็นสภาพเดียว
 *
 * ลำดับความสำคัญ: **พังชนะทุกอย่าง** → กำลังโหลด → พร้อม
 * (เส้นหนึ่งพังแต่อีกเส้นมาแล้ว = เลขที่ประกอบได้จะผิด ⇒ ต้องถือว่าพังทั้งชุด
 *  ห้ามโชว์เลขบางส่วนที่ดูเหมือนจริง)
 *
 * ⚠️ ไม่มีสิทธิ์ชนะพังธรรมดา — เพราะทางแก้ต่างกัน (คนละข้อความ ปุ่มลองใหม่ก็ไม่ช่วย)
 */
export function combineFeedStates(...feeds: readonly FeedState[]): LedgerState {
  if (feeds.some((f) => f === 'forbidden')) return { status: 'broken', reason: 'forbidden' };
  if (feeds.some((f) => f === 'failed')) return { status: 'broken', reason: 'failed' };
  if (feeds.some((f) => f === 'loading')) return { status: 'loading', reason: null };
  return { status: 'ready', reason: null };
}

/** ตัวเลขโชว์ได้ไหม — 🔴 จุดเดียวที่ตัดสิน ห้ามหน้าจอเช็คเอง */
export function canShowNumbers(state: LedgerState): boolean {
  return state.status === 'ready';
}

/** ค่าที่พิมพ์แทนตัวเลขตอนยังบอกไม่ได้ — **ห้ามใช้ 0** */
export const UNKNOWN_NUMBER = '—';

/** ข้อความบนจอของแต่ละสภาพ — 🔴 แหล่งเดียว ห้ามพิมพ์ซ้ำในหน้าจอ */
export const LEDGER_STATE_TEXT: Record<
  'loading' | 'failed' | 'forbidden',
  { title: string; hint: string; canRetry: boolean }
> = {
  loading: {
    title: 'กำลังอ่านตัวเลขของงานปล่อยประกาศ…',
    hint: 'ระบบงานหลักตอบช้าได้ถึงหนึ่งนาที',
    canRetry: false,
  },
  failed: {
    title: 'อ่านตัวเลขไม่ได้',
    hint: 'ต่อกับระบบงานหลักไม่ติดหรือตอบช้าเกินไป — ตัวเลขที่ควรอยู่ตรงนี้จึงยังบอกไม่ได้ ไม่ใช่ว่าไม่มีงาน',
    canRetry: true,
  },
  forbidden: {
    title: 'บัญชีนี้ไม่มีสิทธิ์เห็นตัวเลขงานปล่อยประกาศ',
    hint: 'กดลองใหม่ก็ไม่ช่วย — ต้องให้แอดมินเปิดสิทธิ์ให้บทบาทของคุณก่อน',
    canRetry: false,
  },
};

/** ข้อความที่ต้องโชว์ตอนนี้ — `null` = ปกติ ไม่ต้องขึ้นอะไร */
export function ledgerStateText(state: LedgerState) {
  if (state.status === 'loading') return LEDGER_STATE_TEXT.loading;
  if (state.status === 'broken') return LEDGER_STATE_TEXT[state.reason ?? 'failed'];
  return null;
}

/**
 * ป้ายบอกอายุข้อมูลที่คนอ่านรู้เรื่อง — `null` = สดพอจนไม่ต้องบอก
 *
 * 🔴 บอกเมื่อข้อมูลเริ่มเก่าพอที่จะทำให้ตัดสินใจผิดได้ · ของสดไม่ต้องรบกวนสายตา
 * ⚠️ ของที่หยิบสำเนาเก่ามาให้เพราะถามใหม่ไม่สำเร็จ **ต้องบอกเสมอ ไม่ว่าจะเก่าแค่ไหน**
 * (ไม่งั้นคนเข้าใจว่าระบบงานหลักตอบปกติ ทั้งที่กำลังล่ม)
 */
export function dataAgeLabel(
  ageSeconds: number | null,
  source: 'live' | 'cache' | 'stale-revalidating' | 'stale-after-error' | null = null,
): string | null {
  if (ageSeconds === null) return null;
  const stale = source === 'stale-after-error';
  if (!stale && ageSeconds < 60) return null;
  const mins = Math.floor(ageSeconds / 60);
  const when = mins < 1 ? 'เมื่อครู่นี้' : mins < 60 ? `${mins} นาทีที่แล้ว` : `${Math.floor(mins / 60)} ชั่วโมงที่แล้ว`;
  return stale
    ? `ต่อระบบงานหลักไม่ติด — กำลังดูข้อมูลที่ดึงมา${when}`
    : `ข้อมูลเมื่อ${when === 'เมื่อครู่นี้' ? 'ครู่นี้' : ` ${when}`}`;
}
