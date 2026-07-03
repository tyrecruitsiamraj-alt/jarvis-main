import type { ApiReq, ApiRes } from '../_lib/http.js';
import candidatesHandler from './candidates.js';
import employeesHandler from './employees.js';
import geocodeHandler from './geocode.js';
import healthHandler from './health.js';
import jobsHandler from './jobs.js';
import jobStaffHandler from './job-staff.js';
import jobAssignmentsHandler from './job-assignments.js';
import workCalendarHandler from './work-calendar.js';
import clientsHandler from './clients.js';
import candidateInterviewsHandler from './candidate-interviews.js';
import candidateWorkHistoryHandler from './candidate-work-history.js';
import trainingRecordsHandler from './training-records.js';
import appUsersHandler from './app-users.js';
import rolePermissionsHandler from './role-permissions.js';
import auditLogsHandler from './audit-logs.js';
import loginHandler from './auth/login.js';
import devRoleHandler from './auth/dev-role.js';
import logoutHandler from './auth/logout.js';
import meHandler from './auth/me.js';
import registerHandler from './auth/register.js';
import forgotPasswordHandler from './auth/forgot-password.js';
import resetPasswordHandler from './auth/reset-password.js';
import changePasswordHandler from './auth/change-password.js';
import authConfigHandler from './auth/config.js';
import magicLinkHandler from './auth/magic-link.js';
import magicLinkVerifyHandler from './auth/magic-link-verify.js';
import azureAdStartHandler from './auth/azure-ad-start.js';
import azureAdCallbackHandler from './auth/azure-ad-callback.js';
import publicJobsHandler from './public/jobs.js';
import brandingHandler from './branding.js';
import driverCareHandler from './driver-care.js';
import driverCareRecalculateHandler from './driver-care-recalculate.js';
import siamrajUnitRequestsHandler from './siamraj-unit-requests.js';
import siamrajUnitAssignmentsHandler from './siamraj-unit-assignments.js';
import siamrajUnitNotesHandler from './siamraj-unit-notes.js';
import outboundIpHandler from './diagnostics/outbound-ip.js';

export type ApiHandler = (req: ApiReq, res: ApiRes) => Promise<void>;

/** Single route table for local Node server and Vercel catch-all. */
export const apiRoutes: Record<string, ApiHandler> = {
  '/api/health': healthHandler as ApiHandler,
  '/api/candidates': candidatesHandler as ApiHandler,
  '/api/jobs': jobsHandler as ApiHandler,
  '/api/job-staff': jobStaffHandler as ApiHandler,
  '/api/job-assignments': jobAssignmentsHandler as ApiHandler,
  '/api/work-calendar': workCalendarHandler as ApiHandler,
  '/api/clients': clientsHandler as ApiHandler,
  '/api/candidate-interviews': candidateInterviewsHandler as ApiHandler,
  '/api/candidate-work-history': candidateWorkHistoryHandler as ApiHandler,
  '/api/training-records': trainingRecordsHandler as ApiHandler,
  '/api/app-users': appUsersHandler as ApiHandler,
  '/api/role-permissions': rolePermissionsHandler as ApiHandler,
  '/api/audit-logs': auditLogsHandler as ApiHandler,
  '/api/employees': employeesHandler as ApiHandler,
  '/api/geocode': geocodeHandler as ApiHandler,
  '/api/driver-care': driverCareHandler as ApiHandler,
  '/api/driver-care/recalculate': driverCareRecalculateHandler as ApiHandler,
  '/api/siamraj/unit-requests': siamrajUnitRequestsHandler as ApiHandler,
  '/api/siamraj/unit-assignments': siamrajUnitAssignmentsHandler as ApiHandler,
  '/api/siamraj/unit-notes': siamrajUnitNotesHandler as ApiHandler,
  '/api/diagnostics/outbound-ip': outboundIpHandler as ApiHandler,
  '/api/branding': brandingHandler as ApiHandler,
  '/api/public/jobs': publicJobsHandler as ApiHandler,
  '/api/auth/login': loginHandler as ApiHandler,
  '/api/auth/dev-role': devRoleHandler as ApiHandler,
  '/api/auth/logout': logoutHandler as ApiHandler,
  '/api/auth/me': meHandler as ApiHandler,
  '/api/auth/register': registerHandler as ApiHandler,
  '/api/auth/forgot-password': forgotPasswordHandler as ApiHandler,
  '/api/auth/reset-password': resetPasswordHandler as ApiHandler,
  '/api/auth/change-password': changePasswordHandler as ApiHandler,
  '/api/auth/config': authConfigHandler as ApiHandler,
  '/api/auth/magic-link': magicLinkHandler as ApiHandler,
  '/api/auth/magic-link-verify': magicLinkVerifyHandler as ApiHandler,
  '/api/auth/azure-ad/start': azureAdStartHandler as ApiHandler,
  '/api/auth/azure-ad/callback': azureAdCallbackHandler as ApiHandler,
  /** NextAuth-compatible path — ใช้ได้ถ้า Azure Portal ลงทะเบียน path นี้แทน */
  '/api/auth/callback/azure-ad': azureAdCallbackHandler as ApiHandler,
};
