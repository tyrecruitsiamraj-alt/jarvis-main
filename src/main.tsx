import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./lib/theme";

// ตั้งธีม (light/dark/ตามเครื่อง) ก่อน render — กันหน้ากะพริบสีผิดตอนโหลด
initTheme();

createRoot(document.getElementById("root")!).render(<App />);
