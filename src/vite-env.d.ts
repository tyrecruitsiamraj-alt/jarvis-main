/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_OPERATOR_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
