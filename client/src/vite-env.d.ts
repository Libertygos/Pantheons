/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_HTTP?: string;
  readonly VITE_SERVER_WS?: string;
  readonly VITE_ASSET_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
