/// <reference path="../.astro/types.d.ts" />
interface ImportMetaEnv {
  readonly DIRECTUS_URL: string;
  readonly DIRECTUS_STATIC_TOKEN: string;
  readonly SMTP_HOST: string;
  readonly SMTP_PORT: string;
  readonly SMTP_USER: string;
  readonly SMTP_PASS: string;
  readonly SMTP_FROM: string;
  readonly LEAD_NOTIFY_TO: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
