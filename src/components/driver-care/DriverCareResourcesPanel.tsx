import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  deleteDriverCareKnowledge,
  deleteDriverCareSkill,
  fetchDriverCareKnowledge,
  fetchDriverCareSkills,
  saveDriverCareKnowledge,
  saveDriverCareSkill,
} from '@/lib/driverCareApi';
import {
  DRIVER_CARE_KNOWLEDGE_CATEGORY_LABELS,
  DRIVER_CARE_SKILL_CATEGORY_LABELS,
  type DriverCareKnowledge,
  type DriverCareKnowledgeCategory,
  type DriverCareSkill,
  type DriverCareSkillCategory,
} from '@/types/driverCare';
import { BookOpen, Brain, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tab = 'skills' | 'knowledge';

const SKILL_CATEGORIES = Object.keys(DRIVER_CARE_SKILL_CATEGORY_LABELS) as DriverCareSkillCategory[];
const KNOWLEDGE_CATEGORIES = Object.keys(
  DRIVER_CARE_KNOWLEDGE_CATEGORY_LABELS,
) as DriverCareKnowledgeCategory[];

const emptySkill = () => ({
  title: '',
  category: 'intervention' as DriverCareSkillCategory,
  description: '',
  fileUrl: '',
  sortOrder: '0',
});

const emptyKnowledge = () => ({
  title: '',
  category: 'pre_resign_behavior' as DriverCareKnowledgeCategory,
  summary: '',
  content: '',
  fileUrl: '',
  fileName: '',
  sortOrder: '0',
});

const DriverCareResourcesPanel: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('supervisor');
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('knowledge');
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [skillForm, setSkillForm] = useState(emptySkill);
  const [knowledgeForm, setKnowledgeForm] = useState(emptyKnowledge);
  const [saving, setSaving] = useState(false);

  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ['driver-care', 'skills'],
    queryFn: fetchDriverCareSkills,
  });

  const { data: knowledge = [], isLoading: knowledgeLoading } = useQuery({
    queryKey: ['driver-care', 'knowledge'],
    queryFn: fetchDriverCareKnowledge,
  });

  const knowledgeByCategory = useMemo(() => {
    const map = new Map<string, DriverCareKnowledge[]>();
    for (const k of knowledge) {
      const list = map.get(k.category) || [];
      list.push(k);
      map.set(k.category, list);
    }
    return map;
  }, [knowledge]);

  const resetSkillForm = () => {
    setEditingSkillId(null);
    setSkillForm(emptySkill());
  };

  const resetKnowledgeForm = () => {
    setEditingKnowledgeId(null);
    setKnowledgeForm(emptyKnowledge());
  };

  const startEditSkill = (s: DriverCareSkill) => {
    setTab('skills');
    setEditingSkillId(s.id);
    setSkillForm({
      title: s.title,
      category: s.category as DriverCareSkillCategory,
      description: s.description,
      fileUrl: s.fileUrl || '',
      sortOrder: String(s.sortOrder),
    });
  };

  const startEditKnowledge = (k: DriverCareKnowledge) => {
    setTab('knowledge');
    setEditingKnowledgeId(k.id);
    setKnowledgeForm({
      title: k.title,
      category: k.category as DriverCareKnowledgeCategory,
      summary: k.summary || '',
      content: k.content,
      fileUrl: k.fileUrl || '',
      fileName: k.fileName || '',
      sortOrder: String(k.sortOrder),
    });
  };

  const submitSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !skillForm.title.trim()) return;
    setSaving(true);
    try {
      await saveDriverCareSkill({
        id: editingSkillId || undefined,
        title: skillForm.title.trim(),
        category: skillForm.category,
        description: skillForm.description.trim(),
        fileUrl: skillForm.fileUrl.trim() || undefined,
        sortOrder: Number(skillForm.sortOrder) || 0,
      });
      toast.success(editingSkillId ? 'อัปเดต Skill แล้ว' : 'เพิ่ม Skill แล้ว');
      resetSkillForm();
      await queryClient.invalidateQueries({ queryKey: ['driver-care', 'skills'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const submitKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !knowledgeForm.title.trim()) return;
    setSaving(true);
    try {
      await saveDriverCareKnowledge({
        id: editingKnowledgeId || undefined,
        title: knowledgeForm.title.trim(),
        category: knowledgeForm.category,
        summary: knowledgeForm.summary.trim() || undefined,
        content: knowledgeForm.content.trim(),
        fileUrl: knowledgeForm.fileUrl.trim() || undefined,
        fileName: knowledgeForm.fileName.trim() || undefined,
        sortOrder: Number(knowledgeForm.sortOrder) || 0,
      });
      toast.success(editingKnowledgeId ? 'อัปเดต Knowledge แล้ว' : 'เพิ่ม Knowledge แล้ว');
      resetKnowledgeForm();
      await queryClient.invalidateQueries({ queryKey: ['driver-care', 'knowledge'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const removeSkill = async (id: string) => {
    if (!canEdit || !window.confirm('ลบ Skill นี้?')) return;
    try {
      await deleteDriverCareSkill(id);
      toast.success('ลบ Skill แล้ว');
      if (editingSkillId === id) resetSkillForm();
      await queryClient.invalidateQueries({ queryKey: ['driver-care', 'skills'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const removeKnowledge = async (id: string) => {
    if (!canEdit || !window.confirm('ลบ Knowledge นี้?')) return;
    try {
      await deleteDriverCareKnowledge(id);
      toast.success('ลบ Knowledge แล้ว');
      if (editingKnowledgeId === id) resetKnowledgeForm();
      await queryClient.invalidateQueries({ queryKey: ['driver-care', 'knowledge'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        จัดการทักษะและความรู้ Driver Care — รวมพฤติกรรมก่อนลาออก วางไฟล์ใน{' '}
        <code className="text-xs bg-secondary px-1 rounded">docs/driver-care/</code> แล้วใส่ลิงก์ในฟอร์ม
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('knowledge')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors',
            tab === 'knowledge' ? 'bg-blue-500 text-white' : 'bg-white/60 text-muted-foreground',
          )}
        >
          <BookOpen className="w-4 h-4" />
          Knowledge
        </button>
        <button
          type="button"
          onClick={() => setTab('skills')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors',
            tab === 'skills' ? 'bg-blue-500 text-white' : 'bg-white/60 text-muted-foreground',
          )}
        >
          <Brain className="w-4 h-4" />
          Skills
        </button>
      </div>

      {tab === 'knowledge' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
            <h3 className="text-sm font-semibold">รายการ Knowledge</h3>
            {knowledgeLoading ? (
              <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
            ) : knowledge.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มี Knowledge — เพิ่มหัวข้อพฤติกรรมก่อนลาออกได้จากฟอร์มด้านขวา
              </p>
            ) : (
              KNOWLEDGE_CATEGORIES.map((cat) => {
                const items = knowledgeByCategory.get(cat) || [];
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs font-medium text-blue-700 mb-2">
                      {DRIVER_CARE_KNOWLEDGE_CATEGORY_LABELS[cat]}
                    </p>
                    <div className="space-y-2">
                      {items.map((k) => (
                        <div
                          key={k.id}
                          className="rounded-xl border border-white/70 bg-white/40 p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => startEditKnowledge(k)}
                              className="font-medium text-left text-foreground hover:text-blue-700"
                            >
                              {k.title}
                            </button>
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() => void removeKnowledge(k.id)}
                                className="text-destructive p-1"
                                aria-label="ลบ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                          </div>
                          {k.summary ? (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{k.summary}</p>
                          ) : null}
                          {k.fileUrl ? (
                            <a
                              href={k.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 mt-2 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {k.fileName || 'เปิดไฟล์'}
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {canEdit ? (
            <form
              onSubmit={(e) => void submitKnowledge(e)}
              className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3"
            >
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {editingKnowledgeId ? 'แก้ไข Knowledge' : 'เพิ่ม Knowledge'}
              </h3>
              <input
                className="jarvis-soft-field"
                placeholder="หัวข้อ เช่น พฤติกรรมลด OT ก่อนลาออก"
                value={knowledgeForm.title}
                onChange={(e) => setKnowledgeForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
              <select
                className="jarvis-soft-field"
                value={knowledgeForm.category}
                onChange={(e) =>
                  setKnowledgeForm((f) => ({
                    ...f,
                    category: e.target.value as DriverCareKnowledgeCategory,
                  }))
                }
              >
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DRIVER_CARE_KNOWLEDGE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                className="jarvis-soft-field"
                placeholder="สรุปสั้นๆ (ไม่บังคับ)"
                value={knowledgeForm.summary}
                onChange={(e) => setKnowledgeForm((f) => ({ ...f, summary: e.target.value }))}
              />
              <textarea
                className="jarvis-soft-field min-h-[120px] resize-y"
                placeholder="เนื้อหา / รายละเอียดพฤติกรรมก่อนลาออก"
                value={knowledgeForm.content}
                onChange={(e) => setKnowledgeForm((f) => ({ ...f, content: e.target.value }))}
              />
              <input
                className="jarvis-soft-field"
                placeholder="ลิงก์ไฟล์ (URL) เช่น /docs/driver-care/behavior.pdf"
                value={knowledgeForm.fileUrl}
                onChange={(e) => setKnowledgeForm((f) => ({ ...f, fileUrl: e.target.value }))}
              />
              <input
                className="jarvis-soft-field"
                placeholder="ชื่อไฟล์แสดงผล (ไม่บังคับ)"
                value={knowledgeForm.fileName}
                onChange={(e) => setKnowledgeForm((f) => ({ ...f, fileName: e.target.value }))}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="flex-1 jarvis-pill-btn text-sm disabled:opacity-50">
                  {saving ? 'กำลังบันทึก…' : 'บันทึก Knowledge'}
                </button>
                {editingKnowledgeId ? (
                  <button type="button" onClick={resetKnowledgeForm} className="px-3 py-2 text-sm rounded-full border">
                    ยกเลิก
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground glass-card rounded-[1.5rem] p-4 border border-white/70">
              เฉพาะ Supervisor / Admin เท่านั้นที่เพิ่มหรือแก้ไข Knowledge
            </p>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
            <h3 className="text-sm font-semibold">รายการ Skills</h3>
            {skillsLoading ? (
              <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
            ) : skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มี Skill</p>
            ) : (
              <div className="space-y-2">
                {skills.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/70 bg-white/40 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => startEditSkill(s)}
                        className="font-medium text-left hover:text-blue-700"
                      >
                        {s.title}
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => void removeSkill(s.id)}
                          className="text-destructive p-1"
                          aria-label="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-blue-700 mt-0.5">
                      {DRIVER_CARE_SKILL_CATEGORY_LABELS[s.category as DriverCareSkillCategory]}
                    </p>
                    {s.description ? (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{s.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {canEdit ? (
            <form
              onSubmit={(e) => void submitSkill(e)}
              className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3"
            >
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {editingSkillId ? 'แก้ไข Skill' : 'เพิ่ม Skill'}
              </h3>
              <input
                className="jarvis-soft-field"
                placeholder="ชื่อ Skill"
                value={skillForm.title}
                onChange={(e) => setSkillForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
              <select
                className="jarvis-soft-field"
                value={skillForm.category}
                onChange={(e) =>
                  setSkillForm((f) => ({ ...f, category: e.target.value as DriverCareSkillCategory }))
                }
              >
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DRIVER_CARE_SKILL_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <textarea
                className="jarvis-soft-field min-h-[100px] resize-y"
                placeholder="รายละเอียดทักษะ / วิธีปฏิบัติ"
                value={skillForm.description}
                onChange={(e) => setSkillForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                className="jarvis-soft-field"
                placeholder="ลิงก์อ้างอิง (ไม่บังคับ)"
                value={skillForm.fileUrl}
                onChange={(e) => setSkillForm((f) => ({ ...f, fileUrl: e.target.value }))}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="flex-1 jarvis-pill-btn text-sm disabled:opacity-50">
                  {saving ? 'กำลังบันทึก…' : 'บันทึก Skill'}
                </button>
                {editingSkillId ? (
                  <button type="button" onClick={resetSkillForm} className="px-3 py-2 text-sm rounded-full border">
                    ยกเลิก
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground glass-card rounded-[1.5rem] p-4 border border-white/70">
              เฉพาะ Supervisor / Admin เท่านั้นที่เพิ่มหรือแก้ไข Skills
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverCareResourcesPanel;
