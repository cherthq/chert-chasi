import { sheets_v4 } from "googleapis";
import { env } from "./env";
import { sheetsClient } from "./google";

function requireSheetId(): string {
  const id = env.GOOGLE_SHEETS_ID;
  if (!id)
    throw new Error(
      "GOOGLE_SHEETS_ID is not set. Run `bun run scripts/bootstrap-sheet.ts` to create a sheet."
    );
  return id;
}

const LEADS_TAB = "Leads";
const SETTINGS_TAB = "Settings";

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
] as const;

const LAST_COL_LETTER = "K";

export type LeadStatus =
  | "pending"
  | "sent"
  | "responded"
  | "needs_attention"
  | "do_not_contact";

export type Lead = {
  rowIndex: number; // 1-based, including header (so first data row is 2)
  name: string;
  company: string;
  phone: string;
  linkedin_url: string;
  status: LeadStatus | "";
  chat_id: string;
  last_outbound_at: string;
  last_inbound_at: string;
  last_excerpt: string;
  error: string;
  messages: string;
};

function client(): sheets_v4.Sheets {
  return sheetsClient();
}

function colLetter(zeroIndexed: number): string {
  let n = zeroIndexed + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function rowToLead(row: string[], rowIndex: number): Lead {
  // Don't trim "messages" — newlines matter
  const get = (i: number) => (row[i] ?? "").toString().trim();
  const getRaw = (i: number) => (row[i] ?? "").toString();
  return {
    rowIndex,
    name: get(0),
    company: get(1),
    phone: get(2),
    linkedin_url: get(3),
    status: (get(4) as LeadStatus) || "",
    chat_id: get(5),
    last_outbound_at: get(6),
    last_inbound_at: get(7),
    last_excerpt: get(8),
    error: get(9),
    messages: getRaw(10),
  };
}

export async function readLeads(): Promise<Lead[]> {
  const sheets = client();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: requireSheetId(),
    range: `${LEADS_TAB}!A2:${LAST_COL_LETTER}`,
  });
  const rows = res.data.values ?? [];
  return rows.map((row, i) => rowToLead(row as string[], i + 2));
}

export async function findLeadByChatId(chatId: string): Promise<Lead | null> {
  const all = await readLeads();
  return all.find((l) => l.chat_id === chatId) ?? null;
}

export async function findLeadByPhone(phone: string): Promise<Lead | null> {
  const all = await readLeads();
  const norm = (p: string) => p.replace(/[^\d+]/g, "");
  const target = norm(phone);
  return all.find((l) => norm(l.phone) === target) ?? null;
}

type LeadPatch = Partial<Omit<Lead, "rowIndex">>;

export async function updateLead(
  rowIndex: number,
  patch: LeadPatch
): Promise<void> {
  const sheets = client();
  const updates: { range: string; values: string[][] }[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = HEADERS.indexOf(k as (typeof HEADERS)[number]);
    if (col === -1) continue;
    updates.push({
      range: `${LEADS_TAB}!${colLetter(col)}${rowIndex}`,
      values: [[v == null ? "" : String(v)]],
    });
  }
  if (updates.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: requireSheetId(),
    requestBody: { valueInputOption: "RAW", data: updates },
  });
}

export async function readSettings(): Promise<Record<string, string>> {
  const sheets = client();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: requireSheetId(),
      range: `${SETTINGS_TAB}!A2:B`,
    });
    const rows = (res.data.values ?? []) as string[][];
    const out: Record<string, string> = {};
    for (const [k, v] of rows) {
      if (k) out[String(k).trim()] = (v ?? "").toString();
    }
    return out;
  } catch {
    return {};
  }
}

export async function writeSetting(key: string, value: string): Promise<void> {
  const sheets = client();
  // read existing keys
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: requireSheetId(),
    range: `${SETTINGS_TAB}!A:B`,
  });
  const rows = (res.data.values ?? []) as string[][];
  let foundIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").toString().trim() === key) {
      foundIdx = i;
      break;
    }
  }
  if (foundIdx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: requireSheetId(),
      range: `${SETTINGS_TAB}!A${foundIdx + 1}:B${foundIdx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[key, value]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: requireSheetId(),
      range: `${SETTINGS_TAB}!A:B`,
      valueInputOption: "RAW",
      requestBody: { values: [[key, value]] },
    });
  }
}

export type LoggedMessage = {
  ts: string; // ISO
  direction: "in" | "out";
  text: string;
  message_id?: string;
};

export function parseMessageLog(raw: string): LoggedMessage[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): LoggedMessage | null => {
      // Format: "ISO|direction|message_id|text..."
      const parts = line.split("|");
      if (parts.length < 4) return null;
      const [ts, direction, message_id, ...rest] = parts;
      return {
        ts,
        direction: direction === "out" ? "out" : "in",
        message_id: message_id || undefined,
        text: rest.join("|"),
      };
    })
    .filter((x): x is LoggedMessage => x !== null);
}

function formatLogLine(m: LoggedMessage): string {
  const safe = m.text.replace(/[\r\n]+/g, " ");
  return [m.ts, m.direction, m.message_id ?? "", safe].join("|");
}

export async function appendMessageLog(
  rowIndex: number,
  m: LoggedMessage
): Promise<void> {
  const sheets = client();
  const colRange = `${LEADS_TAB}!K${rowIndex}`;
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: requireSheetId(),
    range: colRange,
  });
  const existing = cur.data.values?.[0]?.[0] ?? "";
  const next = existing ? `${existing}\n${formatLogLine(m)}` : formatLogLine(m);
  await sheets.spreadsheets.values.update({
    spreadsheetId: requireSheetId(),
    range: colRange,
    valueInputOption: "RAW",
    requestBody: { values: [[next]] },
  });
}

export async function ensureLayout(): Promise<void> {
  const sheets = client();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: requireSheetId(),
  });
  const tabs = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "")
  );
  const requests: sheets_v4.Schema$Request[] = [];
  if (!tabs.has(LEADS_TAB))
    requests.push({ addSheet: { properties: { title: LEADS_TAB } } });
  if (!tabs.has(SETTINGS_TAB))
    requests.push({ addSheet: { properties: { title: SETTINGS_TAB } } });
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: requireSheetId(),
      requestBody: { requests },
    });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: requireSheetId(),
    range: `${LEADS_TAB}!A1:${LAST_COL_LETTER}1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS as unknown as string[]] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: requireSheetId(),
    range: `${SETTINGS_TAB}!A1:B1`,
    valueInputOption: "RAW",
    requestBody: { values: [["key", "value"]] },
  });
}
