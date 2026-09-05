# ตัวชี้ทาง Skill ของโปรเจกต์: ศูนย์ควบคุมใบขอ (Request Control Tower)

เมื่อทำงานเกี่ยวกับศูนย์ควบคุมใบขอ แดชบอร์ดใบขอกำลังคน แดชบอร์ด SLA แดชบอร์ดงานค้าง
ตรรกะการหาได้ ตรรกะการยกเลิก แนวโน้มวงจรชีวิตใบขอ อันดับต้นเหตุ
หรืองาน implement ใด ๆ ที่เกี่ยวข้อง (ทั้ง Cursor และ Claude) ให้อ่านไฟล์เหล่านี้ก่อนเสมอ:

1. .claude/skills/request-control-tower-advisor/SKILL.md
2. .claude/skills/request-control-tower-advisor/references/01-business-context.md
3. .claude/skills/request-control-tower-advisor/references/02-dashboard-metric-definitions.md
4. .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md
5. .claude/skills/request-control-tower-advisor/references/04-sla-rules.md
6. .claude/skills/request-control-tower-advisor/references/06-safe-implementation-rules.md
7. .claude/skills/request-control-tower-advisor/references/09-editing-map.md

> **การค้นหา skill ของ Claude Code:** skill ของโปรเจกต์ต้องอยู่ใต้ `.claude/skills/`
> เท่านั้น (ไม่ใช่ `skills/` ที่ root ของ repo)
> ที่ `skills/request-control-tower-advisor/README.md` เหลือไว้เป็นป้ายชี้ทางสั้น ๆ

กติกาหลักที่ห้ามละเมิด:

* ห้ามปน "หาได้แล้ว" กับ "ปิดครบใบขอ"
* ห้ามนับอัตราที่ถูกยกเลิกเป็นอัตราที่หาได้
* ห้ามเอา inform_qty จาก snapshot มาใช้เป็นยอดหาได้รายเดือนแบบเป๊ะ ๆ โดยไม่บอกใคร
* ถ้าไม่มีวันที่ของเหตุการณ์หาได้ ให้ติดธง snapshot_fallback กับ metric ที่กระทบ
* ห้ามเขียนทับแดชบอร์ดเดิมตรง ๆ
* ใช้ parallel layer + feature flag + adapter + read-only API
* แดชบอร์ดเดิมต้องยังใช้งานได้เสมอ เป็นทางถอย (rollback)
* เปลี่ยนตรรกะการคำนวณเมื่อไหร่ ต้องอัปเดตเทสต์ด้วยเสมอ
* เพิ่มไฟล์ภายในใหม่เมื่อไหร่ ต้องอัปเดต 09-editing-map.md ด้วยเสมอ

สมการหลัก:
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา

คำศัพท์บนหน้าจอที่ใช้ประจำ:

* ขอมา = requested positions
* หาได้แล้ว = fulfilled/informed positions
* ปิดครบใบขอ = fully fulfilled requests
* ยกเลิก = cancelled positions
* จบงานแล้ว = resolved requests
* เหลือหา = remaining positions
* งานค้าง / ยอดยกมา = backlog
* หาได้บางส่วน = partial fulfillment


## 🔴 กติกา UI — ห้ามละเมิด (เจ้าของสั่ง 20 ส.ค. 2569)

โปรเจกต์นี้ใช้ **shadcn/ui** (มี `components.json` · component อยู่ที่ `src/components/ui/`
47 ตัวติดตั้งแล้ว) และติดตั้ง **shadcn Skill + MCP** ไว้ให้ค้น/ดู/เพิ่ม component ได้เอง

* **ห้ามสร้าง Button ใหม่เอง** — ใช้ `@/components/ui/button` เท่านั้น
* **ห้ามสร้าง Dialog ใหม่เอง** — ใช้ `@/components/ui/dialog` (หรือ `alert-dialog` / `sheet` / `drawer`)
  🔴 **ห้ามซ้อน Dialog ใน Dialog** — ต้องการฟอร์มในป๊อปเดิมให้ทำ prop `embedded`
  (แพตเทิร์นเดียวกับ `GenApplyLinkDialog` · `EditPostingDialog`)
* **ห้ามกำหนด radius สุ่ม** — ใช้ `rounded-lg` / `rounded-xl` / `rounded-2xl` / `rounded-full`
  ตามสเกลของ Tailwind + token ของ shadcn (`--radius`) ห้ามเขียน `rounded-[13px]` เอง
* **ห้ามใช้สี hex ตรง ๆ** — สีทุกสีมาจาก `src/lib/designTokens.ts` (`TONE` / `DASH`) หรือ
  CSS variable ของธีม · มีเทสต์คุมที่ `tests/api/designTokens.test.ts`
* 🔴 **จานสีของแบรนด์ = ขาว · กรมท่า · เบอร์กันดี** (เจ้าของเคาะ 5 ก.ย. 2569 จากหน้า Login)
  กรมท่า `#12203c` · เบอร์กันดี `#8c2f39` · ประกาศเป็นตัวแปรธีมที่ `src/index.css`
  (`--primary` `--foreground` `--accent` `--ring` `--jarvis-hero` ฯลฯ) **ที่เดียว**
  ⇒ อยากเปลี่ยนหน้าตาทั้งระบบ ให้แก้ตัวแปรพวกนี้ ห้ามไล่ทาสีทีละไฟล์
  ⚠️ **สีที่มีความหมายห้ามแตะ** — success/warn/danger/info/violet เป็นภาษาของตัวเลข
  (เขียว = หาได้แล้ว · เหลือง = เหลือหา · แดง = เกิน SLA ฯลฯ)
* **ห้ามสร้าง spacing สุ่ม** — ใช้สเกลของ Tailwind (`gap-2` `p-4` `space-y-3`)
  ห้ามเขียน `px-[13px]` เอง
* 🔴 **ห้ามเขียน CSS เอง** (เจ้าของสั่ง 4 ก.ย. 2569) — ห้ามเพิ่มคลาสใหม่ใน `src/index.css`
  หรือไฟล์ CSS อื่น · อยากได้หน้าตาใหม่ให้ประกอบจาก component ของ shadcn + utility ของ
  Tailwind · ต้องมี variant ใหม่จริง ให้เพิ่มที่ `src/components/ui/<component>.tsx` ที่เดียว
  (คลาสปุ่มที่เคยปั้นเอง `jarvis-btn-*` / `jarvis-pill-btn` ถูกถอดออกหมดแล้ว 4 ก.ย. 2569)
* **ฟอนต์เดียวทั้งระบบ = Kanit** ทั้ง `font-sans` และ `font-mono` · ห้ามกำหนด
  `fontFamily` เองในไฟล์จอ · ตัวเลขเรียงตรงด้วย `tabular-nums` ไม่ใช่การสลับฟอนต์

**อยากได้ component ใหม่:** สั่ง Claude ตรง ๆ (เช่น *"Add form and input from shadcn"*)
หรือ `npx shadcn@latest add <component>` — **ห้ามเขียน primitive ขึ้นมาใหม่**

**ติดตั้งเครื่องมือบนเครื่องใหม่** (ตัว skill ไม่ได้ commit เพราะเป็น symlink เข้า `.agents/`
ที่ machine-local · เวอร์ชันล็อกไว้ที่ `skills-lock.json`):

```bash
npx skills add shadcn/ui            # skill: shadcn + migrate-radix-to-base
```

MCP อยู่ที่ `.mcp.json` (commit แล้ว · server `shadcn` รันด้วย `npx shadcn@latest mcp`)
— **ต้องรีสตาร์ต Claude Code หนึ่งครั้ง** แล้วเช็คด้วย `/mcp` ว่าขึ้น `shadcn: Connected`

**ของเดิมที่ยังไม่ตรงกติกา (วัดจริง 20 ส.ค. 2569 — ยังไม่ได้แก้ รอเจ้าของสั่ง):**
`rounded-[...]` **70 จุด** · spacing สุ่ม **12 จุด** · hex ดิบ **24 บรรทัดใน 12 ไฟล์**
(ในนั้น `src/components/ui/button.tsx` ใช้ `bg-[#141210]` และโลโก้ Microsoft ที่
`CompanyEmailLoginGate.tsx` ซึ่งเป็นสีแบรนด์ต้องเป๊ะ แก้ไม่ได้)
🔴 **กติกานี้บังคับกับของใหม่ทันที** — ของเดิมแก้เมื่อเจ้าของสั่ง (แก้ทีเดียว 70 จุด = หน้าตาเปลี่ยนทั้งระบบ)

## คู่มือโปรเจกต์

คู่มือฉบับอ่านง่ายสำหรับคน:

* docs/request-control-tower/HANDBOOK.md
