import '../server/bootstrap-env.js';
import { resolveInterviewAdminPhone } from '../api/_lib/interviewAdminPhone.js';

async function main() {
  console.log('LUMOS_ADMIN_PHONE_OVERRIDE (จาก .env):', process.env.LUMOS_ADMIN_PHONE_OVERRIDE);
  console.log('resolve(DS5812003) with override on ->', await resolveInterviewAdminPhone('DS5812003'));

  delete process.env.LUMOS_ADMIN_PHONE_OVERRIDE;
  console.log(
    'resolve(unknown request_no) override off ->',
    await resolveInterviewAdminPhone('NO-SUCH-REQUEST-NO-XYZ'),
  );
  console.log('resolve(null) override off ->', await resolveInterviewAdminPhone(null));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
