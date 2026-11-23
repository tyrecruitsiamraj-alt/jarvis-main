import { defineConfig } from "vitest/config";
import path from "path";

/**
 * เทสต์ที่ยิงฐานข้อมูลจริง (Postgres ทิ้งได้ในเครื่อง) — แยกจาก `npm test` ซึ่งไม่ต้องมีฐาน
 * รัน: DOCS_TEST_DATABASE_URL=postgres://…@127.0.0.1:…/jarvis_docs npm run test:documents
 * ไม่ตั้งตัวแปรนี้ = ข้ามทั้งชุด · ชี้ไปเครื่องอื่นที่ไม่ใช่ localhost = ไม่ยอมรัน (เทสต์ล้างตาราง)
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
