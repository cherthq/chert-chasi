import fs from "node:fs";
import path from "node:path";

function need(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function opt(key: string): string | undefined {
  return process.env[key];
}

function readJsonAtPath<T>(p: string): T {
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
}

export const env = {
  get CHERT_API_BASE() {
    return opt("CHERT_API_BASE") ?? "https://console.trychert.com/api/v1";
  },
  get CHERT_SIGNING_SECRET() {
    return need("CHERT_SIGNING_SECRET");
  },
  get CHERT_TENANT_SLUG() {
    return opt("CHERT_TENANT_SLUG");
  },
  get CHERT_WEBHOOK_SECRET() {
    return opt("CHERT_WEBHOOK_SECRET") ?? need("CHERT_SIGNING_SECRET");
  },

  // Google: OAuth (user-credential) flow.
  // For prod (Vercel), set GOOGLE_OAUTH_CLIENT_JSON + GOOGLE_OAUTH_TOKEN_JSON.
  // For local dev, GOOGLE_OAUTH_CLIENT_PATH + GOOGLE_OAUTH_TOKEN_PATH point at files.
  getGoogleOAuthClient(): {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  } {
    const fromEnv = opt("GOOGLE_OAUTH_CLIENT_JSON");
    const fromPath =
      opt("GOOGLE_OAUTH_CLIENT_PATH") ?? ".secrets/google-oauth-client.json";
    const raw = fromEnv
      ? JSON.parse(fromEnv)
      : readJsonAtPath<Record<string, unknown>>(fromPath);
    const inner =
      (raw as { installed?: unknown; web?: unknown }).installed ??
      (raw as { installed?: unknown; web?: unknown }).web ??
      raw;
    return inner as {
      client_id: string;
      client_secret: string;
      redirect_uris?: string[];
    };
  },
  getGoogleOAuthToken(): {
    access_token?: string;
    refresh_token: string;
    scope?: string;
    token_type?: string;
    expiry_date?: number;
  } {
    const fromEnv = opt("GOOGLE_OAUTH_TOKEN_JSON");
    const fromPath =
      opt("GOOGLE_OAUTH_TOKEN_PATH") ?? ".secrets/google-oauth-token.json";
    const raw = fromEnv
      ? JSON.parse(fromEnv)
      : readJsonAtPath<Record<string, unknown>>(fromPath);
    return raw as {
      access_token?: string;
      refresh_token: string;
      scope?: string;
      token_type?: string;
      expiry_date?: number;
    };
  },

  get GOOGLE_SHEETS_ID() {
    return opt("GOOGLE_SHEETS_ID");
  },
  get SHARE_WITH_EMAIL() {
    return opt("SHARE_WITH_EMAIL") ?? "gary@trychert.com";
  },

  get OPENAI_API_KEY() {
    return need("OPENAI_API_KEY");
  },
  get OPENAI_MODEL() {
    return opt("OPENAI_MODEL") ?? "gpt-4o-mini";
  },
  get CRON_SECRET() {
    return opt("CRON_SECRET");
  },
  get ADMIN_SECRET() {
    return need("ADMIN_SECRET");
  },
  get APP_URL() {
    return (
      opt("APP_URL") ??
      (opt("VERCEL_PROJECT_PRODUCTION_URL")
        ? `https://${opt("VERCEL_PROJECT_PRODUCTION_URL")}`
        : opt("VERCEL_URL")
        ? `https://${opt("VERCEL_URL")}`
        : "http://localhost:3000")
    );
  },
};
