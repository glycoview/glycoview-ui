import { useState } from "react"

import { setup } from "@/lib/api"
import type { ApiError } from "@/lib/api"
import { BrandMark, Icons } from "@/lib/design-icons"

export function SetupPage({ onComplete }: { onComplete: () => Promise<unknown> }) {
  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const response = await setup(username, password, displayName)
      setApiSecret(response.apiSecret)
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Setup failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-bg">
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div className="row" style={{ marginBottom: 20 }}>
          <div className="brand__mark">
            <BrandMark size={22} />
          </div>
          <div style={{ marginLeft: 10 }}>
            <b style={{ fontSize: 14 }}>Glycoview · first-run setup</b>
            <div className="hint">This step appears once on a fresh install.</div>
          </div>
        </div>

        <div className="panel" style={{ padding: 32 }}>
          {apiSecret ? (
            <>
              <div className="gv-h1">Save the Nightscout API secret</div>
              <div className="sub mt-8">
                Use this secret for local development or compatible Nightscout clients. This
                value is tied to this install.
              </div>
              <div
                style={{
                  marginTop: 20,
                  padding: 14,
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  background: "var(--bg-2)",
                }}
              >
                <div className="kicker">API secret</div>
                <code
                  className="mono"
                  style={{
                    display: "block",
                    marginTop: 10,
                    fontSize: 13,
                    overflowX: "auto",
                    color: "var(--ink)",
                  }}
                >
                  {apiSecret}
                </code>
              </div>
              <div className="row" style={{ marginTop: 20, gap: 10 }}>
                <button
                  type="button"
                  className="pill-btn"
                  onClick={() => navigator.clipboard?.writeText(apiSecret)}
                >
                  <Icons.Copy size={13} />
                  Copy
                </button>
                <button
                  type="button"
                  className="pill-btn is-primary"
                  onClick={() => void onComplete()}
                >
                  Continue to dashboard
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="gv-h1">Create first admin</div>
              <div className="sub mt-8">
                Set up the first dashboard account for this self-hosted installation.
              </div>
              <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 22 }}>
                <div>
                  <div className="label">Display name</div>
                  <input
                    className="input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Dr. Alex Reyes"
                    autoFocus
                  />
                </div>
                <div>
                  <div className="label">Username</div>
                  <input
                    className="input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="areyes"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <div className="label">Password</div>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div
                  style={{
                    padding: 12,
                    background: "var(--bg-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                  }}
                >
                  <div className="kicker">After creation</div>
                  <div className="hint mt-4">
                    We'll generate a Nightscout-compatible API secret for your first patient
                    link.
                  </div>
                </div>
                {error ? (
                  <div style={{ color: "var(--st-low)", fontSize: 12.5 }}>{error}</div>
                ) : null}
                <button
                  type="submit"
                  className="pill-btn is-primary"
                  style={{ height: 38, justifyContent: "center", fontSize: 13 }}
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create admin"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
