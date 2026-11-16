/**
 * แผงนำเข้าข้อสอบในป๊อปชุดข้อสอบ (เจ้าของ 15 พ.ย. 2569 "ลองดู Knowa … นำเข้าเป็นไฟล์ได้") — อยู่ในป๊อปเดิม ไม่ซ้อนป๊อป
 * ไฟล์ Excel/Word/CSV อ่านในเครื่อง (`officeTable.ts`) → ข้อความในช่องให้ตรวจ/แก้ → `parseQuizImport` ตัวเดียว → กดเพิ่มเข้าชุด
 * ยังไม่บันทึกจนกด "บันทึกชุดข้อสอบ" ของป๊อปเหมือนเพิ่มข้อเอง
 */
import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { decodeTextFile, officeFileToTsv } from '@/lib/officeTable';
import { buildTemplateDocx, buildTemplateXlsx } from '@/lib/officeTemplate';
import { QUIZ_IMPORT_HEADERS, QUIZ_IMPORT_HOWTO, QUIZ_IMPORT_SAMPLE, addImportedQuestions, parseQuizImport } from '@/lib/quizImport';
import { QUIZ_MAX_QUESTIONS, type QuizSetContent } from '@/lib/skillQuiz';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ'];

function saveFile(name: string, mime: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = { content: QuizSetContent; fallbackSkillId: string; onAdd: (next: QuizSetContent) => void; onClose: () => void };

export default function QuizImportPanel({ content, fallbackSkillId, onAdd, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState<{ text: string; error: boolean } | null>(null);
  const result = useMemo(() => (text.trim() ? parseQuizImport(text, content.skills, fallbackSkillId) : null), [text, content.skills, fallbackSkillId]);
  const kept = content.questions.filter((q) => q.prompt.trim()).length;
  const room = Math.max(0, QUIZ_MAX_QUESTIONS - kept);
  const adding = Math.min(result?.questions.length ?? 0, room);
  const skillName = (id: string) => [...content.skills, ...(result?.newSkills ?? [])].find((s) => s.id === id)?.name.trim() || 'ยังไม่ตั้งชื่อทักษะ';

  const pickFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.docx')) {
      const r = await officeFileToTsv(file);
      if (r.errorTh) return setSource({ text: r.errorTh, error: true });
      setText(r.tsv);
      return setSource({ text: r.sourceTh, error: false });
    }
    const r = await decodeTextFile(file);
    if (r.errorTh) return setSource({ text: r.errorTh, error: true });
    setText(r.text);
    setSource({ text: `อ่านจากไฟล์ ${file.name}`, error: false });
  };

  return (
    <section className="space-y-3 rounded-xl border border-border bg-muted/40 p-4" data-testid="quiz-import">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-medium text-foreground">นำเข้าข้อสอบ</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => saveFile('แบบฟอร์มข้อสอบ.xlsx', XLSX_MIME, buildTemplateXlsx(QUIZ_IMPORT_HEADERS, QUIZ_IMPORT_SAMPLE, QUIZ_IMPORT_HOWTO, [22, 50, 24, 24, 24, 24, 30, 10]))}>
          <FileSpreadsheet /> แบบฟอร์ม Excel
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => saveFile('แบบฟอร์มข้อสอบ.docx', DOCX_MIME, buildTemplateDocx('แบบฟอร์มข้อสอบ', QUIZ_IMPORT_HEADERS, QUIZ_IMPORT_SAMPLE, QUIZ_IMPORT_HOWTO))}>
          <FileText /> แบบฟอร์ม Word
        </Button>
        <Button type="button" size="sm" onClick={() => fileRef.current?.click()} data-testid="quiz-import-file">
          <Upload /> เลือกไฟล์
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.docx,.csv,.txt,.tsv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void pickFile(f);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quiz-import-text">หรือวางจาก Excel</Label>
        <Textarea
          id="quiz-import-text"
          rows={5}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSource(null);
          }}
          placeholder={QUIZ_IMPORT_HEADERS.join('    ')}
          className="font-mono text-xs"
        />
        {source ? <p className={cn('text-xs', source.error ? TONE.danger.value : 'text-muted-foreground')}>{source.text}</p> : null}
      </div>

      {result ? (
        <div className="space-y-2 text-sm" data-testid="quiz-import-preview">
          <p className="tabular-nums">
            อ่านได้ <span className="font-medium">{result.questions.length}</span> ข้อ
            {result.newSkills.length ? <span className="text-muted-foreground"> · ทักษะใหม่ {result.newSkills.map((s) => s.name).join(', ')}</span> : null}
            {result.questions.length > room ? <span className={TONE.warn.value}> · ชุดนี้เพิ่มได้อีก {room} ข้อ</span> : null}
          </p>
          {result.issues.length ? (
            <ul className={cn('space-y-0.5 text-xs', TONE.danger.value)}>
              {result.issues.slice(0, 20).map((i, k) => (
                <li key={k}>{i.line ? `แถว ${i.line}: ${i.message}` : i.message}</li>
              ))}
              {result.issues.length > 20 ? <li>อีก {result.issues.length - 20} แถว</li> : null}
            </ul>
          ) : null}
          {result.questions.length ? (
            <ol className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2 text-xs">
              {result.questions.map((q, i) => (
                <li key={q.id} className="flex gap-2">
                  <span className="shrink-0 tabular-nums text-muted-foreground">{kept + i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    {q.prompt}
                    <span className="block text-muted-foreground">
                      {skillName(q.skillId)} · {q.points} คะแนน · เฉลย {LETTERS[q.answer]} {q.choices[q.answer]}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          ปิด
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!result || adding === 0}
          onClick={() => {
            if (!result) return;
            onAdd(addImportedQuestions(content, result));
            setText('');
            setSource(null);
            onClose();
          }}
          data-testid="quiz-import-add"
        >
          เพิ่ม {adding} ข้อ
        </Button>
      </div>
    </section>
  );
}
