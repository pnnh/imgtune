/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly OFFLINE: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
