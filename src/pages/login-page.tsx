import { useState } from "react"

import { login } from "@/lib/api"
import type { ApiError } from "@/lib/api"
import { BrandMark } from "@/lib/design-icons"

export function LoginPage({
  onSuccess,
  appVersion,
}: {
  onSuccess: () => Promise<unknown>
  appVersion?: string
}) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      await login(username, password)
      await onSuccess()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Login failed")
    } finally {
      setSubmitting(false)
    }
  }

  const hostname = typeof window !== "undefined" ? window.location.hostname : ""
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:"

  return (
    <div className="auth-bg">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 440px) minmax(0, 1fr)",
          gap: 40,
          width: "100%",
          maxWidth: 960,
        }}
      >
        <div className="panel" style={{ padding: 32 }}>
          <div className="row" style={{ marginBottom: 24 }}>
            <div className="brand__mark">
              <BrandMark size={24} />
            </div>
            <div style={{ marginLeft: 10 }}>
              <b style={{ fontSize: 14, letterSpacing: "-0.015em" }}>Glycoview</b>
              <div className="hint">Self-hosted clinical CGM</div>
            </div>
          </div>
          <div className="gv-h1">Sign in</div>
          <div className="sub mt-8">Use your clinical dashboard account.</div>
          <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 22 }}>
            <div>
              <div className="label">Username</div>
              <input
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <div className="label">Password</div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
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
              {submitting ? "Signing in…" : "Sign in"}
            </button>
            <div className="row between hint">
              <a href="#">Forgot password?</a>
              {appVersion ? <span className="mono">{appVersion}</span> : null}
            </div>
          </form>
        </div>

        <div style={{ padding: 32, alignSelf: "center", color: "var(--ink-3)" }}>
          <div className="kicker">Your appliance</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              marginTop: 6,
            }}
          >
            {hostname || "glycoview"}
          </div>
          <div className="mono hint mt-8">
            {isSecure ? "TLS · self-hosted" : "self-hosted"}
            {appVersion ? ` · ${appVersion}` : ""}
          </div>
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              color: "var(--ink-3)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0, color: "var(--ink)" }}>What this dashboard is</p>
            <p style={{ margin: "8px 0 0" }}>
              A self-hosted clinical dashboard for your Nightscout-compatible data.
              Sign in with a clinician or admin account to review glucose trends,
              daily traces and loop status.
            </p>
            <p className="hint" style={{ margin: "8px 0 0", fontSize: 11.5 }}>
              Pump, CGM and loop data are visible to signed-in users only.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
