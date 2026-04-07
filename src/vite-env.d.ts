/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_DEV_ROLE_ENTRY?: string;
  readonly VITE_APP_OPERATOR_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
