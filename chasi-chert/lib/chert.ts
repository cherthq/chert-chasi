import { env } from "./env";

type Json = Record<string, unknown>;

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${env.CHERT_SIGNING_SECRET}`,
    "Content-Type": "application/json",
  };
  if (env.CHERT_TENANT_SLUG) h["x-chert-tenant"] = env.CHERT_TENANT_SLUG;
  return h;
}

async function call<T = unknown>(
  method: string,
  path: string,
  body?: Json
): Promise<T> {
  const res = await fetch(`${env.CHERT_API_BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(
      `Chert ${method} ${path} ${res.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }
  return data as T;
}

export type PhoneLine = {
  id: string;
  phone_number: string;
  service?: string;
};

export async function listPhoneNumbers(): Promise<PhoneLine[]> {
  const r = await call<{ phone_numbers: PhoneLine[] }>(
    "GET",
    "/phone-numbers"
  );
  return r.phone_numbers ?? [];
}

let cachedFrom: string | null = null;
export async function defaultFromNumber(): Promise<string> {
  if (cachedFrom) return cachedFrom;
  const lines = await listPhoneNumbers();
  if (!lines.length) throw new Error("No Chert phone lines available");
  cachedFrom = lines[0].phone_number;
  return cachedFrom;
}

export type SendResult = {
  chat_id: string;
  message_id: string;
  lead_id: string;
  convo_id?: string;
  phone_line_id?: string;
  status: string;
};

type RawSendResult = {
  chat_id?: string;
  message_id?: string;
  lead_id?: string;
  convo_id?: string;
  phone_line_id?: string;
  status?: string;
};

// Per Chert docs: chat_id, lead_id, and convo_id all refer to the same
// conversation. /send returns lead_id+convo_id; /chats returns chat_id.
// Normalize to always have chat_id populated.
function normalize(r: RawSendResult): SendResult {
  const chat_id = r.chat_id || r.lead_id || r.convo_id || "";
  return {
    chat_id,
    message_id: r.message_id ?? "",
    lead_id: r.lead_id ?? chat_id,
    convo_id: r.convo_id,
    phone_line_id: r.phone_line_id,
    status: r.status ?? "",
  };
}

export async function sendText(
  to: string,
  text: string,
  opts: { test_lead?: boolean } = {}
): Promise<SendResult> {
  const body: Json = { phone: to, body: text };
  if (opts.test_lead) body.test_lead = true;
  const raw = await call<RawSendResult>("POST", "/send", body);
  return normalize(raw);
}

export async function sendIntoChat(
  chatId: string,
  text: string,
  opts: { test_lead?: boolean } = {}
): Promise<SendResult> {
  const body: Json = {
    message: { parts: [{ type: "text", value: text }] },
  };
  if (opts.test_lead) body.test_lead = true;
  const raw = await call<RawSendResult>(
    "POST",
    `/chats/${chatId}/messages`,
    body
  );
  return normalize({ ...raw, chat_id: raw.chat_id ?? chatId });
}

export async function setTyping(
  chatId: string,
  state: "typing" | "stopped"
): Promise<void> {
  await call("POST", `/chats/${chatId}/typing`, { state });
}

export async function react(
  messageId: string,
  reaction:
    | "love"
    | "like"
    | "dislike"
    | "laugh"
    | "emphasize"
    | "question"
): Promise<void> {
  await call("POST", `/messages/${encodeURIComponent(messageId)}/react`, {
    reaction,
  });
}

export type ChatMessage = {
  id: string;
  chat_id: string;
  parts: { type: string; value?: string }[];
  status: string;
  direction: "inbound" | "outbound";
  created_at: string;
};

export async function chatHistory(chatId: string): Promise<ChatMessage[]> {
  const r = await call<{ messages: ChatMessage[]; has_more?: boolean }>(
    "GET",
    `/chats/${chatId}/messages`
  );
  return r.messages ?? [];
}

export type EnrichResult =
  | {
      ok: true;
      phone: string;
      confidence: string;
      source: string;
      cached: boolean;
    }
  | { ok: false; error: string };

export async function enrichContact(input: {
  linkedin_url?: string;
  email?: string;
  first_name?: string;
  company?: string;
  wait_ms?: number;
}): Promise<EnrichResult> {
  return call<EnrichResult>("POST", "/enrich/contact", { ...input });
}

export async function subscribeWebhook(
  url: string,
  events: string[] = ["message.received", "lead_reply"]
): Promise<{ id: string; webhook_secret?: string } & Json> {
  return call("POST", "/webhook-subscriptions", {
    url,
    events,
    version: "2026-05-04",
  });
}
