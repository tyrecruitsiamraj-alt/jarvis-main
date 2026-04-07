import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // ใช้ 127.0.0.1 ให้ตรงกับ server/local-api.ts ที่ listen ที่ 127.0.0.1 (บน Windows localhost อาจไป ::1 แล้วต่อไม่ติด)
  const apiProxy = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3000";

  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: apiProxy,
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
};
});