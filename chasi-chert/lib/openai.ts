import OpenAI from "openai";
import { env } from "./env";

let cached: OpenAI | null = null;
function client(): OpenAI {
  if (!cached) cached = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return cached;
}

export type ConvoTurn = { role: "user" | "assistant"; content: string };

export async function generateReply(args: {
  systemPrompt: string;
  history: ConvoTurn[];
  lead: { name?: string; company?: string };
}): Promise<string> {
  const oai = client();
  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      {
        role: "system",
        content:
          args.systemPrompt +
          `\n\nLead context — name: ${args.lead.name ?? "unknown"}, company: ${
            args.lead.company ?? "unknown"
          }.\nReply with only the message body. No greetings unless natural. Keep it under 280 characters. Sound human, casual, lower-cased iMessage tone unless the lead is formal.`,
      },
      ...args.history.map((t) => ({ role: t.role, content: t.content })),
    ];
  const res = await oai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 200,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
