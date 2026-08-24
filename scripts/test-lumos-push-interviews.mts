/**
 * ทดสอบยิง pushInterviews ไป Lumos ตรง ๆ เพื่อ debug 401
 *
 *   npx tsx scripts/test-lumos-push-interviews.mts
 *
 * พิมพ์ request/response แบบเต็ม (มาสก์ apiKey) — ต่างจาก pushInterviews() ปกติ
 * ที่ throw แค่ message สั้น ๆ จาก readLumosError() ไม่พอ debug 401
 */
import '../server/bootstrap-env.js';
import { getLumosPushConfig, type LumosPushInterviewRecord } from '../api/_lib/lumosPushClient.js';

const PAYLOAD: LumosPushInterviewRecord[] = [
  {
    client_candidate_id: 'cli-cand-8821',
    client_interview_id: 'cli-int-0042',
    candidate_name: 'สมชาย ใจดี',
    phone: '+66823423516',
    admin_phone: '+66811112222',
    position: 'Senior Backend Engineer',
    scheduled_at: '2026-07-10T10:00:00+07:00',
    priority: 'high',
    questions: [
      'เล่าประสบการณ์การทำงานกับ Python ให้ฟังหน่อยครับ',
      'คาดหวังเงินเดือนเท่าไหร่ครับ',
      'ทำไมถึงอยากร่วมงานกับบริษัทเราครับ',
    ],
    type: 'phone',
    language: 'th',
    tone: 'professional',
    skills: ['Python', 'FastAPI', 'PostgreSQL'],
    experience: [
      {
        company: 'Acme Corp',
        position: 'Backend Engineer',
        period: '2022-2025',
        responsibilities: 'Built and maintained payment services',
        salary: '60000',
        level: 'Senior',
        business_type: 'Fintech',
      },
    ],
    education: [
      {
        institution: 'Chulalongkorn University',
        degree: "Bachelor's",
        faculty: 'Engineering',
        major: 'Computer Engineering',
        gpa: '3.5',
        year_ce: 2020,
      },
    ],
  },
  {
    client_candidate_id: 'cli-cand-9034',
    client_interview_id: 'cli-int-0043',
    candidate_name: 'วิภาวี รักงาน',
    phone: '+66891234567',
    admin_phone: '+66811112222',
    position: 'HR Coordinator',
    scheduled_at: '2026-07-10T14:00:00+07:00',
    priority: 'medium',
    questions: [
      'เล่าประสบการณ์ด้าน HR ให้ฟังหน่อยค่ะ',
      'คาดหวังเงินเดือนเท่าไหร่คะ',
      'สามารถเริ่มงานได้เมื่อไหร่คะ',
    ],
    type: 'phone',
    language: 'th',
    tone: 'friendly',
    skills: ['HR Management', 'Recruitment', 'Payroll'],
    experience: [
      {
        company: 'HR Solutions Co.',
        position: 'HR Officer',
        period: '2021-2024',
        responsibilities: 'Recruitment and employee relations',
        salary: '35000',
        level: 'Junior',
        business_type: 'HR Consulting',
      },
    ],
    education: [
      {
        institution: 'Thammasat University',
        degree: "Bachelor's",
        faculty: 'Commerce and Accountancy',
        major: 'Human Resource Management',
        gpa: '3.2',
        year_ce: 2021,
      },
    ],
  },
];

function mask(secret: string): string {
  if (secret.length <= 10) return '***';
  return `${secret.slice(0, 6)}...${secret.slice(-4)} (len=${secret.length})`;
}

async function main() {
  const config = getLumosPushConfig();
  if (!config) {
    console.error('❌ ยังไม่ได้ตั้งค่า LUMOS_BASE_URL / LUMOS_CONNECTION_ID / LUMOS_PUSH_API_KEY ใน .env');
    process.exit(1);
  }

  const url = `${config.baseUrl}/api/public/v1/webhooks/${encodeURIComponent(config.connectionId)}/interviews`;

  console.log('--- Config ---');
  console.log('baseUrl      :', config.baseUrl);
  console.log('connectionId :', config.connectionId);
  console.log('apiKey       :', mask(config.apiKey));
  console.log('url          :', url);
  console.log();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(PAYLOAD),
  });

  console.log('--- Response ---');
  console.log('status       :', res.status, res.statusText);
  console.log('headers      :');
  for (const [k, v] of res.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }

  const text = await res.text();
  console.log();
  console.log('--- Body ---');
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text || '(empty)');
  }

  if (!res.ok) {
    console.log();
    console.log(`❌ ล้มเหลว: HTTP ${res.status}`);
    if (res.status === 401) {
      console.log('สาเหตุที่เป็นไปได้ (เรียงตามความน่าจะเป็น):');
      console.log('  1. LUMOS_PUSH_API_KEY ผิด / หมดอายุ / ถูก revoke — เช็คใน Lumos dashboard → Settings → Connections → API Keys');
      console.log('  2. ใช้ LUMOS_API_KEY (คนละตัว ใช้ฝั่ง inbound Lumos→Jarvis) แทน LUMOS_PUSH_API_KEY โดยไม่ตั้งใจ');
      console.log('  3. LUMOS_CONNECTION_ID ไม่ตรงกับ key ที่ใช้ (key ผูกกับ connection คนละอันกัน)');
      console.log('  4. LUMOS_BASE_URL ชี้ผิด environment (เช่น staging key แต่ยิงไป prod URL หรือกลับกัน)');
    }
    process.exit(1);
  }

  const data = JSON.parse(text);
  console.log();
  console.log('✅ สำเร็จ — accepted:', data.accepted);
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาดระหว่างรัน:', err);
  process.exit(1);
});
