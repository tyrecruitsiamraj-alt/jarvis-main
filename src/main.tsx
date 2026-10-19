import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./lib/theme";
import { installStaleChunkReload } from "./lib/staleChunkReload";

// ตั้งธีม (light/dark/ตามเครื่อง) ก่อน render — กันหน้ากะพริบสีผิดตอนโหลด
initTheme();
// ขึ้นเว็บใหม่แล้วไฟล์ของหน้าเก่าหาย = โหลดหน้าใหม่ให้เอง (เจ้าของ 19 ต.ค. 2569 "เปลี่ยนหน้าแล้วค้าง ต้องกด refresh")
installStaleChunkReload();

createRoot(document.getElementById("root")!).render(<App />);
