"use client";

import { useEffect, useState, useCallback } from "react";

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
};

const SECRET_KEY = "chasi-chert:admin";

export default function Dashboard() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const s = localStorage.getItem(SECRET_KEY);
    if (s) {
      setSecret(s);
      setAuthed(true);
    }
  }, []);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    }),
    [secret]
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [s, l] = await Promise.all([
        fetch("/api/settings", { headers: headers() }).then((r) => r.json()),
        fetch("/api/leads", { headers: headers() }).then((r) => r.json()),
      ]);
      if (s.error) {
        setMsg(s.error);
        setAuthed(false);
        localStorage.removeItem(SECRET_KEY);
        return;
      }
      setSettings(s);
      setLeads(l.leads ?? []);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }, [headers]);

  useEffect(() => {
    if (authed) void refresh();
  }, [authed, refresh]);

  async function saveSettings(patch: Partial<Settings>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: headers(),
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
      const r = await fetch("/api/admin/send-now", {
        method: "POST",
        headers: headers(),
      });
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
        headers: headers(),
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

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50">
        <form
          className="w-full max-w-sm bg-white rounded-2xl border p-6 shadow-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            localStorage.setItem(SECRET_KEY, secret);
            setAuthed(true);
          }}
        >
          <h1 className="text-xl font-semibold">chasi-chert</h1>
          <p className="text-sm text-zinc-500">enter the admin secret</p>
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            autoFocus
          />
          <button className="w-full bg-black text-white rounded-lg py-2 font-medium">
            unlock
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">chasi-chert</h1>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={busy}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white"
          >
            refresh
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(SECRET_KEY);
              setAuthed(false);
              setSecret("");
            }}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white"
          >
            sign out
          </button>
        </div>
      </header>

      {msg && (
        <div className="rounded-lg border bg-white p-3 text-xs font-mono whitespace-pre-wrap break-all">
          {msg}
        </div>
      )}

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
    </main>
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
