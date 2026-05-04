"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";

type Settings = {
  auto_send: boolean;
  auto_reply: boolean;
  test_mode: boolean;
  template: string;
  send_interval_minutes: number;
  ai_system_prompt: string;
  last_global_send_at: string;
};

type Lead = {
  rowIndex: number;
  name: string;
  company: string;
  phone: string;
  linkedin_url: string;
  status: string;
  chat_id: string;
  last_outbound_at: string;
  last_inbound_at: string;
  last_excerpt: string;
  error: string;
  messages: string;
};

type ChertMessage = {
  id: string;
  chat_id: string;
  parts: { type: string; value?: string }[];
  status: string;
  direction: "inbound" | "outbound";
  created_at: string;
};

type Tab = "controls" | "leads" | "inbox";

const REACTIONS: Array<{
  key: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question";
  emoji: string;
  label: string;
}> = [
  { key: "love", emoji: "❤️", label: "love" },
  { key: "like", emoji: "👍", label: "like" },
  { key: "dislike", emoji: "👎", label: "dislike" },
  { key: "laugh", emoji: "😂", label: "ha" },
  { key: "emphasize", emoji: "‼️", label: "!!" },
  { key: "question", emoji: "❓", label: "?" },
];

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function Dashboard() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("controls");

  const refresh = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [s, l] = await Promise.all([
        fetch("/api/settings").then((r) => r.json()),
        fetch("/api/leads").then((r) => r.json()),
      ]);
      if (s.error) {
        setMsg(s.error);
        return;
      }
      setSettings(s);
      setLeads(l.leads ?? []);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveSettings(patch: Partial<Settings>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(patch),
      });
      const s = await r.json();
      if (s.error) {
        setMsg(s.error);
        return;
      }
      setSettings(s);
      setMsg("saved");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendNow() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/send-now", { method: "POST" });
      const j = await r.json();
      setMsg(JSON.stringify(j));
      await refresh();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setupBackend() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/setup", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({}),
      });
      const j = await r.json();
      setMsg(JSON.stringify(j));
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      <Sidebar tab={tab} setTab={setTab} />

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between px-6 py-3 border-b bg-white">
          <h1 className="text-base font-semibold capitalize">{tab}</h1>
          <div className="flex items-center gap-2">
            {msg && (
              <span className="text-xs font-mono text-zinc-500 max-w-md truncate">
                {msg}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={busy}
              className="px-2.5 py-1 text-xs border rounded-md bg-white hover:bg-zinc-50"
            >
              refresh
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "controls" && (
            <ControlsView
              settings={settings}
              setSettings={setSettings}
              saveSettings={saveSettings}
              sendNow={sendNow}
              setupBackend={setupBackend}
              busy={busy}
              leads={leads}
            />
          )}
          {tab === "leads" && <LeadsView leads={leads} />}
          {tab === "inbox" && (
            <InboxView leads={leads} onRefresh={refresh} />
          )}
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  tab,
  setTab,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const items: { key: Tab; label: string; icon: string }[] = [
    { key: "controls", label: "Controls", icon: "⚙︎" },
    { key: "leads", label: "Leads", icon: "☷" },
    { key: "inbox", label: "Inbox", icon: "✉" },
  ];
  return (
    <aside className="w-56 shrink-0 bg-white border-r flex flex-col">
      <div className="px-4 py-4 border-b">
        <div className="font-semibold">chasi-chert</div>
        <div className="text-[11px] text-zinc-500">imessage SDR</div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => setTab(it.key)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 ${
              tab === it.key
                ? "bg-black text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <span className="w-4 text-center">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function ControlsView({
  settings,
  setSettings,
  saveSettings,
  sendNow,
  setupBackend,
  busy,
  leads,
}: {
  settings: Settings | null;
  setSettings: (s: Settings) => void;
  saveSettings: (p: Partial<Settings>) => void;
  sendNow: () => void;
  setupBackend: () => void;
  busy: boolean;
  leads: Lead[];
}) {
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-medium">controls</h2>
        {settings && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Toggle
              label="auto-send (cron-paced)"
              value={settings.auto_send}
              onChange={(v) => saveSettings({ auto_send: v })}
            />
            <Toggle
              label="auto-reply with LLM on inbound"
              value={settings.auto_reply}
              onChange={(v) => saveSettings({ auto_reply: v })}
            />
            <Toggle
              label="test mode (bypass cross-tenant pin)"
              value={settings.test_mode}
              onChange={(v) => saveSettings({ test_mode: v })}
            />
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="text-zinc-500">send interval (minutes)</span>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2"
                value={settings.send_interval_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    send_interval_minutes: Number(e.target.value || 0),
                  })
                }
                onBlur={(e) =>
                  saveSettings({
                    send_interval_minutes: Number(e.target.value || 10),
                  })
                }
              />
            </label>
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="text-zinc-500">
                outbound template — supports {"{name}"} and {"{company}"}
              </span>
              <textarea
                className="w-full border rounded-lg px-3 py-2 font-mono text-xs h-28"
                value={settings.template}
                onChange={(e) =>
                  setSettings({ ...settings, template: e.target.value })
                }
                onBlur={(e) => saveSettings({ template: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="text-zinc-500">LLM auto-reply system prompt</span>
              <textarea
                className="w-full border rounded-lg px-3 py-2 font-mono text-xs h-32"
                value={settings.ai_system_prompt}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai_system_prompt: e.target.value,
                  })
                }
                onBlur={(e) =>
                  saveSettings({ ai_system_prompt: e.target.value })
                }
              />
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={sendNow}
            disabled={busy}
            className="px-3 py-2 text-sm bg-black text-white rounded-lg"
          >
            send next pending now
          </button>
          <button
            onClick={setupBackend}
            disabled={busy}
            className="px-3 py-2 text-sm border rounded-lg bg-white"
          >
            run setup (sheet layout + chert webhook)
          </button>
          <span className="text-xs text-zinc-500 self-center">
            last global send: {settings?.last_global_send_at || "—"}
          </span>
        </div>
      </section>

      <LeadsTable leads={leads} />
    </div>
  );
}

function LeadsView({ leads }: { leads: Lead[] }) {
  return (
    <div className="p-6 max-w-6xl">
      <LeadsTable leads={leads} />
    </div>
  );
}

function LeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <section className="bg-white border rounded-2xl overflow-hidden">
      <h2 className="font-medium px-5 py-3 border-b">leads</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">row</th>
              <th className="text-left px-4 py-2">name</th>
              <th className="text-left px-4 py-2">company</th>
              <th className="text-left px-4 py-2">phone</th>
              <th className="text-left px-4 py-2">status</th>
              <th className="text-left px-4 py-2">last out</th>
              <th className="text-left px-4 py-2">last in</th>
              <th className="text-left px-4 py-2">excerpt / error</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-zinc-400" colSpan={8}>
                  no leads yet — add rows to your sheet
                </td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.rowIndex} className="border-t">
                <td className="px-4 py-2 text-zinc-400">{l.rowIndex}</td>
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2">{l.company}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.phone}</td>
                <td className="px-4 py-2">
                  <StatusPill status={l.status} />
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {fmt(l.last_outbound_at)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {fmt(l.last_inbound_at)}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-600 max-w-md truncate">
                  {l.error ? `⚠ ${l.error}` : l.last_excerpt || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InboxView({
  leads,
  onRefresh,
}: {
  leads: Lead[];
  onRefresh: () => void;
}) {
  const conversations = useMemo(
    () =>
      leads
        .filter((l) => l.chat_id)
        .map((l) => ({
          ...l,
          sortKey: Math.max(
            l.last_inbound_at ? Date.parse(l.last_inbound_at) : 0,
            l.last_outbound_at ? Date.parse(l.last_outbound_at) : 0
          ),
        }))
        .sort((a, b) => b.sortKey - a.sortKey),
    [leads]
  );

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && conversations[0]) setSelected(conversations[0].chat_id);
  }, [conversations, selected]);

  const current = conversations.find((c) => c.chat_id === selected) ?? null;

  return (
    <div className="flex h-full">
      <ConversationsRail
        conversations={conversations}
        selected={selected}
        onSelect={setSelected}
      />
      <div className="flex-1 min-w-0 flex flex-col bg-zinc-100">
        {current ? (
          <ConversationPane
            key={current.chat_id}
            lead={current}
            onSent={onRefresh}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
            no conversations yet — once a lead has a chat_id it'll show here
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationsRail({
  conversations,
  selected,
  onSelect,
}: {
  conversations: (Lead & { sortKey: number })[];
  selected: string | null;
  onSelect: (chatId: string) => void;
}) {
  return (
    <aside className="w-80 shrink-0 border-r bg-white flex flex-col">
      <div className="px-4 py-3 border-b">
        <div className="text-sm font-medium">messages</div>
        <div className="text-[11px] text-zinc-500">
          {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="p-4 text-xs text-zinc-400">
            none yet. send to a lead to start one.
          </div>
        )}
        {conversations.map((c) => (
          <button
            key={c.chat_id}
            onClick={() => onSelect(c.chat_id)}
            className={`w-full text-left px-4 py-3 border-b hover:bg-zinc-50 ${
              selected === c.chat_id ? "bg-zinc-50" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm truncate">
                {c.name || c.phone || "unknown"}
              </div>
              <div className="text-[10px] text-zinc-400 shrink-0">
                {fmtShort(c.sortKey)}
              </div>
            </div>
            <div className="text-xs text-zinc-500 truncate">
              {c.last_excerpt || c.company || c.phone}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ConversationPane({
  lead,
  onSent,
}: {
  lead: Lead;
  onSent: () => void;
}) {
  const [messages, setMessages] = useState<ChertMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/inbox/messages?chat_id=${encodeURIComponent(lead.chat_id)}`
      );
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "failed to load");
        setMessages([]);
        return;
      }
      const sorted = (j.messages as ChertMessage[]).slice().sort((a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at)
      );
      setMessages(sorted);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [lead.chat_id]);

  useEffect(() => {
    void loadMessages();
    const t = setInterval(() => void loadMessages(), 5000);
    return () => clearInterval(t);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/inbox/send", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ chat_id: lead.chat_id, text }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "send failed");
        return;
      }
      setDraft("");
      await loadMessages();
      onSent();
    } finally {
      setSending(false);
    }
  }

  async function react(messageId: string, reaction: string) {
    setReactingId(null);
    try {
      await fetch("/api/inbox/react", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ message_id: messageId, reaction }),
      });
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <>
      <div className="px-5 py-3 border-b bg-white flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">{lead.name || "—"}</div>
          <div className="text-[11px] text-zinc-500 font-mono">{lead.phone}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={lead.status} />
          {loading && (
            <span className="text-[11px] text-zinc-400">loading…</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-1">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">
            {error}
          </div>
        )}
        {messages.length === 0 && !loading && !error && (
          <div className="text-center text-xs text-zinc-400 py-12">
            no messages in this thread yet
          </div>
        )}
        {messages.map((m, i) => {
          const text = (m.parts ?? [])
            .filter((p) => p.type === "text")
            .map((p) => p.value ?? "")
            .join(" ");
          const showTs =
            i === 0 ||
            Date.parse(m.created_at) - Date.parse(messages[i - 1].created_at) >
              5 * 60 * 1000;
          return (
            <div key={m.id}>
              {showTs && (
                <div className="text-center text-[10px] text-zinc-400 my-2">
                  {fmt(m.created_at)}
                </div>
              )}
              <Bubble
                direction={m.direction}
                text={text}
                reacting={reactingId === m.id}
                onClick={() =>
                  setReactingId(reactingId === m.id ? null : m.id)
                }
                onReact={(r) => react(m.id, r)}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-white p-3">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 border rounded-2xl px-4 py-2 text-sm resize-none h-11 max-h-40 focus:outline-none focus:border-zinc-400"
            placeholder="iMessage"
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="rounded-full bg-blue-500 text-white w-10 h-10 flex items-center justify-center disabled:opacity-40 hover:bg-blue-600"
            title="send"
          >
            ↑
          </button>
        </div>
        <div className="text-[10px] text-zinc-400 mt-1 px-1">
          enter to send · shift+enter for newline · click a bubble for tapbacks
        </div>
      </div>
    </>
  );
}

function Bubble({
  direction,
  text,
  reacting,
  onClick,
  onReact,
}: {
  direction: "inbound" | "outbound";
  text: string;
  reacting: boolean;
  onClick: () => void;
  onReact: (r: string) => void;
}) {
  const out = direction === "outbound";
  return (
    <div
      className={`flex ${
        out ? "justify-end" : "justify-start"
      } group relative`}
    >
      <div className="max-w-[75%] flex flex-col items-stretch">
        {reacting && (
          <div
            className={`flex gap-1 mb-1 bg-white border shadow-sm rounded-full px-2 py-1 ${
              out ? "self-end" : "self-start"
            }`}
          >
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(r.key);
                }}
                className="text-base hover:scale-125 transition-transform"
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onClick}
          className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap text-left ${
            out
              ? "bg-blue-500 text-white rounded-br-md"
              : "bg-white border rounded-bl-md text-zinc-900"
          }`}
        >
          {text || <span className="opacity-50">(non-text)</span>}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between border rounded-lg px-3 py-2 bg-white hover:bg-zinc-50"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`inline-block w-9 h-5 rounded-full relative transition-colors ${
          value ? "bg-black" : "bg-zinc-300"
        }`}
      >
        <span
          className={`absolute top-0.5 ${
            value ? "left-[18px]" : "left-0.5"
          } w-4 h-4 bg-white rounded-full shadow transition-all`}
        />
      </span>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "sent"
      ? "bg-blue-100 text-blue-800"
      : status === "responded"
      ? "bg-green-100 text-green-800"
      : status === "needs_attention"
      ? "bg-amber-100 text-amber-800"
      : status === "do_not_contact"
      ? "bg-red-100 text-red-800"
      : "bg-zinc-100 text-zinc-600";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status || "pending"}
    </span>
  );
}

function fmt(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function fmtShort(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
