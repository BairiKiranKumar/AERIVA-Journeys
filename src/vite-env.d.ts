/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_AGENCY_WHATSAPP?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
