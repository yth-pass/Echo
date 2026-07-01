/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Echo Platform API root including `/v1` (e.g. `http://localhost:4000/v1`). Empty = mock-only. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
