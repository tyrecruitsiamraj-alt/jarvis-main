/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_ENABLE_RUNTIME_DEMO_FALLBACK?: string;
  readonly VITE_APP_OPERATOR_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
