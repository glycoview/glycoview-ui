import { useEffect, useState } from "react"

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
                <div className="label">API key</div>
                <input
                  className="input mono"
                  type={showKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) => {
                    setKeyDirty(true)
                    setSettings({ ...settings, apiKey: e.target.value })
                  }}
                  placeholder="olla_••••••••"
                  autoComplete="off"
                />
                <div className="row between mt-4">
                  <span className="help">
                    Keep the masked value to leave the saved key unchanged.
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
                  placeholder="gpt-oss:120b"
                />
                <div className="help">
                  Tool-capable Ollama Cloud models only (e.g. gpt-oss:120b,
                  gpt-oss:20b, qwen3-coder:*).
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
                  OpenAI-compatible endpoint. Usually leave as default.
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
