import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { useAuth } from '@/contexts/AuthContext';
import {
  createStaffContact,
  listStaffContacts,
  matchStaffContact,
  type FollowStaffContact,
} from '@/lib/followStaffContactsApi';

/**
 * ช่อง "เจ้าหน้าที่ที่ติดตาม" แบบ dropdown ชื่อ+เบอร์ (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ:
 * เปลี่ยนจากพิมพ์เบอร์เองทุกครั้ง → เลือกจากรายชื่อกลาง) — ใช้ทั้งฟอร์มเพิ่ม (ขั้น 2)
 * และกล่องแก้ไข ค่าที่ส่งออกยังเป็น **เบอร์อย่างเดียว** (`staff_phone` เดิม ไม่แตะ schema)
 *
 * ทางถอยที่ตั้งใจมี:
 * - โหลดรายชื่อไม่ได้ / ตารางยังไม่ migrate → ถอยเป็นช่องพิมพ์เองแบบเดิม (ห้ามบล็อกงาน)
 * - ค่าเดิมของรายการเก่าที่ไม่ตรงกับใครในรายชื่อ → โชว์เป็นตัวเลือก "เบอร์ที่กรอกไว้เดิม"
 * - ปุ่ม "เพิ่มเจ้าหน้าที่" โผล่เฉพาะ supervisor ขึ้นไป (server กันอีกชั้นที่ rbac)
 */
export default function StaffContactField({
  id,
  value,
  onChange,
}: {
  id: string;
  /** เบอร์ที่เก็บใน staff_phone — '' = ไม่ระบุ */
  value: string;
  onChange: (phone: string) => void;
}) {
  const { user } = useAuth();
  const canAdd = user?.role === 'supervisor' || user?.role === 'admin';

  const [contacts, setContacts] = useState<FollowStaffContact[]>([]);
  /** null = ยังโหลดอยู่ · false = โหลดพัง (ถอยเป็นช่องพิมพ์เอง) */
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listStaffContacts()
      .then((v) => {
        if (cancelled) return;
        setContacts(v);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matched = useMemo(() => matchStaffContact(value, contacts), [value, contacts]);

  const saveNewContact = async () => {
    setAddError(null);
    setAddBusy(true);
    try {
      const created = await createStaffContact(newName, newPhone);
      setContacts((prev) =>
        [...prev.filter((c) => c.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name, 'th'),
        ),
      );
      // เพิ่มแล้วเลือกให้เลย — คนกดเพิ่มเพราะจะใช้กับรายการนี้แหละ
      onChange(created.phone);
      setAddOpen(false);
      setNewName('');
      setNewPhone('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'เพิ่มไม่สำเร็จ');
    } finally {
      setAddBusy(false);
    }
  };

  // โหลดพัง หรือคนเลือก "พิมพ์เอง" — ช่องพิมพ์แบบเดิมทุกอย่าง งานต้องเดินต่อได้เสมอ
  const showManualInput = loaded === false || manualMode;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ml-1 text-xs font-medium text-muted-foreground">
        เจ้าหน้าที่ที่ติดตาม (ถ้ามี)
      </label>

      {showManualInput ? (
        <>
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="tel"
            placeholder="เบอร์ที่ให้ผู้สมัครโทรกลับ เช่น 021234567 ต่อ 101"
            className="jarvis-soft-field min-h-[46px] w-full"
          />
          {loaded !== false ? (
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="ml-1 text-[11px] text-primary underline"
            >
              กลับไปเลือกจากรายชื่อ
            </button>
          ) : null}
        </>
      ) : (
        <>
          <select
            id={id}
            value={matched ? matched.id : value ? '__manual__' : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                onChange('');
                return;
              }
              if (v === '__manual__') return;
              const c = contacts.find((x) => x.id === v);
              if (c) onChange(c.phone);
            }}
            disabled={loaded === null}
            className="jarvis-soft-field min-h-[46px] w-full disabled:opacity-60"
          >
            <option value="">{loaded === null ? 'กำลังโหลดรายชื่อ…' : '— ไม่ระบุ —'}</option>
            {/* ค่าเดิมของรายการเก่า (พิมพ์เองก่อนมีรายชื่อกลาง) — ห้ามหายเงียบตอนเปิดแก้ */}
            {value && !matched ? <option value="__manual__">เบอร์ที่กรอกไว้เดิม: {value}</option> : null}
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.phone}
              </option>
            ))}
          </select>
          <p className="ml-1 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
            AI จะบอกเบอร์นี้ตอนท้ายสายให้ผู้สมัครโทรกลับ
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="underline hover:text-foreground"
            >
              พิมพ์เบอร์เอง
            </button>
            {canAdd ? (
              <button
                type="button"
                onClick={() => {
                  setAddOpen((v) => !v);
                  setAddError(null);
                }}
                className="inline-flex items-center gap-0.5 font-medium text-primary underline"
              >
                <Plus className="h-3 w-3" aria-hidden /> เพิ่มเจ้าหน้าที่
              </button>
            ) : null}
          </p>
        </>
      )}

      {/* ฟอร์มเพิ่มชื่อ+เบอร์ (supervisor+) — inline ไม่เปิด dialog ซ้อน (ฟอร์มแม่เป็น dialog อยู่แล้ว) */}
      {addOpen && !showManualInput ? (
        <div className={cn('space-y-2 rounded-xl border p-3', TONE.neutral.soft)}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">เพิ่มเจ้าหน้าที่ใหม่</span>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              aria-label="ปิดฟอร์มเพิ่มเจ้าหน้าที่"
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ชื่อเจ้าหน้าที่ เช่น คุณคิว ทีมสรรหา"
            aria-label="ชื่อเจ้าหน้าที่ใหม่"
            className="jarvis-soft-field min-h-[44px] w-full"
          />
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            inputMode="tel"
            placeholder="เบอร์โทร เช่น 021234567 ต่อ 101"
            aria-label="เบอร์เจ้าหน้าที่ใหม่"
            className="jarvis-soft-field min-h-[44px] w-full"
          />
          {addError ? (
            <p className={cn('rounded-lg px-2 py-1 text-[11px]', TONE.danger.soft, TONE.danger.value)}>
              {addError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void saveNewContact()}
            disabled={addBusy}
            className={cn(
              'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-4 text-xs font-semibold disabled:opacity-50',
              TONE.info.outline,
            )}
          >
            {addBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            บันทึกเข้ารายชื่อ
          </button>
        </div>
      ) : null}
    </div>
  );
}
