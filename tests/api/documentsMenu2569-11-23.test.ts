/** เอกสารถอดจากแท็บงานสรรหา ไปเป็นเมนู (เจ้าของ 23 พ.ย. 2569 "เอกสารถอดจากแท็บ เอาไปไว้ใน menu") */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONVEYOR_VAULT, vaultLabel } from '@/lib/soRecruitNav';
import { documentsDeepLink } from '@/lib/documents/documentNotification';

describe('เมนู เอกสาร', () => {
  it('อยู่กลุ่มคลังข้อมูล ต่อจากงานสรรหา · หน้า /documents · ชื่อหัวหน้า = ชื่อเมนู', () => {
    const keys = CONVEYOR_VAULT.map((v) => v.key);
    expect(keys.indexOf('documents')).toBe(keys.indexOf('job-boxes') + 1);
    expect(CONVEYOR_VAULT.find((v) => v.key === 'documents')?.path).toBe('/documents');
    expect(vaultLabel('documents')).toBe('เอกสาร');
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('<Route path="/documents" element={<DocumentsPage />} />');
    expect(readFileSync('src/pages/documents/DocumentsPage.tsx', 'utf8')).toContain("vaultLabel('documents')");
  });

  it('แท็บเอกสารถอดออกจากแถบงานสรรหาหมด · ลิงก์เก่า ?view=documents พาไปหน้าใหม่พร้อมรหัสเดิม', () => {
    const board = readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8');
    expect(board).not.toContain('DOCUMENTS_VIEW_TAB');
    expect(board).not.toContain('board-tab-documents');
    const page = readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8');
    expect(page).not.toContain('DocumentsWorkspace');
    expect(page).toContain("if (raw === 'documents') {");
    expect(page).toContain("return <Navigate to={qs ? `/documents?${qs}` : '/documents'} replace />;");
  });

  it('กระดิ่ง/ปุ่มเปิดชุด พามาหน้าเมนู', () => {
    expect(documentsDeepLink('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')).toBe(
      '/documents?applicationId=00000000-0000-4000-8000-000000000001&packetId=00000000-0000-4000-8000-000000000002',
    );
  });
});
