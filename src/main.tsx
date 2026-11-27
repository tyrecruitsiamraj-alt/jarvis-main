import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource/kanit/300.css";
import "@fontsource/kanit/400.css";
import "@fontsource/kanit/500.css";
// Kanit 4 ความหนาเท่านั้น 300/400/500/600 (เจ้าของ 27 พ.ย. 2569) — ห้ามโหลด 700 เพิ่ม · ตัวหนา <b>/<strong>/<th> = 600 ที่ index.css
import "@fontsource/kanit/600.css";
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
// ป๊อปของ Radix (ช่องเลือก · Dialog · เมนู) ล็อกจอด้วยการใส่ overflow:hidden ที่ body — ตัวเลื่อนของหน้าคือ html (บรรทัดบน)
// body จึงกลายเป็นกรอบเลื่อนซ้อน ของที่ปักไว้ (sticky) หลุดกลับตำแหน่งเดิมทันทีที่เปิดช่องเลือก
// (เจ้าของ 23 พ.ย. 2569 "กรองพอกดแล้วมันเลื่อน" — แผงตัวกรอง Dashboard กระโดดจาก y=80 ไป y=-515 ตอนเลื่อนจอลงมา 700px · วัดบนเว็บจริง)
// ⇒ คง body เป็น overflow visible ตอนล็อก · การกันเลื่อนพื้นหลังของ Radix ทำที่ตัวดักล้อเมาส์/นิ้ว ไม่ได้พึ่ง overflow นี้
document.body.classList.add("data-[scroll-locked]:!overflow-visible");

createRoot(document.getElementById("root")!).render(<App />);
