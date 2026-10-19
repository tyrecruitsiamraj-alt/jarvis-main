import { Suspense } from "react";
import { lazyPage } from "@/lib/staleChunkReload";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams, useLocation } from "react-router-dom";
import PublicApplyLayout from "@/components/layout/PublicApplyLayout";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RolePermissionsProvider } from "@/contexts/RolePermissionsContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import AppLayout from "@/components/layout/AppLayout";
import PageErrorBoundary from "@/components/shared/PageErrorBoundary";
import LoginPage from "@/pages/LoginPage";
import RequireDepartment from "@/components/auth/RequireDepartment";
import ViewAsRoleBanner from "@/components/layout/ViewAsRoleBanner";
import RequireRole from "@/components/auth/RequireRole";

/** โหลดทีละหน้าเมื่อถูกเรียกใช้ (code-split) — ลดขนาด JS ก้อนแรกให้เปิดแอปเร็วขึ้น */
const PublicJobBoardPage = lazyPage(() => import("@/pages/public/PublicJobBoardPage"));
const PublicPostingApplyPage = lazyPage(() => import("@/pages/public/PublicPostingApplyPage"));
const PrivacyRequestPage = lazyPage(() => import("@/pages/public/PrivacyRequestPage"));
const ShortLinkRedirectPage = lazyPage(() => import("@/pages/public/ShortLinkRedirectPage"));
const MagicLinkVerifyPage = lazyPage(() => import("@/pages/MagicLinkVerifyPage"));
const ResetPasswordPage = lazyPage(() => import("@/pages/ResetPasswordPage"));
const HomePage = lazyPage(() => import("@/pages/HomePage"));
const WorkQueuePage = lazyPage(() => import("@/pages/work/WorkQueuePage"));
const WLDashboard = lazyPage(() => import("@/pages/wl/WLDashboard"));
const MonthlyPlanner = lazyPage(() => import("@/pages/wl/MonthlyPlanner"));
const DailyAssignment = lazyPage(() => import("@/pages/wl/DailyAssignment"));
const GlobalCalendar = lazyPage(() => import("@/pages/wl/GlobalCalendar"));
const WLEmployees = lazyPage(() => import("@/pages/wl/WLEmployees"));
const EmployeeProfile = lazyPage(() => import("@/pages/wl/EmployeeProfile"));
const AddEmployeePage = lazyPage(() => import("@/pages/wl/AddEmployeePage"));
const MatchingDashboard = lazyPage(() => import("@/pages/matching/MatchingDashboard"));
const CandidateProfile = lazyPage(() => import("@/pages/matching/CandidateProfile"));
const AddCandidatePage = lazyPage(() => import("@/pages/matching/AddCandidatePage"));
const MatchingPage = lazyPage(() => import("@/pages/matching/MatchingPage"));
const SelectionContactPage = lazyPage(() => import("@/pages/matching/SelectionContactPage"));
const PreCheckPage = lazyPage(() => import("@/pages/matching/PreCheckPage"));
const RecruitRmPage = lazyPage(() => import("@/pages/recruit/RecruitRmPage"));
const RecruitChannelsPage = lazyPage(() => import("@/pages/recruit/RecruitChannelsPage"));
const ReservationsPage = lazyPage(() => import("@/pages/matching/ReservationsPage"));
const OurPeoplePage = lazyPage(() => import("@/pages/matching/OurPeoplePage"));
const JobDashboard = lazyPage(() => import("@/pages/jobs/JobDashboard"));
const JobListPage = lazyPage(() => import("@/pages/jobs/JobListPage"));
const StaffJobBoardPage = lazyPage(() => import("@/pages/jobs/StaffJobBoardPage"));
const JobDetailPage = lazyPage(() => import("@/pages/jobs/JobDetailPage"));
const SiamrajUnitRequestDetailPage = lazyPage(() => import("@/pages/jobs/SiamrajUnitRequestDetailPage"));
// แท็บย่อยของใบขอ (16 ส.ค. 2569 เย็น) — ผู้สมัคร / AI Match / การติดต่อ
const UnitRequestTabPage = lazyPage(() => import("@/pages/jobs/UnitRequestTabPage"));
const BoardPostingPage = lazyPage(() => import("@/pages/jobs/BoardPostingPage"));

/**
 * ลิงก์เก่า `/jobs/siamraj/:id/posting` → `/jobs/board/:id/posting`
 * (แท็บ "ประกาศ / ลิงก์สมัคร" เคยอยู่ในหน้าใบขอหนึ่งรอบ · เจ้าของสั่งย้ายไปกล่องงาน
 *  27 ส.ค. 2569 — ลิงก์ที่ใครบันทึกไว้ต้องไม่ 404)
 */
function LegacyPostingRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/jobs/board/${encodeURIComponent(id)}/posting`} replace />;
}
const FollowPage = lazyPage(() => import("@/pages/follow/FollowPage"));
const AftercarePage = lazyPage(() => import("@/pages/aftercare/AftercarePage"));
/** หน้าความคุ้มค่าระบบ (15 ต.ค. 2569) — ไม่มีในเมนู เปิดได้เฉพาะบัญชีที่ API อนุญาต */
const ValueCasePage = lazyPage(() => import("@/pages/value/ValueCasePage"));
const SupervisorDashboard = lazyPage(() => import("@/pages/dashboard/SupervisorDashboard"));
const AdminSettings = lazyPage(() => import("@/pages/settings/AdminSettings"));
const ChangePasswordPage = lazyPage(() => import("@/pages/ChangePasswordPage"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const RoleHubPage = lazyPage(() => import("./pages/RoleHubPage"));

const queryClient = new QueryClient();

const PageLoadingFallback = () => (
  <div className="jarvis-warm-bg min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm">
    <div className="jarvis-frost px-8 py-6 text-center">
      <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-blue-400/40 border-t-blue-500 animate-spin" aria-hidden />
      กำลังโหลด…
    </div>
  </div>
);

const ProtectedRoutes = () => {
  const { isAuthenticated, bootstrapping } = useAuth();
  const location = useLocation();
  if (bootstrapping) {
    return (
      <div className="jarvis-warm-bg min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        <div className="jarvis-frost px-8 py-6 text-center">
          <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-blue-400/40 border-t-blue-500 animate-spin" aria-hidden />
          กำลังเข้าสู่ระบบ…
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <LoginPage />;
  }
  return (
    <RequireDepartment>
      {/* 🔴 แถบ "กำลังดูมุมมองของ role อื่น" อยู่นอก AppLayout และนอก RequireRole
          — สวมมุมมองแล้วอาจโดนเด้งไปหน้าที่ไม่มีเมนู ปุ่มออกต้องตามไปด้วยเสมอ */}
      <ViewAsRoleBanner />
      <AppLayout>
        <RequireRole>
          <PageErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
            <Route path="/" element={<HomePage />} />
            {/* 🔴 "คิวงานของฉัน" — หน้าโฉมใหม่ล้วน (5 ก.ย. 2569) · ไม่ได้เปิดสวิตช์ `?ui=v2`
                หน้านี้จะเด้งกลับหน้าแรกเอง ⇒ พนักงานที่ยังใช้ของเดิมไม่มีทางหลงเข้ามา */}
            <Route path="/work" element={<WorkQueuePage />} />
            <Route path="/opl" element={<RoleHubPage role="opl" />} />
            <Route path="/staff" element={<RoleHubPage role="staff" />} />
            <Route path="/supervisor" element={<RoleHubPage role="supervisor" />} />
            <Route path="/admin" element={<RoleHubPage role="admin" />} />
            <Route path="/wl" element={<WLDashboard />} />
            <Route path="/wl/monthly-planner" element={<MonthlyPlanner />} />
            <Route path="/wl/daily-assignment" element={<DailyAssignment />} />
            <Route path="/wl/global-calendar" element={<GlobalCalendar />} />
            <Route path="/wl/employees" element={<WLEmployees />} />
            <Route path="/wl/employees/add" element={<AddEmployeePage />} />
            <Route path="/wl/employees/:id" element={<EmployeeProfile />} />
            <Route path="/matching" element={<MatchingDashboard />} />
            {/* ผู้สมัคร = คนของเราแยกถังบนบอร์ด (หน้า CandidatesPage เดิมพักไว้ — ตาราง candidates ภายในแทบไม่ถูกใช้) */}
            <Route path="/matching/candidates" element={<OurPeoplePage />} />
            <Route path="/matching/candidates/add" element={<AddCandidatePage />} />
            <Route path="/matching/candidates/:id" element={<CandidateProfile />} />
            <Route path="/matching/match" element={<MatchingPage />} />
            <Route path="/matching/pre-check" element={<PreCheckPage />} />
            {/* 🔴 หน้า "คำขอโพสหางานใหม่" ถอด 27 ก.ย. 2569 — เจ้าของเลือก "เอาแค่ปุ่ม" (ปุ่มส่ง
                Content/Scraping ในจับคู่งานยังอยู่) · ลิงก์/บุ๊กมาร์กเก่าพาไปกล่องงาน ที่ทีม Online ทำงานจริง */}
            <Route path="/matching/job-postings" element={<Navigate to="/jobs/board" replace />} />
            {/* งานสรรหา (RM) — หน้าเดียว 3 แท็บ · แท็บอยู่ใน ?tab= เพื่อให้แชร์ลิงก์ได้ */}
            <Route path="/recruit/rm" element={<RecruitRmPage />} />
            <Route path="/recruit/channels" element={<RecruitChannelsPage />} />
            <Route path="/matching/reservations" element={<ReservationsPage />} />
            {/* "โทรของฉัน" ย้ายเป็น section บนหน้าหลักแล้ว (เจ้าของสั่ง 13 ส.ค. 2569:
                14 ส.ค. ย้ายไปหน้า Matching) — สอง path เดิม redirect เข้าหน้า Matching
                กัน bookmark เก่าพัง · call-team ไม่มีบอร์ดทีมแล้ว (เอาออก 14 ส.ค.) */}
            <Route path="/matching/my-calls" element={<Navigate to="/matching/match" replace />} />
            {/* การติดต่อของเลนคัดสรร (16 ส.ค. 2569) — เลนสรรหาอยู่บนบอร์ดรับสมัคร ไม่ปนกัน */}
            <Route path="/matching/contact" element={<SelectionContactPage />} />
            <Route path="/matching/call-team" element={<Navigate to="/matching/match" replace />} />
            <Route path="/matching/our-people" element={<OurPeoplePage />} />
            <Route path="/follow" element={<FollowPage />} />
            {/* "ดูแลหลังเริ่มงาน" (Phase 7.3) — คนเข้ามาจากกล่อง "โทรครบแล้ว" บนหน้า Follow */}
            <Route path="/aftercare" element={<AftercarePage />} />
            <Route path="/value" element={<ValueCasePage />} />
            <Route path="/jobs" element={<Navigate to="/jobs/list" replace />} />
            <Route path="/jobs/overview" element={<JobDashboard />} />
            <Route path="/jobs/list" element={<JobListPage />} />
            <Route path="/jobs/board" element={<StaffJobBoardPage />} />
            {/* 🔴 งานประกาศ/ลิงก์สมัคร = **ของกล่องงาน** (เจ้าของสั่ง 27 ส.ค. 2569)
                path จึงอยู่ใต้ /jobs/board ไม่ใช่ /jobs/siamraj — เหตุผลเต็มอยู่หัวไฟล์หน้านั้น */}
            <Route path="/jobs/board/:id/posting" element={<BoardPostingPage />} />
            {/* ลิงก์เก่าที่ชี้ไปแท็บของใบขอ — ส่งต่อมาที่หน้าฝั่งกล่องงาน ไม่ให้ 404 */}
            <Route
              path="/jobs/siamraj/:id/posting"
              element={<LegacyPostingRedirect />}
            />
            <Route path="/jobs/add" element={<Navigate to="/jobs/list" replace />} />
            <Route path="/jobs/siamraj/:id" element={<SiamrajUnitRequestDetailPage />} />
            <Route path="/jobs/siamraj/:id/applicants" element={<UnitRequestTabPage tab="applicants" />} />
            <Route path="/jobs/siamraj/:id/ai-match" element={<UnitRequestTabPage tab="ai-match" />} />
            <Route path="/jobs/siamraj/:id/contact" element={<UnitRequestTabPage tab="contact" />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/dashboard" element={<SupervisorDashboard />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="/account/change-password" element={<ChangePasswordPage />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </PageErrorBoundary>
        </RequireRole>
      </AppLayout>
    </RequireDepartment>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RolePermissionsProvider>
        <BrandingProvider>
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <Suspense fallback={<PageLoadingFallback />}>
                <Routes>
                  <Route
                    path="/apply"
                    element={
                      <PublicApplyLayout>
                        <PublicJobBoardPage />
                      </PublicApplyLayout>
                    }
                  />
                  <Route
                    path="/apply/p/:code"
                    element={
                      <PublicApplyLayout>
                        <PublicPostingApplyPage />
                      </PublicApplyLayout>
                    }
                  />
                  {/* คำขอใช้สิทธิ์ข้อมูลส่วนบุคคล — ผู้สมัครยื่นเอง ไม่ต้องล็อกอิน (18 ต.ค. 2569) */}
                  <Route
                    path="/privacy-request"
                    element={
                      <PublicApplyLayout>
                        <PrivacyRequestPage />
                      </PublicApplyLayout>
                    }
                  />
                  <Route path="/s/:code" element={<ShortLinkRedirectPage />} />
                  <Route path="/apply/driver" element={<Navigate to="/apply?pos=ขับรถ" replace />} />
                  <Route path="/careers" element={<Navigate to="/apply" replace />} />
                  <Route path="/mapwork" element={<Navigate to="/apply" replace />} />
                  <Route path="/auth/magic-link" element={<MagicLinkVerifyPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
      </BrandingProvider>
      </RolePermissionsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
