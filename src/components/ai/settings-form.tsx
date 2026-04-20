import { useEffect, useMemo, useState } from "react"

export type AiSettings = {
  baseUrl: string
  apiKey: string
  model: string
}

type Mode = "cloud" | "local" | "custom"

const CLOUD_BASE = "https://ollama.com/v1"
const LOCAL_BASE_SUGGESTIONS = ["http://host.docker.internal:11434/v1", "http://localhost:11434/v1"]

function detectMode(baseUrl: string): Mode {
  const url = baseUrl.trim().toLowerCase()
  if (url === CLOUD_BASE.toLowerCase()) return "cloud"
  if (
    /localhost|127\.|host\.docker\.internal|\.local(:|$|\/)|^http:\/\/192\.168\.|^http:\/\/10\.|^http:\/\/172\.1[6-9]\.|^http:\/\/172\.2[0-9]\.|^http:\/\/172\.3[0-1]\./.test(
      url,
    )
  ) {
    return "local"
  }
  return "custom"
}

/**
 * Admin-only form for configuring the Glyco assistant's upstream endpoint.
 * Used standalone on the Settings page. All network I/O is self-contained —
 * render it anywhere a panel body fits.
 */
export function AiSettingsForm({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [keyDirty, setKeyDirty] = useState(false)

  const load = () => {
    setLoading(true)
    fetch("/app/api/ai/settings", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 403) throw new Error("Admin access required to view AI settings")
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return (await r.json()) as AiSettings
      })
      .then((s) => {
        setSettings(s)
        setError("")
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const res = await fetch("/app/api/ai/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }))
        throw new Error(body.message || "save failed")
      }
      const saved = (await res.json()) as AiSettings
      setSettings(saved)
      setKeyDirty(false)
      setNotice("Saved.")
      onSaved?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const mode = useMemo<Mode>(() => (settings ? detectMode(settings.baseUrl) : "cloud"), [settings])

  const setMode = (m: Mode) => {
    if (!settings) return
    if (m === "cloud") {
      setSettings({ ...settings, baseUrl: CLOUD_BASE })
    } else if (m === "local" && detectMode(settings.baseUrl) !== "local") {
      setSettings({ ...settings, baseUrl: LOCAL_BASE_SUGGESTIONS[0] })
    }
    // "custom" — leave the URL alone so the user can type freely.
  }

  if (loading && !settings) {
    return <div className="hint" style={{ padding: 16 }}>Loading…</div>
  }
  if (!settings) {
    return (
      <div style={{ padding: 16, color: "var(--st-low)", fontSize: 13 }}>
        {error || "Unavailable."}
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div>
        <div className="label">Where does Glyco run?</div>
        <div className="seg" style={{ gridAutoColumns: "1fr 1fr 1fr" }}>
          <button
            type="button"
            className={mode === "cloud" ? "is-active" : ""}
            onClick={() => setMode("cloud")}
          >
            Ollama Cloud
          </button>
          <button
            type="button"
            className={mode === "local" ? "is-active" : ""}
            onClick={() => setMode("local")}
          >
            Local Ollama
          </button>
          <button
            type="button"
            className={mode === "custom" ? "is-active" : ""}
            onClick={() => setMode("custom")}
          >
            Custom
          </button>
        </div>
        <div className="help">
          {mode === "cloud"
            ? "Uses ollama.com with your API key. Works from anywhere."
            : mode === "local"
              ? "Points at a local Ollama server (no API key required). From Docker, use host.docker.internal instead of localhost."
              : "Any OpenAI-compatible /v1/chat/completions endpoint."}
        </div>
      </div>

      <div>
        <div className="label">
          API key{mode === "local" ? " (optional for local servers)" : ""}
        </div>
        <input
          className="input mono"
          type={showKey ? "text" : "password"}
          value={settings.apiKey}
          onChange={(e) => {
            setKeyDirty(true)
            setSettings({ ...settings, apiKey: e.target.value })
          }}
          placeholder={mode === "local" ? "leave blank" : "olla_••••••••"}
          autoComplete="off"
        />
        <div className="row between mt-4">
          <span className="help">
            {mode === "local"
              ? "Local Ollama ignores this field. Leave blank unless you've set OLLAMA_API_KEY on the server."
              : "Keep the masked value to leave the saved key unchanged."}
          </span>
          <button
            type="button"
            className="hint"
            onClick={() => setShowKey((v) => !v)}
            style={{ fontSize: 11.5, color: "var(--ink-4)" }}
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div className="label">Model</div>
          <input
            className="input mono"
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            placeholder={mode === "local" ? "llama3.1:8b-instruct" : "gpt-oss:120b"}
          />
          <div className="help">
            Must be a tool-capable model.{" "}
            {mode === "cloud"
              ? "Cloud: gpt-oss:120b, gpt-oss:20b."
              : mode === "local"
                ? "Local: any tool-capable model you've pulled."
                : "Anything your endpoint supports with OpenAI-style tools."}
          </div>
        </div>
        <div>
          <div className="label">Base URL</div>
          <input
            className="input mono"
            value={settings.baseUrl}
            onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
            placeholder="https://ollama.com/v1"
          />
          <div className="help">
            OpenAI-compatible endpoint — must end with <span className="mono">/v1</span>.
          </div>
        </div>
      </div>

      {keyDirty && !settings.apiKey.includes("•") ? (
        <div className="hint" style={{ color: "var(--st-in)" }}>
          New API key will replace the stored one when you save.
        </div>
      ) : null}
      {error ? <div style={{ color: "var(--st-low)", fontSize: 12.5 }}>{error}</div> : null}
      {notice ? <div style={{ color: "var(--st-in)", fontSize: 12.5 }}>{notice}</div> : null}

      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span className="hint mono" style={{ fontSize: 11 }}>
            Stored in app_settings · key redacted on reads
          </span>
        </div>
        <button className="pill-btn is-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Glyco settings"}
        </button>
      </div>
    </div>
  )
}
