/**
 * /documents — เมนู "เอกสาร" (เจ้าของ 23 พ.ย. 2569 "เอกสารถอดจากแท็บ เอาไปไว้ใน menu")
 * เดิมเป็นแท็บท้ายแถบงานสรรหา (`?view=documents`) · ลิงก์เก่าจากกระดิ่งพามาที่นี่เอง (StaffJobBoardPage)
 * เนื้อหน้า = `DocumentsWorkspace` ตัวเดิม (รายชื่อคนที่ส่งลิงก์ · แผงชุดเอกสาร) · `?applicationId=&packetId=` เปิดแผงคนนั้นทันที
 */
import PageHeader from '@/components/shared/PageHeader';
import DocumentsWorkspace from '@/components/documents/DocumentsWorkspace';
import { usePageTitle } from '@/hooks/usePageTitle';
import { vaultLabel } from '@/lib/soRecruitNav';

export default function DocumentsPage() {
  const title = vaultLabel('documents');
  usePageTitle(title);
  return (
    <div>
      <PageHeader title={title} subtitle="" backPath="/" />
      <div className="px-4 pb-8 md:px-6">
        <DocumentsWorkspace />
      </div>
    </div>
  );
}
