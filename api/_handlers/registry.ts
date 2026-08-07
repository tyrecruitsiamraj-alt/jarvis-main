import type { ApiReq, ApiRes } from '../_lib/http.js';
// import เพื่อ side-effect: ลงทะเบียนตัวปล่อยชุดส่งงานเข้าคิว (setCallBatchDispatcher)
// วางที่ registry เพราะถูก import ทั้ง server ท้องถิ่นและ Vercel catch-all
import '../_lib/callBatchDispatcher.js';
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
import publicApplyHandler from './public/apply.js';
import publicApplyLinkHandler from './public/apply-link.js';
import recruitChannelsHandler from './recruit-channels.js';
import recruitPostingsHandler from './recruit-postings.js';
import jobApplicationsHandler from './job-applications.js';
import jobApplicationDocumentHandler from './job-application-document.js';
import shortLinksHandler from './short-links.js';
import shortLinksResolveHandler from './short-links-resolve.js';
import requestControlForecastHandler from './request-control-forecast.js';
import matchingListHandler from './matching-list.js';
import brandingHandler from './branding.js';
import matchPriorityWeightsHandler from './match-priority-weights.js';
import workStatusMasterHandler from './work-status-master.js';
import followHandler from './follow.js';
import siamrajUnitRequestsHandler from './siamraj-unit-requests.js';
import siamrajUnitAssignmentsHandler from './siamraj-unit-assignments.js';
import siamrajUnitNotesHandler from './siamraj-unit-notes.js';
import siamrajUnitWorkStatusHandler from './siamraj-unit-work-status.js';
import siamrajOplImportHandler from './siamraj-opl-import.js';
import recruitRegistrationsHandler from './recruit-registrations.js';
import matchingSuggestionsHandler from './matching-suggestions.js';
import matchingParseBranchDemandHandler from './matching-parse-branch-demand.js';
import matchingParseBranchDemandJobHandler from './matching-parse-branch-demand-job.js';
import {
  lumosInterviewCandidatesHandler,
  lumosInterviewResultsHandler,
} from './lumos-interview.js';
import {
  lumosReminderContactsHandler,
  lumosReminderResultsHandler,
} from './lumos-reminder.js';
import lumosPositionsHandler from './lumos-positions.js';
import lumosDispatchHandler from './lumos-dispatch.js';
import matchingCandidateSpecHandler from './matching-candidate-spec.js';
import matchingIrecruitCandidatesHandler from './matching-irecruit-candidates.js';
import matchingBoardCandidatesHandler from './matching-board-candidates.js';
import matchingProposalsHandler from './matching-proposals.js';
import matchingCandidateScreeningHandler from './matching-candidate-screening.js';
import lumosDispatchModeHandler from './lumos-dispatch-mode.js';
import lumosCallFunnelHandler from './lumos-call-funnel.js';
import lumosCallBatchesHandler from './lumos-call-batches.js';
import matchingCallHoldsHandler from './matching-call-holds.js';
import matchingContactHistoryHandler from './matching-contact-history.js';
import notificationsHandler from './notifications.js';
import matchingFlowSummaryHandler from './matching-flow-summary.js';
import matchingJobPostingsHandler from './matching-job-postings.js';
import matchingWorkerStatusHandler from './matching-worker-status.js';

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
  '/api/follow': followHandler as ApiHandler,
  '/api/siamraj/unit-requests': siamrajUnitRequestsHandler as ApiHandler,
  '/api/siamraj/unit-assignments': siamrajUnitAssignmentsHandler as ApiHandler,
  '/api/siamraj/unit-notes': siamrajUnitNotesHandler as ApiHandler,
  '/api/siamraj/unit-work-status': siamrajUnitWorkStatusHandler as ApiHandler,
  '/api/siamraj/opl-import': siamrajOplImportHandler as ApiHandler,
  // Lumos AI Recruit — Positions
  '/api/lumos/positions': lumosPositionsHandler as ApiHandler,
  // ส่งให้ Lumos โทรแบบคนเลือกเอง + อ่านผลการโทร (เรียกจากหน้า Matching ด้วย session ปกติ)
  '/api/lumos/dispatch': lumosDispatchHandler as ApiHandler,
  // AI Interview (Lumos ↔ SO)
  '/api/recruit-registrations': recruitRegistrationsHandler as ApiHandler,
  '/api/matching/suggestions': matchingSuggestionsHandler as ApiHandler,
  '/api/matching/parse-branch-demand': matchingParseBranchDemandHandler as ApiHandler,
  '/api/matching/parse-branch-demand-job': matchingParseBranchDemandJobHandler as ApiHandler,
  // AI Interview / Reminder (Lumos ↔ SO) — Lumos calls in with LUMOS_API_KEY
  '/api/lumos/interview/candidates': lumosInterviewCandidatesHandler as ApiHandler,
  '/api/lumos/interview/results': lumosInterviewResultsHandler as ApiHandler,
  '/api/lumos/reminder/contacts': lumosReminderContactsHandler as ApiHandler,
  '/api/lumos/reminder/results': lumosReminderResultsHandler as ApiHandler,
  '/api/matching/candidate-spec': matchingCandidateSpecHandler as ApiHandler,
  '/api/matching/irecruit-candidates': matchingIrecruitCandidatesHandler as ApiHandler,
  '/api/matching/board-candidates': matchingBoardCandidatesHandler as ApiHandler,
  '/api/matching/proposals': matchingProposalsHandler as ApiHandler,
  '/api/matching/candidate-screening': matchingCandidateScreeningHandler as ApiHandler,
  '/api/lumos/dispatch-mode': lumosDispatchModeHandler as ApiHandler,
  '/api/lumos/call-funnel': lumosCallFunnelHandler as ApiHandler,
  '/api/lumos/call-batches': lumosCallBatchesHandler as ApiHandler,
  '/api/matching/call-holds': matchingCallHoldsHandler as ApiHandler,
  '/api/matching/contact-history': matchingContactHistoryHandler as ApiHandler,
  '/api/notifications': notificationsHandler as ApiHandler,
  '/api/matching/flow-summary': matchingFlowSummaryHandler as ApiHandler,
  '/api/matching/job-postings': matchingJobPostingsHandler as ApiHandler,
  '/api/matching/worker-status': matchingWorkerStatusHandler as ApiHandler,
  '/api/branding': brandingHandler as ApiHandler,
  '/api/match-priority-weights': matchPriorityWeightsHandler as ApiHandler,
  '/api/work-status-master': workStatusMasterHandler as ApiHandler,
  '/api/public/jobs': publicJobsHandler as ApiHandler,
  '/api/public/apply': publicApplyHandler as ApiHandler,
  '/api/public/apply-link': publicApplyLinkHandler as ApiHandler,
  '/api/recruit/channels': recruitChannelsHandler as ApiHandler,
  '/api/recruit/postings': recruitPostingsHandler as ApiHandler,
  '/api/job-applications': jobApplicationsHandler as ApiHandler,
  '/api/job-application-document': jobApplicationDocumentHandler as ApiHandler,
  '/api/short-links': shortLinksHandler as ApiHandler,
  '/api/short-links/resolve': shortLinksResolveHandler as ApiHandler,
  '/api/request-control/demand-forecast': requestControlForecastHandler as ApiHandler,
  '/api/matching/list': matchingListHandler as ApiHandler,
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
