import { readSettings, writeSetting } from "./sheets";

export const DEFAULTS = {
  auto_send: "false",
  auto_reply: "false",
  test_mode: "true",
  template:
    "hey {name}, saw your work at {company} — quick question: are you open to a 10-min chat about how teams like yours are using ai for outbound? totally fine if no.",
  send_interval_minutes: "10",
  ai_system_prompt:
    "You are an SDR replying to inbound iMessage replies on behalf of Akash at Chert. Your goal is to qualify interest in a quick intro call and book a meeting. Be warm, brief, and human. Match their tone. If they say no or unsubscribe, acknowledge politely and stop.",
  last_global_send_at: "",
} as const;

export type SettingsKey = keyof typeof DEFAULTS;

export type Settings = {
  auto_send: boolean;
  auto_reply: boolean;
  test_mode: boolean;
  template: string;
  send_interval_minutes: number;
  ai_system_prompt: string;
  last_global_send_at: string;
};

export function parseBool(v: string | undefined): boolean {
  return (v ?? "").toLowerCase() === "true";
}

export async function getSettings(): Promise<Settings> {
  const raw = await readSettings();
  const merged: Record<string, string> = { ...DEFAULTS, ...raw };
  return {
    auto_send: parseBool(merged.auto_send),
    auto_reply: parseBool(merged.auto_reply),
    test_mode: parseBool(merged.test_mode),
    template: merged.template,
    send_interval_minutes:
      Number.parseInt(merged.send_interval_minutes, 10) || 10,
    ai_system_prompt: merged.ai_system_prompt,
    last_global_send_at: merged.last_global_send_at,
  };
}

export async function setSetting(key: SettingsKey, value: string): Promise<void> {
  await writeSetting(key, value);
}

export async function seedDefaults(): Promise<void> {
  const existing = await readSettings();
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (existing[k] === undefined) await writeSetting(k, v);
  }
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => vars[key] ?? "");
}
