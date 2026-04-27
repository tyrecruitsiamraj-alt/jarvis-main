import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import PublicApplyLayout from "@/components/layout/PublicApplyLayout";
import PublicJobBoardPage from "@/pages/public/PublicJobBoardPage";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import WLDashboard from "@/pages/wl/WLDashboard";
import MonthlyPlanner from "@/pages/wl/MonthlyPlanner";
import DailyAssignment from "@/pages/wl/DailyAssignment";
import GlobalCalendar from "@/pages/wl/GlobalCalendar";
import WLEmployees from "@/pages/wl/WLEmployees";
import EmployeeProfile from "@/pages/wl/EmployeeProfile";
import AddEmployeePage from "@/pages/wl/AddEmployeePage";
import MatchingDashboard from "@/pages/matching/MatchingDashboard";
import CandidatesPage from "@/pages/matching/CandidatesPage";
import CandidateProfile from "@/pages/matching/CandidateProfile";
import AddCandidatePage from "@/pages/matching/AddCandidatePage";
import MatchingPage from "@/pages/matching/MatchingPage";
import PreCheckPage from "@/pages/matching/PreCheckPage";
import JobDashboard from "@/pages/jobs/JobDashboard";
import JobListPage from "@/pages/jobs/JobListPage";
import JobDetailPage from "@/pages/jobs/JobDetailPage";
import AddJobPage from "@/pages/jobs/AddJobPage";
import SupervisorDashboard from "@/pages/dashboard/SupervisorDashboard";
import AdminSettings from "@/pages/settings/AdminSettings";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import NotFound from "./pages/NotFound";
import RoleHubPage from "./pages/RoleHubPage";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { isAuthenticated, bootstrapping } = useAuth();
  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        กำลังโหลด session…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <LoginPage />;
  }
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
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
        <Route path="/jobs" element={<JobDashboard />} />
        <Route path="/jobs/list" element={<JobListPage />} />
        <Route path="/jobs/add" element={<AddJobPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/dashboard" element={<SupervisorDashboard />} />
        <Route path="/settings" element={<AdminSettings />} />
        <Route path="/account/change-password" element={<ChangePasswordPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
              <Routes>
                <Route
                  path="/apply"
                  element={
                    <PublicApplyLayout>
                      <PublicJobBoardPage />
                    </PublicApplyLayout>
                  }
                />
                <Route path="/careers" element={<Navigate to="/apply" replace />} />
                <Route path="/mapwork" element={<Navigate to="/apply" replace />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
      </BrandingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
