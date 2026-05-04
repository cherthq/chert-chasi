/**
 * One-shot: create the chasi-chert spreadsheet, set up Leads + Settings tabs,
 * seed default settings, and grant Editor access to SHARE_WITH_EMAIL.
 *
 * Prints the sheet ID and URL. Paste the ID into Vercel as GOOGLE_SHEETS_ID.
 *
 * Run:  bun run scripts/bootstrap-sheet.ts
 */
import { driveClient, sheetsClient } from "../lib/google";
import { env } from "../lib/env";
import { DEFAULTS } from "../lib/settings";

const HEADERS = [
  "name",
  "company",
  "phone",
  "linkedin_url",
  "status",
  "chat_id",
  "last_outbound_at",
  "last_inbound_at",
  "last_excerpt",
  "error",
  "messages",
];

async function main() {
  const sheets = sheetsClient();
  const drive = driveClient();
  const shareWith = env.SHARE_WITH_EMAIL;

  // 1. Create spreadsheet with both tabs
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "chasi-chert · iMessage CRM" },
      sheets: [
        { properties: { title: "Leads" } },
        { properties: { title: "Settings" } },
      ],
    },
  });
  const sheetId = created.data.spreadsheetId!;
  const url = created.data.spreadsheetUrl!;

  // 2. Write headers
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: "Leads!A1:K1", values: [HEADERS] },
        { range: "Settings!A1:B1", values: [["key", "value"]] },
      ],
    },
  });

  // 3. Seed defaults
  const settingsRows = Object.entries(DEFAULTS).map(([k, v]) => [k, v]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Settings!A:B",
    valueInputOption: "RAW",
    requestBody: { values: settingsRows },
  });

  // 4. Share with the requested email as Editor
  try {
    await drive.permissions.create({
      fileId: sheetId,
      sendNotificationEmail: false,
      requestBody: {
        type: "user",
        role: "writer",
        emailAddress: shareWith,
      },
    });
    console.log(`✓ shared with ${shareWith} as Editor`);
  } catch (e) {
    console.warn(
      `⚠ share-with ${shareWith} failed (may already be the owner):`,
      (e as Error).message
    );
  }

  console.log("\n✓ Sheet created");
  console.log("  ID:  ", sheetId);
  console.log("  URL: ", url);
  console.log("\nNext: add this to your env (.env.local + Vercel):");
  console.log(`  GOOGLE_SHEETS_ID=${sheetId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
