import { useEffect, useMemo, useState } from "react"

export type AiSettings = {
  baseUrl: string
  apiKey: string
  model: string
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

type Mode = "cloud" | "local" | "custom"

const CLOUD_BASE = "https://ollama.com/v1"
const LOCAL_BASE_SUGGESTIONS = ["http://host.docker.internal:11434/v1", "http://localhost:11434/v1"]

function detectMode(baseUrl: string): Mode {
  const url = baseUrl.trim().toLowerCase()
  if (url === CLOUD_BASE.toLowerCase()) return "cloud"
  if (/localhost|127\.|host\.docker\.internal|\.local(:|$|\/)|^http:\/\/192\.168\.|^http:\/\/10\.|^http:\/\/172\.1[6-9]\.|^http:\/\/172\.2[0-9]\.|^http:\/\/172\.3[0-1]\./.test(url)) {
    return "local"
  }
  return "custom"
}

/**
 * Admin-only modal to configure the Ollama API key, base URL and model. The
 * saved API key is returned masked by the backend and re-PUTing the masked
 * value preserves it.
 */
export function AiSettingsDialog({ open, onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [keyDirty, setKeyDirty] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/app/api/ai/settings", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 403) throw new Error("Admin access required")
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return (await r.json()) as AiSettings
      })
      .then((s) => {
        setSettings(s)
        setError("")
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [open])

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
    } else if (m === "local") {
      if (detectMode(settings.baseUrl) !== "local") {
        setSettings({ ...settings, baseUrl: LOCAL_BASE_SUGGESTIONS[0] })
      }
    }
    // "custom" — leave the URL alone so the user can type freely.
  }

  if (!open) return null

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal__head">
          <div>
            <div className="gv-h3">AI assistant settings</div>
            <div className="hint mt-4">
              Connect an Ollama Cloud account. Admin-only — the key is shared
              with every dashboard user that uses the chat.
            </div>
          </div>
          <button className="pill-btn" onClick={onClose} style={{ height: 26, fontSize: 11.5 }}>
            Close
          </button>
        </div>
        <div className="modal__body">
          {loading ? (
            <div className="hint">Loading…</div>
          ) : !settings ? (
            <div style={{ color: "var(--st-low)", fontSize: 13 }}>{error || "Unavailable."}</div>
          ) : (
            <>
              <div>
                <div className="label">Where does the model run?</div>
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
                    ? "Cloud: gpt-oss:120b (flagship), gpt-oss:20b (faster)."
                    : mode === "local"
                      ? "Local: any tool-capable model you've pulled (llama3.1:8b-instruct, qwen2.5:7b-instruct, etc.)."
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
                  OpenAI-compatible endpoint. Must end with <span className="mono">/v1</span>.
                </div>
              </div>
              {keyDirty && !settings.apiKey.includes("•") ? (
                <div className="hint" style={{ color: "var(--st-in)" }}>
                  New API key will replace the stored one when you save.
                </div>
              ) : null}
              {error ? <div style={{ color: "var(--st-low)", fontSize: 12.5 }}>{error}</div> : null}
              {notice ? <div style={{ color: "var(--st-in)", fontSize: 12.5 }}>{notice}</div> : null}
            </>
          )}
        </div>
        <div className="modal__foot">
          <div className="hint mono">Stored in app_settings · key redacted on reads</div>
          <button className="pill-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="pill-btn is-primary"
            onClick={save}
            disabled={!settings || saving || loading}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
