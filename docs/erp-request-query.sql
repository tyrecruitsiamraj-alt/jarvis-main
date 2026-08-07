/* ============================================================================
   Jarvis (So Recruit) — query ที่ระบบใช้อ่านใบขอจาก ERP
   ----------------------------------------------------------------------------
   อ่านอย่างเดียว ไม่มี INSERT / UPDATE / DELETE
   ก๊อปทั้งไฟล์วางใน SSMS แล้วกด Execute ได้เลย

   ในไฟล์นี้มี 2 query:
     [1] รายการใบขอที่ยังหาคนไม่ครบ  — ที่ใช้กับหน้ารายการ "หน่วยงาน"
     [2] ใบขอใบเดียว                 — ที่ใช้กับหน้า "ข้อมูลใบขอ"
   ทั้งสองใช้โครงเดียวกัน ต่างกันแค่เงื่อนไขท้าย

   ปรับปรุงล่าสุด 7 ส.ค. 2569
   ============================================================================ */


/* ============================================================================
   [1] รายการใบขอที่ยังหาคนไม่ครบ
   ============================================================================ */

DECLARE @limit    INT         = 200;   -- จำนวนใบสูงสุดต่อครั้ง (ระบบใช้ 200 สูงสุด 2000)
DECLARE @deptFrom VARCHAR(10) = '_';   -- ช่วงรหัสแผนกที่เอา
DECLARE @deptTo   VARCHAR(10) = 'Z';
DECLARE @siteFrom VARCHAR(10) = '_';   -- ช่วงรหัสไซต์ที่เอา
DECLARE @siteTo   VARCHAR(10) = 'Z';

WITH recent AS (

    /* ---- ขั้นที่ 1: เลือกว่า "ใบไหนบ้าง" ที่ยังต้องหาคน ---- */
    SELECT TOP (@limit) A.request_no
    FROM st_request_head A
    INNER JOIN ms_site SS ON A.site_code = SS.site_code
    WHERE
        /* ใบยัง Active และยังไม่ถูก Stop */
        A.status = 'A'
        AND A.is_stop = 'N'
        AND (A.stop_no IS NULL OR RTRIM(A.stop_no) = '')

        /* ยังไม่ได้ติ๊กว่าแจ้งเข้าครบ */
        AND ISNULL(A.is_inform_all, 'N') <> 'Y'

        /* ยังไม่มีใบแจ้งเข้าเลย  หรือ  แจ้งเข้าแล้วแต่ยังไม่ครบจำนวนที่ขอ */
        AND (
            NOT EXISTS (
                SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no
            )
            OR (
                (CASE WHEN ISNULL(A.inform_qty, 0) > 0 THEN A.inform_qty
                      ELSE (SELECT COUNT(*) FROM st_inform_head IH
                            WHERE IH.request_no = A.request_no) END) > 0
                AND
                (CASE WHEN ISNULL(A.inform_qty, 0) > 0 THEN A.inform_qty
                      ELSE (SELECT COUNT(*) FROM st_inform_head IH
                            WHERE IH.request_no = A.request_no) END)
                    < ISNULL(NULLIF(A.request_qty, 0), 1)
            )
        )

        /* จำกัดขอบเขตแผนก / ไซต์ */
        AND SS.department_code BETWEEN @deptFrom AND @deptTo
        AND A.site_code BETWEEN @siteFrom AND @siteTo

        /* ไม่เอาสัญญาเช่ารถอย่างเดียว (ไม่มีงานหาคน) */
        AND RTRIM(SS.contract_type_code) <> 'C'

        /* ---- 2 บรรทัดล่างนี้คือตัวกรอง "เฉพาะใบที่ต้องสรรหาคนจริง" ----
           ถ้าอยากเห็นใบขอทุกประเภท ให้ลบ/คอมเมนต์ 2 ก้อนนี้ทิ้ง            */

        /* เอาเฉพาะประเภทใบขอที่ต้องหาคน ไม่เอาเปิดไซด์ / เพิ่มอัตรา / ทีมเสริม */
        AND RTRIM(A.request_code) IN ('005', '006', '013', '014')

        /* ตัดลักษณะงานที่ชื่อมีคำว่า "ทดแทน" (เป็นงานสรรหาภายใน ไม่ใช่ตำแหน่งลูกค้า) */
        AND NOT EXISTS (
            SELECT 1 FROM hr_ms_job_description_1 jd
            WHERE jd.job_description_code_1 = A.job_description_code_1
              AND jd.job_description_name LIKE N'%ทดแทน%'
        )

    ORDER BY A.request_date DESC
),
base AS (

    /* ---- ขั้นที่ 2: ดึงรายละเอียดของใบที่เลือกไว้ ---- */
    SELECT
        A.request_no,
        A.request_date,
        A.want_date_from,
        S.resign_date,

        /* --- ไซต์ / ลูกค้า / แผนก --- */
        A.site_code,
        SS.site_name,
        RTRIM(SS.department_code) AS department_code,
        (SELECT TOP 1 D.department_name FROM ms_department D
          WHERE D.department_code = SS.department_code ORDER BY D.seq) AS department_name,
        RTRIM(SS.contract_type_code) AS contract_type_code,
        (SELECT TOP 1 CT.contract_type_name FROM st_ms_contract_type CT
          WHERE CT.contract_type_code = SS.contract_type_code) AS contract_type_name,
        (SELECT z.customer_name FROM st_site_contract_p1 z
          WHERE z.contract_no = A.contract_no) AS customer_name,

        /* --- สถานะใบ --- */
        A.status,
        A.is_stop,
        A.stop_no,

        /* --- คนส่งใบขอ --- */
        (SELECT z.fname + ' ' + z.lname FROM hr_staff z
          WHERE z.staff_id = A.do_id) AS requester_name,

        /* --- สถานที่ปฏิบัติงาน ---
           work_place  = ชื่อสถานที่ที่ไปประจำ (ใช้โชว์ในช่อง "สถานที่ปฏิบัติงาน")
           work_addr   = work_place1+2+3 ต่อกัน (ใช้เป็นที่อยู่เต็ม + ตัวกรองจังหวัด/อำเภอ) */
        LTRIM(RTRIM(B.work_place1)) AS work_place,
        LTRIM(RTRIM(
            ISNULL(NULLIF(LTRIM(RTRIM(B.work_place1)), N''), N'') +
            CASE WHEN NULLIF(LTRIM(RTRIM(B.work_place1)), N'') IS NOT NULL
                  AND NULLIF(LTRIM(RTRIM(B.work_place2)), N'') IS NOT NULL
                 THEN N' ' ELSE N'' END +
            ISNULL(NULLIF(LTRIM(RTRIM(B.work_place2)), N''), N'') +
            CASE WHEN (NULLIF(LTRIM(RTRIM(B.work_place1)), N'') IS NOT NULL
                    OR NULLIF(LTRIM(RTRIM(B.work_place2)), N'') IS NOT NULL)
                  AND NULLIF(LTRIM(RTRIM(B.work_place3)), N'') IS NOT NULL
                 THEN N' ' ELSE N'' END +
            ISNULL(NULLIF(LTRIM(RTRIM(B.work_place3)), N''), N'')
        )) AS work_addr,

        /* --- คุณสมบัติที่ลูกค้าต้องการ --- */
        B.age,
        B.sex,
        LTRIM(RTRIM(B.boss_nationality)) AS boss_nationality,
        B.work_date,
        B.work_time,

        /* --- ตำแหน่ง / ลักษณะงาน --- */
        A.staff_title_code,
        A.job_description_code_1,
        A.job_description_code_2,
        (SELECT z.staff_title_name FROM hr_ms_staff_title z
          WHERE z.staff_title_code = A.staff_title_code) AS staff_title_name,
        (SELECT z.job_description_name FROM hr_ms_job_description_1 z
          WHERE z.job_description_code_1 = A.job_description_code_1) AS job_name1,
        (SELECT z.job_description_name FROM hr_ms_job_description_2 z
          WHERE z.job_description_code_2 = A.job_description_code_2) AS job_name2,

        /* --- ประเภทใบขอ --- */
        A.request_code AS request_action_code,
        (SELECT z.request_name FROM st_ms_request z
          WHERE z.request_code = A.request_code) AS request_action_name,

        /* --- จำนวนตำแหน่ง --- */
        A.request_qty,
        A.inform_qty,
        A.is_inform_all,
        (CASE WHEN ISNULL(A.inform_qty, 0) > 0 THEN A.inform_qty
              ELSE (SELECT COUNT(*) FROM st_inform_head IH
                    WHERE IH.request_no = A.request_no) END) AS effective_inform_qty,

        /* --- คนที่ลาออก / ถูกแทน --- */
        (SELECT z.fname + ' ' + z.lname FROM hr_staff z
          WHERE z.staff_id = S.staff_id) AS staff_fullname,
        (SELECT z.resign_type_name FROM hr_ms_resign_type z
          WHERE z.resign_type_code = S.resign_type_code) AS reason_main_name,

        /* --- ค่าจ้าง / ค่าปรับ --- */
        C.payment_rate,
        C.draw_rate,
        (SELECT z.fee_name FROM wg2_ms_fee z
          WHERE z.fee_codex = (C.withdraw_type_code + C.income1_code
                             + C.income2_code + C.fee_code)) AS fee_name,
        (SELECT z.abs_customer_fine FROM st_request_p3 z
          WHERE z.request_no = A.request_no) AS abs_customer_fine,

        /* --- ผู้ติดต่อฝั่งหน่วยงาน --- */
        (SELECT z.contact_name FROM st_request_p1 z
          WHERE z.request_no = A.request_no) AS contact_name,
        (SELECT z.phone FROM st_request_p1 z
          WHERE z.request_no = A.request_no) AS mobile_phone,

        /* หนึ่งใบขอมีอัตราจ่ายได้หลายแถว — เอาแถวค่าจ้างหลักแถวเดียว
           (is_wage = 'Y' ก่อน แล้วค่อยเอา payment_rate สูงสุด) */
        ROW_NUMBER() OVER (
            PARTITION BY A.request_no
            ORDER BY CASE WHEN C.is_wage = 'Y' THEN 0 ELSE 1 END, C.payment_rate DESC
        ) AS rn

    FROM st_request_head A
    LEFT  JOIN st_request_staff  S ON S.request_no = A.request_no
    INNER JOIN st_request_p2     B ON A.request_no = B.request_no
    INNER JOIN st_request_p3_rate C ON B.request_no = C.request_no
    INNER JOIN ms_site          SS ON A.site_code  = SS.site_code
    WHERE A.request_no IN (SELECT request_no FROM recent)
)
SELECT
    request_no, request_date, want_date_from, resign_date,
    site_code, site_name, department_code, department_name,
    contract_type_code, contract_type_name, customer_name,
    status, is_stop, stop_no,
    requester_name,
    work_place, work_addr,
    age, sex, boss_nationality, work_date, work_time,
    staff_title_code, staff_title_name,
    job_description_code_1, job_description_code_2, job_name1, job_name2,
    request_action_code, request_action_name,
    request_qty, inform_qty, is_inform_all, effective_inform_qty,
    staff_fullname, reason_main_name,
    payment_rate, draw_rate, fee_name, abs_customer_fine,
    contact_name, mobile_phone
FROM base
WHERE rn = 1
ORDER BY request_date DESC;


/* ============================================================================
   [2] ใบขอใบเดียว — เปลี่ยน @requestNo แล้วรัน
   ----------------------------------------------------------------------------
   โครงเหมือน query [1] ทุกอย่าง ต่างแค่:
     - ไม่มี CTE `recent` (ไม่ต้องเลือกว่าใบไหน เพราะระบุเลขที่มาแล้ว)
     - WHERE ใช้ A.request_no ตรง ๆ
   ก๊อปบล็อก base ของ query [1] มาแล้วเปลี่ยนบรรทัดสุดท้ายเป็น:

       WHERE UPPER(RTRIM(A.request_no)) = UPPER(RTRIM(@requestNo))

   ตัวอย่างสั้น ๆ ที่ดูเฉพาะฟิลด์ที่หน้า "ข้อมูลใบขอ" ใช้:
   ============================================================================ */

DECLARE @requestNo VARCHAR(20) = 'OPL6908018';   -- << เปลี่ยนเลขที่ใบขอตรงนี้

SELECT
    A.request_no                     AS [เลขที่ใบขอ],
    A.request_date                   AS [วันที่ส่ง],
    A.want_date_from                 AS [วันที่ต้องการ],
    A.request_qty                    AS [ขอมา],
    A.inform_qty                     AS [หาได้แล้ว],
    (SELECT z.customer_name FROM st_site_contract_p1 z
      WHERE z.contract_no = A.contract_no)        AS [ชื่อหน่วยงาน],
    A.site_code                                   AS [รหัสไซต์],
    LTRIM(RTRIM(B.work_place1))                   AS [สถานที่ปฏิบัติงาน],
    LTRIM(RTRIM(B.work_place2))                   AS [สถานที่ (บรรทัด 2)],
    LTRIM(RTRIM(B.work_place3))                   AS [สถานที่ (บรรทัด 3)],
    (SELECT z.job_description_name FROM hr_ms_job_description_1 z
      WHERE z.job_description_code_1 = A.job_description_code_1) AS [ลักษณะงาน],
    B.age                                         AS [ช่วงอายุ],
    B.sex                                         AS [เพศ],
    LTRIM(RTRIM(B.boss_nationality))              AS [สัญชาติเจ้านาย],
    B.work_date                                   AS [วันทำงาน],
    B.work_time                                   AS [เวลาทำงาน],
    (SELECT z.request_name FROM st_ms_request z
      WHERE z.request_code = A.request_code)      AS [ประเภทใบขอ],
    (SELECT z.contact_name FROM st_request_p1 z
      WHERE z.request_no = A.request_no)          AS [ผู้ติดต่อหน่วยงาน],
    (SELECT z.phone FROM st_request_p1 z
      WHERE z.request_no = A.request_no)          AS [เบอร์ติดต่อ]
FROM st_request_head A
INNER JOIN st_request_p2 B ON A.request_no = B.request_no
WHERE UPPER(RTRIM(A.request_no)) = UPPER(RTRIM(@requestNo));
