/**
 * One-shot Google OAuth consent flow.
 *
 * Opens a browser for you to grant Drive + Sheets access, captures the
 * authorization code on a localhost listener (random free port), exchanges
 * for tokens, and writes the refresh-bearing token to
 * .secrets/google-oauth-token.json.
 *
 * Run:  bun run scripts/auth.ts
 *
 * Sign in with gary@trychert.com when prompted.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { google } from "googleapis";
import { env } from "../lib/env";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close();
        reject(new Error("could not pick a port"));
      }
    });
    srv.on("error", reject);
  });
}

function openInBrowser(url: string) {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd);
}

async function main() {
  const c = env.getGoogleOAuthClient();
  const port = await getFreePort();
  const redirectUri = `http://localhost:${port}`;
  const o = new google.auth.OAuth2(c.client_id, c.client_secret, redirectUri);

  const authUrl = o.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  const code: string = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      const c = url.searchParams.get("code");
      const e = url.searchParams.get("error");
      if (e) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>auth error</h1><p>${e}</p>`);
        server.close();
        reject(new Error(`oauth error: ${e}`));
        return;
      }
      if (c) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<h1>authorized ✓</h1><p>you can close this tab and return to the terminal</p>`
        );
        server.close();
        resolve(c);
      }
    });
    server.listen(port, () => {
      process.stderr.write(
        `\nif the browser didn't open, paste this URL:\n\n${authUrl}\n\nwaiting for consent on ${redirectUri} ...\n`
      );
      openInBrowser(authUrl);
    });
    setTimeout(() => {
      server.close();
      reject(new Error("timed out waiting for OAuth callback (3 min)"));
    }, 180_000);
  });

  const { tokens } = await o.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "no refresh_token returned. Revoke the app at https://myaccount.google.com/permissions and re-run."
    );
  }

  const out = path.resolve(process.cwd(), ".secrets/google-oauth-token.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  console.log(`\n✓ tokens written to ${out}`);
  console.log(`  scope: ${tokens.scope}`);
  console.log("\nnext: bun run scripts/bootstrap-sheet.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
