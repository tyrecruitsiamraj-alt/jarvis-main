import { Employee, Candidate, JobRequest, WorkCalendarEntry, ClientWorkplace, CandidateInterview, CandidateWorkHistory, JobAssignment, AuditLog, TrainingRecord, User } from '@/types';

export const mockUsers: User[] = [
  { id: 'u1', username: 'admin', full_name: 'สมชาย แอดมิน', email: 'admin@jarvis.co', role: 'admin', is_active: true, created_at: '2024-01-01' },
  { id: 'u2', username: 'supervisor1', full_name: 'สมหญิง หัวหน้า', email: 'sup@jarvis.co', role: 'supervisor', is_active: true, created_at: '2024-01-01' },
  { id: 'u3', username: 'staff1', full_name: 'สมศักดิ์ สตาฟ', email: 'staff@jarvis.co', role: 'staff', is_active: true, created_at: '2024-01-01' },
];

export const mockEmployees: Employee[] = [
  { id: 'e1', employee_code: 'EMP-001', first_name: 'สมชาย', last_name: 'ใจดี', nickname: 'ชาย', phone: '081-111-1111', status: 'active', position: 'พนักงานขับรถ', join_date: '2023-06-01', reliability_score: 92, utilization_rate: 85, total_days_worked: 220, total_income: 264000, total_cost: 176000, total_issues: 3, created_at: '2023-06-01' },
  { id: 'e2', employee_code: 'EMP-002', first_name: 'สมหญิง', last_name: 'รักษ์ดี', nickname: 'หญิง', phone: '081-222-2222', status: 'active', position: 'พนักงานต้อนรับ', join_date: '2023-08-15', reliability_score: 88, utilization_rate: 78, total_days_worked: 180, total_income: 216000, total_cost: 144000, total_issues: 5, created_at: '2023-08-15' },
  { id: 'e3', employee_code: 'EMP-003', first_name: 'สมศักดิ์', last_name: 'พลศรี', nickname: 'ศักดิ์', phone: '081-333-3333', status: 'active', position: 'พนักงานขับรถ', join_date: '2024-01-10', reliability_score: 75, utilization_rate: 65, total_days_worked: 120, total_income: 144000, total_cost: 96000, total_issues: 8, created_at: '2024-01-10' },
  { id: 'e4', employee_code: 'EMP-004', first_name: 'วิไล', last_name: 'สวยงาม', nickname: 'ไล', phone: '081-444-4444', status: 'active', position: 'Valet Parking', join_date: '2023-12-01', reliability_score: 95, utilization_rate: 90, total_days_worked: 250, total_income: 300000, total_cost: 200000, total_issues: 1, created_at: '2023-12-01' },
  { id: 'e5', employee_code: 'EMP-005', first_name: 'ประเสริฐ', last_name: 'ศรีสมบูรณ์', nickname: 'เสริฐ', phone: '081-555-5555', status: 'inactive', position: 'พนักงานขับรถ', join_date: '2023-03-01', reliability_score: 45, utilization_rate: 30, total_days_worked: 60, total_income: 72000, total_cost: 48000, total_issues: 15, created_at: '2023-03-01' },
  { id: 'e6', employee_code: 'EMP-006', first_name: 'อรุณ', last_name: 'แสงจันทร์', nickname: 'รุณ', phone: '081-666-6666', status: 'active', position: 'พนักงานต้อนรับ', join_date: '2024-02-01', reliability_score: 82, utilization_rate: 70, total_days_worked: 100, total_income: 120000, total_cost: 80000, total_issues: 4, created_at: '2024-02-01' },
];

export const mockClients: ClientWorkplace[] = [
  { id: 'c1', name: 'ธนาคารกรุงเทพ สาขาสีลม', address: 'ถ.สีลม กรุงเทพฯ', lat: 13.7262, lng: 100.5233, contact_person: 'คุณพิมพ์', contact_phone: '02-111-1111', default_income: 1200, default_cost: 800, default_shift: '08:00-17:00', job_type: 'thai_executive', job_category: 'bank', is_active: true, created_at: '2024-01-01' },
  { id: 'c2', name: 'บริษัท SCG สำนักงานใหญ่', address: 'ถ.ปูนซิเมนต์ไทย บางซื่อ', lat: 13.8205, lng: 100.5287, contact_person: 'คุณสมบัติ', contact_phone: '02-222-2222', default_income: 1500, default_cost: 1000, default_shift: '07:00-16:00', job_type: 'thai_executive', job_category: 'private', is_active: true, created_at: '2024-01-01' },
  { id: 'c3', name: 'สถานทูตญี่ปุ่น', address: 'ถ.วิทยุ กรุงเทพฯ', lat: 13.7380, lng: 100.5477, contact_person: 'Mr. Tanaka', contact_phone: '02-333-3333', default_income: 2000, default_cost: 1300, default_shift: '08:30-17:30', job_type: 'foreign_executive', job_category: 'government', is_active: true, created_at: '2024-01-01' },
  { id: 'c4', name: 'โรงแรมแมนดาริน โอเรียนเต็ล', address: 'ถ.เจริญกรุง กรุงเทพฯ', lat: 13.7234, lng: 100.5148, contact_person: 'คุณแมน', contact_phone: '02-444-4444', default_income: 1800, default_cost: 1200, default_shift: '06:00-15:00', job_type: 'valet_parking', job_category: 'private', is_active: true, created_at: '2024-01-01' },
];

const today = new Date();
const formatDate = (d: Date) => d.toISOString().split('T')[0];
const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return formatDate(d); };
const daysFromNow = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return formatDate(d); };

export const mockWorkCalendar: WorkCalendarEntry[] = [
  { id: 'wc1', employee_id: 'e1', work_date: formatDate(today), client_id: 'c1', client_name: 'ธนาคารกรุงเทพ สาขาสีลม', shift: '08:00-17:00', status: 'normal_work', income: 1200, cost: 800, created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: 'wc2', employee_id: 'e2', work_date: formatDate(today), client_id: 'c2', client_name: 'บริษัท SCG สำนักงานใหญ่', shift: '07:00-16:00', status: 'normal_work', income: 1500, cost: 1000, created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: 'wc3', employee_id: 'e3', work_date: formatDate(today), client_id: 'c3', client_name: 'สถานทูตญี่ปุ่น', shift: '08:30-17:30', status: 'late', income: 2000, cost: 1300, issue_reason: 'รถติด', created_at: daysAgo(1), updated_at: formatDate(today) },
  { id: 'wc4', employee_id: 'e4', work_date: formatDate(today), client_id: 'c4', client_name: 'โรงแรมแมนดาริน โอเรียนเต็ล', shift: '06:00-15:00', status: 'normal_work', income: 1800, cost: 1200, created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: 'wc5', employee_id: 'e1', work_date: daysAgo(1), client_id: 'c1', client_name: 'ธนาคารกรุงเทพ สาขาสีลม', shift: '08:00-17:00', status: 'normal_work', income: 1200, cost: 800, created_at: daysAgo(2), updated_at: daysAgo(2) },
  { id: 'wc6', employee_id: 'e2', work_date: daysAgo(1), client_id: 'c2', client_name: 'บริษัท SCG สำนักงานใหญ่', shift: '07:00-16:00', status: 'cancel_by_employee', income: 0, cost: 0, issue_reason: 'ป่วย', created_at: daysAgo(2), updated_at: daysAgo(1) },
  { id: 'wc7', employee_id: 'e5', work_date: daysAgo(2), client_id: 'c3', client_name: 'สถานทูตญี่ปุ่น', shift: '08:30-17:30', status: 'no_show', income: 0, cost: 0, created_at: daysAgo(3), updated_at: daysAgo(2) },
  { id: 'wc8', employee_id: 'e1', work_date: daysFromNow(1), client_id: 'c2', client_name: 'บริษัท SCG สำนักงานใหญ่', shift: '07:00-16:00', status: 'normal_work', income: 1500, cost: 1000, created_at: formatDate(today), updated_at: formatDate(today) },
  { id: 'wc9', employee_id: 'e4', work_date: daysFromNow(1), client_id: 'c4', client_name: 'โรงแรมแมนดาริน โอเรียนเต็ล', shift: '06:00-15:00', status: 'normal_work', income: 1800, cost: 1200, created_at: formatDate(today), updated_at: formatDate(today) },
  { id: 'wc10', employee_id: 'e6', work_date: formatDate(today), status: 'available', created_at: daysAgo(1), updated_at: daysAgo(1) },
];

export const mockJobRequests: JobRequest[] = [
  // Urgent jobs
  { id: 'j1', unit_name: 'ธนาคารกรุงเทพ สาขาสีลม', request_date: daysAgo(10), required_date: daysAgo(3), urgency: 'urgent', total_income: 36000, location_address: 'ถ.สีลม กรุงเทพฯ', lat: 13.7262, lng: 100.5233, job_type: 'thai_executive', job_category: 'bank', recruiter_name: 'สมหญิง', screener_name: 'สมชาย', penalty_per_day: 500, days_without_worker: 2, total_penalty: 1000, status: 'in_progress', created_at: daysAgo(10) },
  { id: 'j3', unit_name: 'สถานทูตญี่ปุ่น', request_date: daysAgo(5), required_date: daysAgo(1), urgency: 'urgent', total_income: 60000, location_address: 'ถ.วิทยุ กรุงเทพฯ', lat: 13.7380, lng: 100.5477, job_type: 'foreign_executive', job_category: 'government', recruiter_name: 'อรุณ', screener_name: 'สมชาย', penalty_per_day: 1000, days_without_worker: 1, total_penalty: 1000, status: 'closed', closed_date: daysAgo(2), created_at: daysAgo(5) },
  { id: 'j5', unit_name: 'ธนาคารกสิกรไทย สาขาอโศก', request_date: daysAgo(3), required_date: daysAgo(1), urgency: 'urgent', total_income: 38000, location_address: 'ถ.อโศก กรุงเทพฯ', lat: 13.7370, lng: 100.5600, job_type: 'thai_executive', job_category: 'bank', recruiter_name: 'สมหญิง', screener_name: 'สมชาย', penalty_per_day: 500, days_without_worker: 1, total_penalty: 500, status: 'open', created_at: daysAgo(3) },
  { id: 'j7', unit_name: 'กระทรวงการคลัง', request_date: daysAgo(8), required_date: daysAgo(2), urgency: 'urgent', total_income: 42000, location_address: 'ถ.พระราม 6 กรุงเทพฯ', lat: 13.7600, lng: 100.5300, job_type: 'thai_executive', job_category: 'government', recruiter_name: 'อรุณ', screener_name: 'วิไล', penalty_per_day: 700, days_without_worker: 3, total_penalty: 2100, status: 'in_progress', created_at: daysAgo(8) },
  { id: 'j9', unit_name: 'สถานทูตเยอรมัน', request_date: daysAgo(6), required_date: daysAgo(2), urgency: 'urgent', total_income: 55000, location_address: 'ถ.สาทร กรุงเทพฯ', lat: 13.7220, lng: 100.5280, job_type: 'foreign_executive', job_category: 'government', recruiter_name: 'สมหญิง', screener_name: 'สมชาย', penalty_per_day: 900, days_without_worker: 2, total_penalty: 1800, status: 'closed', closed_date: daysAgo(1), created_at: daysAgo(6) },
  { id: 'j11', unit_name: 'ธนาคารไทยพาณิชย์ สาขาสยาม', request_date: daysAgo(2), required_date: daysAgo(0), urgency: 'urgent', total_income: 35000, location_address: 'สยามสแควร์ กรุงเทพฯ', lat: 13.7450, lng: 100.5340, job_type: 'central', job_category: 'bank', recruiter_name: 'อรุณ', screener_name: 'วิไล', penalty_per_day: 400, days_without_worker: 0, total_penalty: 0, status: 'open', created_at: daysAgo(2) },
  // Advance jobs
  { id: 'j2', unit_name: 'บริษัท SCG สำนักงานใหญ่', request_date: daysAgo(30), required_date: daysFromNow(15), urgency: 'advance', total_income: 45000, location_address: 'ถ.ปูนซิเมนต์ไทย บางซื่อ', lat: 13.8205, lng: 100.5287, job_type: 'thai_executive', job_category: 'private', recruiter_name: 'สมหญิง', screener_name: 'วิไล', penalty_per_day: 800, days_without_worker: 0, total_penalty: 0, status: 'open', created_at: daysAgo(30) },
  { id: 'j4', unit_name: 'โรงแรมแมนดาริน โอเรียนเต็ล', request_date: daysAgo(15), required_date: daysFromNow(5), urgency: 'advance', total_income: 54000, location_address: 'ถ.เจริญกรุง กรุงเทพฯ', lat: 13.7234, lng: 100.5148, job_type: 'valet_parking', job_category: 'private', recruiter_name: 'สมหญิง', screener_name: 'วิไล', penalty_per_day: 600, days_without_worker: 0, total_penalty: 0, status: 'in_progress', created_at: daysAgo(15) },
  { id: 'j6', unit_name: 'บริษัท ปตท. สำนักงานใหญ่', request_date: daysAgo(40), required_date: daysFromNow(20), urgency: 'advance', total_income: 48000, location_address: 'ถ.วิภาวดีรังสิต กรุงเทพฯ', lat: 13.8100, lng: 100.5600, job_type: 'thai_executive', job_category: 'private', recruiter_name: 'อรุณ', screener_name: 'สมชาย', penalty_per_day: 700, days_without_worker: 0, total_penalty: 0, status: 'open', created_at: daysAgo(40) },
  { id: 'j8', unit_name: 'โรงแรมเซ็นทารา แกรนด์', request_date: daysAgo(20), required_date: daysFromNow(10), urgency: 'advance', total_income: 50000, location_address: 'ถ.พระราม 1 กรุงเทพฯ', lat: 13.7460, lng: 100.5390, job_type: 'valet_parking', job_category: 'private', recruiter_name: 'สมหญิง', screener_name: 'วิไล', penalty_per_day: 500, days_without_worker: 0, total_penalty: 0, status: 'closed', closed_date: daysAgo(5), created_at: daysAgo(20) },
  { id: 'j10', unit_name: 'กรมสรรพากร', request_date: daysAgo(35), required_date: daysFromNow(25), urgency: 'advance', total_income: 40000, location_address: 'ถ.พหลโยธิน กรุงเทพฯ', lat: 13.7950, lng: 100.5500, job_type: 'central', job_category: 'government', recruiter_name: 'อรุณ', screener_name: 'สมชาย', penalty_per_day: 600, days_without_worker: 0, total_penalty: 0, status: 'in_progress', created_at: daysAgo(35) },
  { id: 'j12', unit_name: 'บริษัท AIS สำนักงานใหญ่', request_date: daysAgo(25), required_date: daysFromNow(8), urgency: 'advance', total_income: 44000, location_address: 'ถ.พหลโยธิน กรุงเทพฯ', lat: 13.7980, lng: 100.5520, job_type: 'thai_executive', job_category: 'private', recruiter_name: 'สมหญิง', screener_name: 'สมชาย', penalty_per_day: 650, days_without_worker: 0, total_penalty: 0, status: 'closed', closed_date: daysAgo(10), created_at: daysAgo(25) },
  { id: 'j13', unit_name: 'สถานทูตอังกฤษ', request_date: daysAgo(12), required_date: daysFromNow(3), urgency: 'advance', total_income: 58000, location_address: 'ถ.วิทยุ กรุงเทพฯ', lat: 13.7390, lng: 100.5470, job_type: 'foreign_executive', job_category: 'government', recruiter_name: 'อรุณ', screener_name: 'วิไล', penalty_per_day: 1000, days_without_worker: 0, total_penalty: 0, status: 'open', created_at: daysAgo(12) },
  { id: 'j14', unit_name: 'ธนาคารกรุงศรี สาขาพระราม 3', request_date: daysAgo(18), required_date: daysFromNow(12), urgency: 'advance', total_income: 37000, location_address: 'ถ.พระราม 3 กรุงเทพฯ', lat: 13.6950, lng: 100.5350, job_type: 'central', job_category: 'bank', recruiter_name: 'สมหญิง', screener_name: 'สมชาย', penalty_per_day: 450, days_without_worker: 0, total_penalty: 0, status: 'in_progress', created_at: daysAgo(18) },
];

export const mockCandidates: Candidate[] = [
  { id: 'cd1', title_prefix: 'นาย', first_name: 'ธนวัฒน์', last_name: 'สมบูรณ์', phone: '089-111-1111', age: 28, gender: 'male', drinking: 'no', smoking: 'no', tattoo: 'no', van_driving: 'passed', sedan_driving: 'passed', address: 'เขตบางนา กรุงเทพฯ', lat: 13.6693, lng: 100.6044, application_date: daysAgo(20), first_contact_date: daysAgo(18), status: 'inprocess', responsible_recruiter: 'สมหญิง', risk_percentage: 15, created_at: daysAgo(20) },
  { id: 'cd2', title_prefix: 'นางสาว', first_name: 'สุภาพร', last_name: 'แก้วใส', phone: '089-222-2222', age: 32, gender: 'female', drinking: 'no', smoking: 'no', tattoo: 'no', van_driving: 'not_tested', sedan_driving: 'passed', address: 'เขตจตุจักร กรุงเทพฯ', lat: 13.8037, lng: 100.5530, application_date: daysAgo(15), first_contact_date: daysAgo(14), status: 'waiting_interview', responsible_recruiter: 'อรุณ', risk_percentage: 10, created_at: daysAgo(15) },
  { id: 'cd3', first_name: 'วิชัย', last_name: 'รุ่งเรือง', phone: '089-333-3333', age: 35, gender: 'male', drinking: 'yes', smoking: 'yes', tattoo: 'yes', van_driving: 'failed', sedan_driving: 'passed', address: 'เขตลาดพร้าว กรุงเทพฯ', lat: 13.8033, lng: 100.6090, application_date: daysAgo(25), status: 'drop', responsible_recruiter: 'สมหญิง', risk_percentage: 65, created_at: daysAgo(25) },
  { id: 'cd4', first_name: 'ปิยะ', last_name: 'ดีเลิศ', phone: '089-444-4444', age: 26, gender: 'male', drinking: 'no', smoking: 'no', tattoo: 'no', van_driving: 'passed', sedan_driving: 'passed', address: 'เขตบางกะปิ กรุงเทพฯ', lat: 13.7649, lng: 100.6469, application_date: daysAgo(10), first_contact_date: daysAgo(9), first_work_date: daysAgo(5), status: 'done', responsible_recruiter: 'อรุณ', risk_percentage: 8, created_at: daysAgo(10) },
  { id: 'cd5', first_name: 'นภาพร', last_name: 'ศรีทอง', phone: '089-555-5555', age: 29, gender: 'female', drinking: 'no', smoking: 'no', tattoo: 'no', van_driving: 'not_tested', sedan_driving: 'not_tested', address: 'เขตหลักสี่ กรุงเทพฯ', lat: 13.8844, lng: 100.5717, application_date: daysAgo(3), status: 'waiting_to_start', responsible_recruiter: 'สมหญิง', risk_percentage: 20, created_at: daysAgo(3) },
  { id: 'cd6', first_name: 'สมพงษ์', last_name: 'ทองคำ', phone: '089-666-6666', age: 40, gender: 'male', drinking: 'yes', smoking: 'no', tattoo: 'no', van_driving: 'passed', sedan_driving: 'passed', address: 'เขตมีนบุรี กรุงเทพฯ', lat: 13.8121, lng: 100.7297, application_date: daysAgo(30), status: 'no_job', responsible_recruiter: 'อรุณ', risk_percentage: 35, created_at: daysAgo(30) },
];

export const mockCandidateInterviews: CandidateInterview[] = [
  { id: 'ci1', candidate_id: 'cd1', interview_date: daysAgo(15), location: 'ธนาคารกรุงเทพ สาขาสีลม', client_name: 'ธนาคารกรุงเทพ', attended: true, result: 'passed' },
  { id: 'ci2', candidate_id: 'cd2', interview_date: daysFromNow(2), location: 'บริษัท SCG สำนักงานใหญ่', client_name: 'SCG', attended: false, result: 'pending' },
  { id: 'ci3', candidate_id: 'cd3', interview_date: daysAgo(20), location: 'สถานทูตญี่ปุ่น', client_name: 'สถานทูตญี่ปุ่น', attended: false },
  { id: 'ci4', candidate_id: 'cd4', interview_date: daysAgo(8), location: 'โรงแรมแมนดาริน', client_name: 'แมนดาริน', attended: true, result: 'passed' },
];

export const mockCandidateWorkHistory: CandidateWorkHistory[] = [
  { id: 'cwh1', candidate_id: 'cd1', client_name: 'ธนาคารกรุงเทพ สาขาสีลม', work_type: 'replacement', start_date: daysAgo(12), end_date: daysAgo(10), status: 'completed' },
  { id: 'cwh2', candidate_id: 'cd4', client_name: 'โรงแรมแมนดาริน', work_type: 'start', start_date: daysAgo(5), status: 'ongoing' },
];

export const mockJobAssignments: JobAssignment[] = [
  { id: 'ja1', job_id: 'j1', candidate_id: 'cd1', candidate_name: 'ธนวัฒน์ สมบูรณ์', assignment_type: 'trial', start_date: daysAgo(5), status: 'passed', trial_days: 3, created_at: daysAgo(5) },
  { id: 'ja2', job_id: 'j1', candidate_id: 'cd4', candidate_name: 'ปิยะ ดีเลิศ', assignment_type: 'start', start_date: daysAgo(3), status: 'started', created_at: daysAgo(3) },
  { id: 'ja3', job_id: 'j4', candidate_id: 'cd5', candidate_name: 'นภาพร ศรีทอง', assignment_type: 'trial', start_date: daysFromNow(2), status: 'sent', trial_days: 0, created_at: formatDate(today) },
];

export const mockTrainingRecords: TrainingRecord[] = [
  { id: 'tr1', employee_id: 'e1', training_name: 'การขับรถปลอดภัย', training_date: '2024-03-15', result: 'passed' },
  { id: 'tr2', employee_id: 'e1', training_name: 'การบริการลูกค้า', training_date: '2024-06-01', result: 'passed' },
  { id: 'tr3', employee_id: 'e2', training_name: 'การบริการลูกค้า', training_date: '2024-04-10', result: 'passed' },
  { id: 'tr4', employee_id: 'e3', training_name: 'การขับรถปลอดภัย', training_date: '2024-05-20', result: 'failed' },
];

export const mockAuditLogs: AuditLog[] = [
  { id: 'al1', user_id: 'u1', user_name: 'สมชาย แอดมิน', action: 'CREATE', entity_type: 'employee', entity_id: 'e6', new_value: 'สร้างพนักงานใหม่: อรุณ แสงจันทร์', timestamp: daysAgo(1) + 'T09:30:00' },
  { id: 'al2', user_id: 'u2', user_name: 'สมหญิง หัวหน้า', action: 'UPDATE', entity_type: 'work_calendar', entity_id: 'wc6', old_value: 'normal_work', new_value: 'cancel_by_employee', timestamp: daysAgo(1) + 'T14:20:00' },
  { id: 'al3', user_id: 'u2', user_name: 'สมหญิง หัวหน้า', action: 'CREATE', entity_type: 'job_request', entity_id: 'j4', new_value: 'สร้างใบขอ: โรงแรมแมนดาริน', timestamp: daysAgo(15) + 'T10:00:00' },
  { id: 'al4', user_id: 'u1', user_name: 'สมชาย แอดมิน', action: 'UPDATE', entity_type: 'candidate', entity_id: 'cd3', old_value: 'inprocess', new_value: 'drop', timestamp: daysAgo(5) + 'T16:45:00' },
];
