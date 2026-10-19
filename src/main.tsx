import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./lib/theme";
import { installStaleChunkReload } from "./lib/staleChunkReload";

// ตั้งธีม (light/dark/ตามเครื่อง) ก่อน render — กันหน้ากะพริบสีผิดตอนโหลด
initTheme();
// ขึ้นเว็บใหม่แล้วไฟล์ของหน้าเก่าหาย = โหลดหน้าใหม่ให้เอง (เจ้าของ 19 ต.ค. 2569 "เปลี่ยนหน้าแล้วค้าง ต้องกด refresh")
installStaleChunkReload();
// แถบเลื่อนอยู่ตลอด (เจ้าของ 19 ต.ค. 2569 "กดทีม online ปุ่มงานสรรหาเด้งไปแถวบนแล้วเด้งลงมา") —
// ตอนเนื้อหาสั้น (กำลังโหลด) แถบเลื่อนหาย หน้ากว้างขึ้น 6px แท็บที่ตัดแถวขยับขึ้นลง
// (scrollbar-gutter บน html ใช้ไม่ได้เมื่อ overflow เป็น visible — วัดแล้วยังกว้าง 736 ⇒ ใช้ overflow-y-scroll)
document.documentElement.classList.add("overflow-y-scroll");

createRoot(document.getElementById("root")!).render(<App />);
