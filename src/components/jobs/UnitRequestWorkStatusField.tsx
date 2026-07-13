import React, { useEffect, useMemo, useState } from 'react';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import { cn } from '@/lib/utils';
import { saveUnitRequestWorkStatus } from '@/lib/siamrajUnitRequestsApi';
import {
  UNIT_REQUEST_WORK_STATUS_DATE_LABELS,
  UNIT_REQUEST_WORK_STATUS_LABELS,
  UNIT_REQUEST_WORK_STATUS_OPTIONS,
  formatWorkPersonName,
  resolveUnitRequestWorkStatus,
  type UnitRequestWorkStatus,
} from '@/lib/unitRequestWorkStatus';

type Props = {
  requestKey: string;
  initialStatus?: UnitRequestWorkStatus | null;
  initialFirstName?: string | null;
  initialLastName?: string | null;
  initialStatusDate?: string | null;
  onSaved?: (next: {
    work_status: UnitRequestWorkStatus;
    work_person_first_name: string | null;
    work_person_last_name: string | null;
    work_status_date: string | null;
  }) => void;
};

export function UnitRequestWorkStatusBadge({
  status,
  firstName,
  lastName,
  compact,
}: {
  status?: UnitRequestWorkStatus | null;
  firstName?: string | null;
  lastName?: string | null;
  compact?: boolean;
}) {
  const resolved = resolveUnitRequestWorkStatus(status);
  const label = UNIT_REQUEST_WORK_STATUS_LABELS[resolved];
  const person = formatWorkPersonName(firstName, lastName);
  const tone =
    resolved === 'in_progress'
      ? 'bg-amber-500/12 text-amber-800 border-amber-300/40'
      : resolved === 'evaluating'
        ? 'bg-orange-500/12 text-orange-800 border-orange-300/40'
        : resolved === 'waiting_inform'
          ? 'bg-sky-500/12 text-sky-800 border-sky-300/40'
          : resolved === 'waiting_interview'
            ? 'bg-violet-500/12 text-violet-800 border-violet-300/40'
            : 'bg-emerald-500/12 text-emerald-800 border-emerald-300/40';

  return (
    <span
      className={cn(
        'inline-flex flex-col items-start gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        tone,
        compact && 'max-w-[10rem]',
      )}
      title={person || label}
    >
      <span className={cn(compact && 'truncate max-w-full')}>{label}</span>
      {!compact && person ? <span className="text-[10px] font-normal opacity-80">{person}</span> : null}
    </span>
  );
}

export const UnitRequestWorkStatusEditor: React.FC<Props> = ({
  requestKey,
  initialStatus,
  initialFirstName,
  initialLastName,
  initialStatusDate,
  onSaved,
}) => {
  const { isFunctionEnabled } = useRolePermissions();
  const readOnly = !isFunctionEnabled('unit_notes_edit');

  const [status, setStatus] = useState<UnitRequestWorkStatus>(resolveUnitRequestWorkStatus(initialStatus));
  const [firstName, setFirstName] = useState(initialFirstName ?? '');
  const [lastName, setLastName] = useState(initialLastName ?? '');
  const [statusDate, setStatusDate] = useState((initialStatusDate ?? '').slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setStatus(resolveUnitRequestWorkStatus(initialStatus));
    setFirstName(initialFirstName ?? '');
    setLastName(initialLastName ?? '');
    setStatusDate((initialStatusDate ?? '').slice(0, 10));
    setError(null);
    setSavedMsg(null);
  }, [requestKey, initialStatus, initialFirstName, initialLastName, initialStatusDate]);

  const needsPerson = status !== 'in_progress';
  const dateLabel = UNIT_REQUEST_WORK_STATUS_DATE_LABELS[status];

  const baseline = useMemo(
    () => ({
      status: resolveUnitRequestWorkStatus(initialStatus),
      firstName: (initialFirstName ?? '').trim(),
      lastName: (initialLastName ?? '').trim(),
      statusDate: (initialStatusDate ?? '').slice(0, 10),
    }),
    [initialStatus, initialFirstName, initialLastName, initialStatusDate],
  );

  const dirty =
    status !== baseline.status ||
    firstName.trim() !== baseline.firstName ||
    lastName.trim() !== baseline.lastName ||
    statusDate !== baseline.statusDate;

  const persist = async () => {
    if (readOnly || saving || !requestKey.trim()) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const item = await saveUnitRequestWorkStatus(requestKey.trim(), {
        status,
        person_first_name: needsPerson ? firstName.trim() || null : null,
        person_last_name: needsPerson ? lastName.trim() || null : null,
        status_date: needsPerson ? statusDate || null : null,
      });
      onSaved?.({
        work_status: resolveUnitRequestWorkStatus(item.status as UnitRequestWorkStatus),
        work_person_first_name: item.person_first_name ?? null,
        work_person_last_name: item.person_last_name ?? null,
        work_status_date: item.status_date ?? null,
      });
      setSavedMsg('บันทึกสถานะทำงานแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะทำงาน</label>
        <select
          value={status}
          disabled={readOnly || saving}
          onChange={(e) => {
            setStatus(e.target.value as UnitRequestWorkStatus);
            setSavedMsg(null);
          }}
          className="w-full jarvis-soft-field"
        >
          {UNIT_REQUEST_WORK_STATUS_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {UNIT_REQUEST_WORK_STATUS_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      {needsPerson ? (
        <div className="space-y-3 rounded-xl border border-white/70 bg-white/40 p-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อ</label>
              <input
                value={firstName}
                disabled={readOnly || saving}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setSavedMsg(null);
                }}
                className="w-full jarvis-soft-field"
                placeholder="ชื่อ"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">นามสกุล</label>
              <input
                value={lastName}
                disabled={readOnly || saving}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setSavedMsg(null);
                }}
                className="w-full jarvis-soft-field"
                placeholder="นามสกุล"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {dateLabel} <span className="font-normal">(ข้ามได้ถ้ายังไม่ทราบ)</span>
            </label>
            <DateSelectDmyBe
              value={statusDate}
              onChange={(v) => {
                setStatusDate(v);
                setSavedMsg(null);
              }}
              allowEmpty
              disabled={readOnly || saving}
            />
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void persist()}
            disabled={saving || !dirty}
            className="jarvis-pill-btn text-sm px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกสถานะ'}
          </button>
          {savedMsg ? <span className="text-xs text-muted-foreground">{savedMsg}</span> : null}
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          ไม่มีสิทธิ์แก้ไขสถานะทำงาน — ติดต่อ Admin หรือดูที่ Settings → Role
        </p>
      )}
    </div>
  );
};
