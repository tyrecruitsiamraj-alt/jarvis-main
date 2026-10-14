import { describe, expect, it } from 'vitest';
import { aiQueueStatusOf } from '@/lib/applicantAiQueueStatus';

/** ป้าย "รอ AI โทร" แบบบอกครบ (เจ้าของ Choice 14 ต.ค. 2569) */
const NOW = Date.parse('2026-10-14T05:00:00Z'); // 12:00 น.

describe('aiQueueStatusOf', () => {
  it('ไม่ใช่แถวรอ AI ⇒ null (ป้ายเดิมทำงาน)', () => {
    expect(aiQueueStatusOf({ last_call_status: 'completed' }, NOW)).toBeNull();
    expect(aiQueueStatusOf({}, NOW)).toBeNull();
  });

  it('ส่งรอบแรก ยังไม่มีผล ⇒ รอ AI โทร', () => {
    expect(aiQueueStatusOf({ last_call_status: 'pending', last_call_attempts: 1 }, NOW)).toMatchObject({
      kind: 'waiting',
      label: 'รอ AI โทร',
      atRisk: false,
    });
  });

  it('ตั้งโทรซ้ำไว้ ⇒ โทรไปแล้ว = ครั้งที่ − 1 · บอกผลรอบก่อน + เวลาโทรซ้ำ', () => {
    const q = aiQueueStatusOf(
      {
        last_call_status: 'pending',
        last_call_attempts: 3,
        last_call_followup: 'retry_scheduled',
        last_call_prev_outcome: 'no_answer',
        last_call_next_at: '2026-10-15T07:00:00Z',
      },
      NOW,
    );
    expect(q).toMatchObject({ kind: 'retry', label: 'AI โทรแล้ว 2 ครั้ง ไม่รับสาย', atRisk: false });
    expect(q?.sub).toMatch(/^โทรซ้ำ 15 ต\.ค\. .*14:00/);
  });

  it('เลยเวลานัดโทรซ้ำเกิน 15 นาทียังไม่มีผล ⇒ เตือน + เข้าชิป AI ไม่ได้ผล', () => {
    const q = aiQueueStatusOf(
      {
        last_call_status: 'pending',
        last_call_attempts: 3,
        last_call_followup: null,
        last_call_prev_outcome: 'unresponsive',
        last_call_next_at: '2026-10-13T11:00:00Z',
      },
      NOW,
    );
    expect(q).toMatchObject({ kind: 'retry_late', label: 'AI โทรแล้ว 2 ครั้ง ไม่ตอบ', tone: 'danger', atRisk: true });
    expect(q?.sub).toMatch(/^นัดโทรซ้ำ 13 ต\.ค\. .*18:00 ยังไม่มีผล$/);
  });

  it('ยังไม่ถึง 15 นาทีหลังนัด ⇒ ยังไม่เตือน', () => {
    const q = aiQueueStatusOf(
      {
        last_call_status: 'pending',
        last_call_attempts: 2,
        last_call_prev_outcome: 'busy',
        last_call_next_at: new Date(NOW - 10 * 60_000).toISOString(),
      },
      NOW,
    );
    expect(q?.kind).toBe('retry');
  });

  it('AI โทรครบแล้วไม่ได้คำตอบ (needs_human จากผลโทร) ⇒ โทรไปแล้ว = ครั้งที่ · ให้เจ้าหน้าที่โทร', () => {
    expect(
      aiQueueStatusOf(
        { last_call_status: 'pending', last_call_attempts: 3, last_call_followup: 'needs_human', last_call_prev_outcome: 'no_answer' },
        NOW,
      ),
    ).toMatchObject({ kind: 'needs_human', label: 'AI โทรแล้ว 3 ครั้ง ไม่รับสาย', sub: 'ให้เจ้าหน้าที่โทร', atRisk: true });
  });

  it('ส่งแล้วเงียบเกิน 24 ชม. รอบแรก ⇒ ส่ง AI แล้วไม่มีผล', () => {
    expect(
      aiQueueStatusOf(
        { last_call_status: 'pending', last_call_attempts: 1, last_call_followup: 'needs_human', last_call_push_state: 'push_gave_up' },
        NOW,
      ),
    ).toMatchObject({ kind: 'silent', label: 'ส่ง AI แล้วไม่มีผล', tone: 'danger', atRisk: true });
  });

  it('ส่งรอบโทรซ้ำแล้วเงียบ ⇒ บอกครั้งที่โทรไปแล้ว + รอบที่ไม่มีผล', () => {
    expect(
      aiQueueStatusOf(
        {
          last_call_status: 'pending',
          last_call_attempts: 2,
          last_call_followup: 'needs_human',
          last_call_push_state: 'push_gave_up',
          last_call_prev_outcome: 'no_answer',
        },
        NOW,
      ),
    ).toMatchObject({ kind: 'silent', label: 'AI โทรแล้ว 1 ครั้ง ไม่รับสาย', sub: 'รอบที่ 2 ไม่มีผลเกิน 24 ชม. ให้เจ้าหน้าที่โทร' });
  });

  it('Lumos ไม่รับสาย (failed/discarded) ⇒ แดง มาก่อนทุกแบบ', () => {
    expect(
      aiQueueStatusOf({ last_call_status: 'pending', last_call_attempts: 1, last_call_import_status: 'discarded' }, NOW),
    ).toMatchObject({ kind: 'not_imported', label: 'Lumos ไม่รับสาย', sub: 'AI ยังไม่ได้โทร', atRisk: true });
  });
});

describe('ชิป "AI ไม่ได้ผล" ของแท็บผู้สมัคร', () => {
  it('รวมเฉพาะสายที่ AI จะไม่โทรแล้ว/เลยนัดแล้วไม่มีผล — รอโทรซ้ำตามนัดไม่นับ', async () => {
    const { isInRmListView } = await import('@/lib/recruitRm');
    const base = { id: 'a', status: 'new' } as never;
    const row = (x: object) => ({ ...(base as object), ...x }) as Parameters<typeof isInRmListView>[0];
    expect(isInRmListView(row({ last_call_status: 'pending', last_call_followup: 'needs_human', last_call_attempts: 3 }), 'ai_at_risk')).toBe(true);
    expect(
      isInRmListView(
        row({
          last_call_status: 'pending',
          last_call_followup: 'retry_scheduled',
          last_call_attempts: 2,
          last_call_prev_outcome: 'no_answer',
          last_call_next_at: new Date(Date.now() + 3600_000).toISOString(),
        }),
        'ai_at_risk',
      ),
    ).toBe(false);
    expect(isInRmListView(row({ last_call_status: 'pending', last_call_attempts: 1 }), 'ai_at_risk')).toBe(false);
  });
});

describe('รอบแรกส่งแล้วเงียบ (เจ้าของ 14 ต.ค. 2569 "แก้แบบที่บอกยัง")', () => {
  it('ส่งเกิน 30 นาทียังไม่มีผล ⇒ แดง + เข้าชิป · ยังไม่ถึง 30 นาที ⇒ รอ AI โทร', () => {
    const late = aiQueueStatusOf({ last_call_status: 'pending', last_call_attempts: 1, last_call_sent_at: '2026-10-14T03:36:00Z' }, NOW);
    expect(late).toMatchObject({ kind: 'first_late', label: 'ส่ง AI แล้ว ยังไม่มีผล', tone: 'danger', atRisk: true });
    expect(late?.sub).toMatch(/^ส่ง 14 ต\.ค\. .*10:36$/);
    const fresh = aiQueueStatusOf(
      { last_call_status: 'pending', last_call_attempts: 1, last_call_sent_at: new Date(NOW - 10 * 60_000).toISOString() },
      NOW,
    );
    expect(fresh?.kind).toBe('waiting');
  });
});
