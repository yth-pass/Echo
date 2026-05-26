/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Echo Platform API root including `/v1` (e.g. `http://localhost:4000/v1`). Empty = mock-only. */
  readonly VITE_API_BASE_URL?: string;
  /** DeepSeek API key — exposed to browser if set; local prototype only. */
  readonly VITE_DEEPSEEK_API_KEY?: string;
  /** Default `https://api.deepseek.com` */
  readonly VITE_DEEPSEEK_BASE_URL?: string;
  /** Default `deepseek-chat` */
  readonly VITE_DEEPSEEK_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
