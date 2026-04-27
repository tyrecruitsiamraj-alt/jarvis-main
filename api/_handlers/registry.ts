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
import auditLogsHandler from './audit-logs.js';
import loginHandler from './auth/login.js';
import devRoleHandler from './auth/dev-role.js';
import logoutHandler from './auth/logout.js';
import meHandler from './auth/me.js';
import registerHandler from './auth/register.js';
import forgotPasswordHandler from './auth/forgot-password.js';
import changePasswordHandler from './auth/change-password.js';
import publicJobsHandler from './public/jobs.js';
import brandingHandler from './branding.js';

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
  '/api/audit-logs': auditLogsHandler as ApiHandler,
  '/api/employees': employeesHandler as ApiHandler,
  '/api/geocode': geocodeHandler as ApiHandler,
  '/api/branding': brandingHandler as ApiHandler,
  '/api/public/jobs': publicJobsHandler as ApiHandler,
  '/api/auth/login': loginHandler as ApiHandler,
  '/api/auth/dev-role': devRoleHandler as ApiHandler,
  '/api/auth/logout': logoutHandler as ApiHandler,
  '/api/auth/me': meHandler as ApiHandler,
  '/api/auth/register': registerHandler as ApiHandler,
  '/api/auth/forgot-password': forgotPasswordHandler as ApiHandler,
  '/api/auth/change-password': changePasswordHandler as ApiHandler,
};
