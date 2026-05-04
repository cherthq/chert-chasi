import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { env } from "./env";

let cached: OAuth2Client | null = null;

export function oauthClient(): OAuth2Client {
  if (cached) return cached;
  const client = env.getGoogleOAuthClient();
  const token = env.getGoogleOAuthToken();
  const o = new google.auth.OAuth2(
    client.client_id,
    client.client_secret,
    client.redirect_uris?.[0] ?? "http://localhost"
  );
  o.setCredentials(token);
  cached = o;
  return o;
}

export function sheetsClient() {
  return google.sheets({ version: "v4", auth: oauthClient() });
}

export function driveClient() {
  return google.drive({ version: "v3", auth: oauthClient() });
}
