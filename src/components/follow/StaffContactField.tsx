import React, { useEffect, useMemo, useState } from 'react';
import {
  listStaffContactsCached,
  createStaffContact,
  type FollowStaffContact,
} from '@/lib/followStaffContactsApi';
import {
  refreshJobStaffFromApi,
  JOB_STAFF_ROSTER_CHANGED_EVENT,
} from '@/lib/jobStaffRemote';
import { buildScreenerNameOptions } from '@/lib/jobStaffNames';
import {
  rememberedPhoneForName,
  nameForPhone,
  staffNameOptions,
} from '@/lib/followStaffMemory';

/**
 * ช่อง "เจ้าหน้าที่ที่ติดตาม" (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-9):
 * *"เอาชื่อมาจากเจ้าหน้าที่คัดสรร เบอร์โทรให้เขาพิมพ์เอง แล้วมันจำไว้ว่าเคยเลือกชื่อใคร
 * แล้วเบอร์ไหน ให้มันขึ้นมาเอง"*
 *
 * - **ชื่อ** = dropdown จาก roster คัดสรร (+ ชื่อที่เคยจำไว้)
 * - **เบอร์** = พิมพ์เอง · ค่าที่ส่งออก (`onChange`) ยังเป็น **เบอร์อย่างเดียว** (`staff_phone`
 *   เดิม ไม่แตะ schema ของ follow_entries)
 * - **ความจำ** เก็บใน `follow_staff_contacts` (name, phone) — เลือกชื่อที่เคยใช้แล้ว
 *   เบอร์ล่าสุดของชื่อนั้น prefill ให้เอง (แก้ทับได้) · พิมพ์เบอร์เสร็จ (blur) จำคู่ใหม่
 *
 * ⚠️ ชื่อเป็น state ภายในช่อง — รายการ Follow เก็บแค่เบอร์ · เปิดแก้รายการเก่าที่มีแต่เบอร์
 * จะย้อนหาชื่อจากความจำให้ (nameForPhone)
 */
export default function StaffContactField({
  id,
  value,
  onChange,
  label = 'เจ้าหน้าที่ที่ติดตาม (ถ้ามี)',
  reloadSignal,
}: {
  id: string;
  /** เบอร์ที่เก็บใน staff_phone */
  value: string;
  onChange: (phone: string) => void;
  label?: string;
  /** bump เมื่อ roster/ความจำเปลี่ยน (เพิ่มจาก dialog จัดการ) — โหลดใหม่ */
  reloadSignal?: number;
}) {
  const [contacts, setContacts] = useState<FollowStaffContact[]>([]);
  const [rosterRev, setRosterRev] = useState(0);
  const [name, setName] = useState('');
  /** ค่าที่ผู้ใช้ตั้งใจ "ไม่ผูกชื่อ" — พิมพ์เบอร์เองล้วน ๆ ไม่ต้อง prefill */
  const [manualName, setManualName] = useState(false);

  // โหลด roster คัดสรร (ครั้งเดียวก็พอ · ฟัง event เพื่อ re-render) + ความจำ name→phone
  useEffect(() => {
    void refreshJobStaffFromApi();
    const onRoster = () => setRosterRev((r) => r + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, onRoster);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, onRoster);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listStaffContactsCached()
      .then((v) => {
        if (!cancelled) setContacts(v);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadSignal]);

  const nameOptions = useMemo(() => {
    void rosterRev;
    return staffNameOptions(buildScreenerNameOptions(), contacts);
  }, [rosterRev, contacts]);

  // เปิดแก้รายการเก่าที่มีแต่เบอร์ → ย้อนหาชื่อจากความจำ (ถ้าตรง) มาโชว์ให้
  useEffect(() => {
    if (name || manualName) return;
    const found = nameForPhone(value, contacts);
    if (found) setName(found);
    // จับเฉพาะตอน contacts มา/value เปลี่ยนจากภายนอก
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, value]);

  const pickName = (next: string) => {
    setName(next);
    setManualName(false);
    if (!next) return;
    // เลือกชื่อที่เคยใช้ → เบอร์ล่าสุดของชื่อนั้นขึ้นมาเอง (ถ้ามี · ทับเบอร์เดิมในช่อง)
    const remembered = rememberedPhoneForName(next, contacts);
    if (remembered) onChange(remembered);
  };

  // จำคู่ ชื่อ+เบอร์ เมื่อพิมพ์เบอร์เสร็จ — createStaffContact ล้างแคชให้เอง
  // ซ้ำ (409) = จำอยู่แล้ว ไม่เป็นไร · error อื่นก็เงียบ ไม่ให้ขวางงานหลัก
  const rememberPair = () => {
    const n = name.trim();
    const p = value.trim();
    if (!n || !p) return;
    if (rememberedPhoneForName(n, contacts) === p) return; // จำตรงนี้อยู่แล้ว
    void createStaffContact(n, p)
      .then((created) => setContacts((prev) => [...prev, created]))
      .catch(() => {
        /* 409/อื่น ๆ เงียบ */
      });
  };

  const nameSelectValue = name && nameOptions.some((n) => n === name) ? name : name ? '__other__' : '';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ml-1 text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={nameSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__manual__') {
              setManualName(true);
              setName('');
              return;
            }
            if (v === '__other__') return;
            pickName(v);
          }}
          aria-label={`ชื่อ${label}`}
          className="jarvis-soft-field min-h-[46px] w-full"
        >
          <option value="">— เลือกชื่อ (คัดสรร) —</option>
          {name && !nameOptions.some((n) => n === name) ? (
            <option value="__other__">{name} (ชื่อเดิม)</option>
          ) : null}
          {nameOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value="__manual__">พิมพ์เบอร์เองไม่ผูกชื่อ</option>
        </select>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={rememberPair}
          inputMode="tel"
          placeholder="เบอร์โทร เช่น 021234567 ต่อ 101"
          className="jarvis-soft-field min-h-[46px] w-full"
        />
      </div>
      <p className="ml-1 text-[10px] text-muted-foreground">
        เลือกชื่อจากคัดสรรแล้วพิมพ์เบอร์ — ครั้งหน้าเลือกชื่อเดิมเบอร์จะขึ้นให้เอง ·
        AI บอกเบอร์นี้ตอนท้ายสายให้ผู้สมัครโทรกลับ
      </p>
    </div>
  );
}
