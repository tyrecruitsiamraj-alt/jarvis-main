import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import PublicApplyLayout from "@/components/layout/PublicApplyLayout";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RolePermissionsProvider } from "@/contexts/RolePermissionsContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import RequireDepartment from "@/components/auth/RequireDepartment";
import RequireRole from "@/components/auth/RequireRole";

/** โหลดทีละหน้าเมื่อถูกเรียกใช้ (code-split) — ลดขนาด JS ก้อนแรกให้เปิดแอปเร็วขึ้น */
const PublicJobBoardPage = lazy(() => import("@/pages/public/PublicJobBoardPage"));
const ShortLinkRedirectPage = lazy(() => import("@/pages/public/ShortLinkRedirectPage"));
const MagicLinkVerifyPage = lazy(() => import("@/pages/MagicLinkVerifyPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const WLDashboard = lazy(() => import("@/pages/wl/WLDashboard"));
const MonthlyPlanner = lazy(() => import("@/pages/wl/MonthlyPlanner"));
const DailyAssignment = lazy(() => import("@/pages/wl/DailyAssignment"));
const GlobalCalendar = lazy(() => import("@/pages/wl/GlobalCalendar"));
const WLEmployees = lazy(() => import("@/pages/wl/WLEmployees"));
const EmployeeProfile = lazy(() => import("@/pages/wl/EmployeeProfile"));
const AddEmployeePage = lazy(() => import("@/pages/wl/AddEmployeePage"));
const MatchingDashboard = lazy(() => import("@/pages/matching/MatchingDashboard"));
const CandidatesPage = lazy(() => import("@/pages/matching/CandidatesPage"));
const CandidateProfile = lazy(() => import("@/pages/matching/CandidateProfile"));
const AddCandidatePage = lazy(() => import("@/pages/matching/AddCandidatePage"));
const MatchingPage = lazy(() => import("@/pages/matching/MatchingPage"));
const PreCheckPage = lazy(() => import("@/pages/matching/PreCheckPage"));
const JobPostingsPage = lazy(() => import("@/pages/matching/JobPostingsPage"));
const ReservationsPage = lazy(() => import("@/pages/matching/ReservationsPage"));
const JobDashboard = lazy(() => import("@/pages/jobs/JobDashboard"));
const JobListPage = lazy(() => import("@/pages/jobs/JobListPage"));
const StaffJobBoardPage = lazy(() => import("@/pages/jobs/StaffJobBoardPage"));
const JobDetailPage = lazy(() => import("@/pages/jobs/JobDetailPage"));
const SiamrajUnitRequestDetailPage = lazy(() => import("@/pages/jobs/SiamrajUnitRequestDetailPage"));
const DriverCareOverview = lazy(() => import("@/pages/driver-care/DriverCareOverview"));
const DriverRiskList = lazy(() => import("@/pages/driver-care/DriverRiskList"));
const DriverActionTracking = lazy(() => import("@/pages/driver-care/DriverActionTracking"));
const DriverCareResources = lazy(() => import("@/pages/driver-care/DriverCareResources"));
const SupervisorDashboard = lazy(() => import("@/pages/dashboard/SupervisorDashboard"));
const AdminSettings = lazy(() => import("@/pages/settings/AdminSettings"));
const ChangePasswordPage = lazy(() => import("@/pages/ChangePasswordPage"));
const FeedbackPage = lazy(() => import("@/pages/feedback/FeedbackPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RoleHubPage = lazy(() => import("./pages/RoleHubPage"));

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
  if (bootstrapping) {
    return (
      <div className="jarvis-warm-bg min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        <div className="jarvis-frost px-8 py-6 text-center">
          <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-blue-400/40 border-t-blue-500 animate-spin" aria-hidden />
          กำลังโหลด session…
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <LoginPage />;
  }
  return (
    <RequireDepartment>
      <AppLayout>
        <RequireRole>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
            <Route path="/" element={<HomePage />} />
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
            <Route path="/matching/candidates" element={<CandidatesPage />} />
            <Route path="/matching/candidates/add" element={<AddCandidatePage />} />
            <Route path="/matching/candidates/:id" element={<CandidateProfile />} />
            <Route path="/matching/match" element={<MatchingPage />} />
            <Route path="/matching/pre-check" element={<PreCheckPage />} />
            <Route path="/matching/job-postings" element={<JobPostingsPage />} />
            <Route path="/matching/reservations" element={<ReservationsPage />} />
            <Route path="/driver-care" element={<DriverCareOverview />} />
            <Route path="/driver-care/risk-list" element={<DriverRiskList />} />
            <Route path="/driver-care/actions" element={<DriverActionTracking />} />
            <Route path="/driver-care/resources" element={<DriverCareResources />} />
            <Route path="/jobs" element={<Navigate to="/jobs/list" replace />} />
            <Route path="/jobs/overview" element={<JobDashboard />} />
            <Route path="/jobs/list" element={<JobListPage />} />
            <Route path="/jobs/board" element={<StaffJobBoardPage />} />
            <Route path="/jobs/add" element={<Navigate to="/jobs/list" replace />} />
            <Route path="/jobs/siamraj/:id" element={<SiamrajUnitRequestDetailPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/dashboard" element={<SupervisorDashboard />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="/account/change-password" element={<ChangePasswordPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
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
