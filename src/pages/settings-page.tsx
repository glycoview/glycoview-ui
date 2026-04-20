import { useEffect, useMemo, useState } from "react"

import { KV } from "@/components/dashboard/primitives"
import {
  applyUpdate,
  configureDynamicDNS,
  configureTLS,
  fetchDynamicDNSConfig,
  fetchDynamicDNSProviders,
  fetchSettingsStatus,
  fetchTLSConfig,
  fetchTLSProviders,
  fetchUpdateCheck,
  rollbackUpdate,
  syncDynamicDNS,
} from "@/lib/api"
import type { ApiError } from "@/lib/api"
import { AiSettingsForm } from "@/components/ai/settings-form"
import { Icons } from "@/lib/design-icons"
import { COMMON_TIMEZONES, browserTimeZone } from "@/lib/time"
import type {
  ApplianceDynamicDNSConfig,
  ApplianceStatus,
  ApplianceTLSConfig,
  ChallengeOption,
  DynamicDNSProvider,
  TLSProvider,
  UpdateCheckResponse,
} from "@/types"

type DisplayState = {
  units: "mg/dL" | "mmol/L"
  theme: "light" | "dark"
  density: "compact" | "default" | "airy"
  agpBands: "on" | "off"
  timeZone: string
}

const STORAGE_KEY = "gv_display_prefs"

function defaultPrefs(): DisplayState {
  return {
    units: "mg/dL",
    theme: "light",
    density: "default",
    agpBands: "on",
    timeZone: "auto",
  }
}

function loadPrefs(): DisplayState {
  if (typeof window === "undefined") return defaultPrefs()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return defaultPrefs()
}

type TLSForm = {
  domain: string
  email: string
  challengeType: "http-01" | "dns-01"
  provider: string
  env: Record<string, string>
}

type DynDNSForm = {
  enabled: boolean
  provider: string
  zone: string
  recordName: string
  env: Record<string, string>
}

export function SettingsPage() {
  const [prefs, setPrefs] = useState<DisplayState>(loadPrefs)
  const [status, setStatus] = useState<ApplianceStatus | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null)
  const [providers, setProviders] = useState<TLSProvider[]>([])
  const [challenges, setChallenges] = useState<ChallengeOption[]>([])
  const [dynamicDNSProviders, setDynamicDNSProviders] = useState<DynamicDNSProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [updateTag, setUpdateTag] = useState("")
  const [tlsForm, setTLSForm] = useState<TLSForm>({
    domain: "",
    email: "",
    challengeType: "http-01",
    provider: "",
    env: {},
  })
  const [dynForm, setDynForm] = useState<DynDNSForm>({
    enabled: false,
    provider: "",
    zone: "",
    recordName: "",
    env: {},
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefs.theme === "dark")
    document.documentElement.dataset.density = prefs.density
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
  }, [prefs])

  const setPref = <K extends keyof DisplayState>(k: K, v: DisplayState[K]) =>
    setPrefs((p) => ({ ...p, [k]: v }))

  const selectedTLSProvider = useMemo(
    () => providers.find((p) => p.id === tlsForm.provider) ?? null,
    [providers, tlsForm.provider],
  )
  const selectedDynProvider = useMemo(
    () => dynamicDNSProviders.find((p) => p.id === dynForm.provider) ?? null,
    [dynamicDNSProviders, dynForm.provider],
  )

  const load = async () => {
    setLoading(true)
    try {
      const [statusRes, updateRes, providersRes, tlsRes, dynProvRes, dynRes] =
        await Promise.all([
          fetchSettingsStatus(),
          fetchUpdateCheck(),
          fetchTLSProviders(),
          fetchTLSConfig(),
          fetchDynamicDNSProviders(),
          fetchDynamicDNSConfig(),
        ])
      setStatus(statusRes)
      setUpdateInfo(updateRes)
      setProviders(providersRes.providers)
      setChallenges(providersRes.challenges ?? [])
      setDynamicDNSProviders(dynProvRes.providers)
      setUpdateTag(updateRes.latestTag || statusRes.currentTag || "")
      setTLSForm({
        domain: tlsRes.domain || "",
        email: tlsRes.email || "",
        challengeType: tlsRes.challengeType === "dns-01" ? "dns-01" : "http-01",
        provider: tlsRes.provider || providersRes.providers[0]?.id || "",
        env: tlsRes.env || {},
      })
      setDynForm({
        enabled: dynRes.enabled,
        provider: dynRes.provider || dynProvRes.providers[0]?.id || "",
        zone: dynRes.zone || "",
        recordName: dynRes.recordName || "",
        env: dynRes.env || {},
      })
      setError("")
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
  }, [])

  const submitUpdate = async () => {
    if (!updateTag.trim()) return
    setBusy("update")
    setMessage("")
    setError("")
    try {
      // includeAgent is always false: the agent cannot safely restart itself
      // mid-deploy. Upgrading the agent requires reflashing the Pi image.
      const result = await applyUpdate({ tag: updateTag.trim(), includeAgent: false })
      setMessage(result.message || "Update applied")
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to apply update")
    } finally {
      setBusy("")
    }
  }

  const submitRollback = async () => {
    setBusy("rollback")
    setMessage("")
    setError("")
    try {
      const result = await rollbackUpdate()
      setMessage(result.message || "Rollback started")
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to roll back update")
    } finally {
      setBusy("")
    }
  }

  const submitTLS = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy("tls")
    setMessage("")
    setError("")
    try {
      const payload: ApplianceTLSConfig = {
        domain: tlsForm.domain.trim(),
        email: tlsForm.email.trim(),
        challengeType: tlsForm.challengeType,
        provider: tlsForm.challengeType === "dns-01" ? tlsForm.provider : "",
        env: tlsForm.challengeType === "dns-01" ? tlsForm.env : {},
      }
      const result = await configureTLS(payload)
      setMessage(result.message || "TLS configuration saved")
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to save TLS settings")
    } finally {
      setBusy("")
    }
  }

  const submitDynDNS = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy("dyndns")
    setMessage("")
    setError("")
    try {
      const payload: ApplianceDynamicDNSConfig = {
        enabled: dynForm.enabled,
        provider: dynForm.enabled ? dynForm.provider : "",
        zone: dynForm.enabled ? dynForm.zone.trim() : "",
        recordName: dynForm.enabled ? dynForm.recordName.trim() : "",
        env: dynForm.enabled ? dynForm.env : {},
      }
      const result = await configureDynamicDNS(payload)
      setMessage(result.message || "Dynamic DNS saved")
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to save dynamic DNS settings")
    } finally {
      setBusy("")
    }
  }

  const syncDynDNS = async () => {
    setBusy("dyndns-sync")
    setMessage("")
    setError("")
    try {
      const result = await syncDynamicDNS()
      setMessage(result.message || "Dynamic DNS synced")
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to sync dynamic DNS")
    } finally {
      setBusy("")
    }
  }

  const updateAvailable = !!updateInfo?.updateAvailable
  const currentTag = status?.currentTag || "—"
  const latestTag = updateInfo?.latestTag || currentTag
  const tlsAppliedAt = status?.tls?.appliedAt
  const dynLastSyncedAt = status?.dynamicDns?.lastSyncedAt
  const dynLastError = status?.dynamicDns?.lastError

  return (
    <>
      {error ? (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            padding: 14,
            borderColor: "color-mix(in oklch, var(--st-low) 40%, var(--line))",
            color: "var(--st-low)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            padding: 14,
            borderColor: "color-mix(in oklch, var(--st-in) 40%, var(--line))",
            color: "var(--st-in)",
            fontSize: 13,
          }}
        >
          {message}
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head">
          <div className="flex-1">
            <div className="gv-h3">Display preferences</div>
            <div className="hint mt-4">Units, theme and chart density. Stored per device.</div>
          </div>
        </div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <div>
            <div className="label">Glucose units</div>
            <div className="seg">
              {(["mg/dL", "mmol/L"] as const).map((u) => (
                <button
                  key={u}
                  className={prefs.units === u ? "is-active" : ""}
                  onClick={() => setPref("units", u)}
                >
                  {u}
                </button>
              ))}
            </div>
            <div className="help">mmol/L = mg/dL ÷ 18.016</div>
          </div>
          <div>
            <div className="label">Theme</div>
            <div className="seg">
              {(["light", "dark"] as const).map((v) => (
                <button
                  key={v}
                  className={prefs.theme === v ? "is-active" : ""}
                  onClick={() => setPref("theme", v)}
                >
                  {v === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Density</div>
            <div className="seg">
              {(["compact", "default", "airy"] as const).map((m) => (
                <button
                  key={m}
                  className={prefs.density === m ? "is-active" : ""}
                  onClick={() => setPref("density", m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">AGP percentile bands</div>
            <div className="seg">
              {(
                [
                  ["on", "Show"],
                  ["off", "Hide"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  className={prefs.agpBands === v ? "is-active" : ""}
                  onClick={() => setPref("agpBands", v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <div className="label">Time zone</div>
            <select
              className="input mono"
              value={prefs.timeZone}
              onChange={(e) => setPref("timeZone", e.target.value)}
            >
              {COMMON_TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z === "auto" ? `Auto (${browserTimeZone()})` : z}
                </option>
              ))}
            </select>
            <div className="help">
              All timestamps, daily traces and hour ticks render in this zone.
              Reload after changing if a chart was already on screen.
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head">
          <div className="flex-1">
            <div className="gv-h3">Glyco · AI assistant</div>
            <div className="hint mt-4">
              Connect an Ollama Cloud API key or point Glyco at a local Ollama
              server. Admin-only — the key is shared with every dashboard user
              who opens Glyco.
            </div>
          </div>
        </div>
        <AiSettingsForm />
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head">
          <div className="flex-1">
            <div className="gv-h3">Appliance</div>
            <div className="hint mt-4">
              {loading
                ? "Loading appliance status…"
                : status?.dockerManaged
                  ? "Docker-managed appliance · controls below require the glycoview-agent"
                  : "Running outside Docker · update controls are unavailable"}
            </div>
          </div>
          {status ? (
            <span className="badge badge--in">
              <span className="dot" />
              {status.dockerManaged ? "Healthy" : "Standalone"}
            </span>
          ) : null}
        </div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <KV k="App tag" v={currentTag} />
          <KV k="Agent tag" v={status?.currentAgentTag || "—"} />
          <KV k="Stack" v={status?.stackName || "—"} />
          <KV
            k="Last action"
            v={status?.lastAction ? `${status.lastAction}${status.lastActionAt ? " · " + timeAgo(status.lastActionAt) : ""}` : "None"}
          />
          <KV k="Stack file" v={status?.stackFile || "—"} mono />
          <KV k="Public IP" v={status?.currentPublicIp || "—"} mono />
          <KV k="Image" v={status?.currentImage || "—"} mono />
          <KV k="Agent image" v={status?.currentAgentImage || "—"} mono />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head">
          <div className="flex-1">
            <div className="gv-h3">Updates</div>
            <div className="hint mt-4">
              Current <span className="mono">{currentTag}</span>
              {latestTag && latestTag !== currentTag ? (
                <>
                  {" · "}latest <span className="mono">{latestTag}</span>
                </>
              ) : null}
              {updateInfo?.source ? (
                <>
                  {" · "}source <span className="mono">{updateInfo.source}</span>
                </>
              ) : null}
            </div>
          </div>
          {updateInfo?.releaseUrl ? (
            <a className="pill-btn" href={updateInfo.releaseUrl} target="_blank" rel="noreferrer">
              Release notes
            </a>
          ) : null}
        </div>
        <div
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <div>
            <div className="label">Target tag</div>
            <input
              className="input mono"
              value={updateTag}
              onChange={(e) => setUpdateTag(e.target.value)}
              placeholder={latestTag}
              disabled={!status?.dockerManaged}
            />
          </div>
          <button
            className="pill-btn"
            onClick={submitRollback}
            disabled={busy !== "" || !status?.dockerManaged}
          >
            <Icons.Refresh size={13} />
            {busy === "rollback" ? "Rolling back…" : "Rollback"}
          </button>
          <button
            className="pill-btn is-primary"
            onClick={submitUpdate}
            disabled={
              busy !== "" || !updateTag.trim() || !status?.dockerManaged
            }
            title={!status?.dockerManaged ? "Not available outside Docker" : undefined}
          >
            <Icons.Play size={13} />
            {busy === "update"
              ? "Applying…"
              : updateAvailable
                ? "Apply update"
                : "Reapply"}
          </button>
        </div>
        <div
          className="hint"
          style={{ padding: "0 16px 16px", color: "var(--ink-4)" }}
        >
          {!status?.dockerManaged && !loading
            ? "Updates are managed by the glycoview-agent on your Raspberry Pi. When this dashboard runs outside the appliance, use the host-side CLI."
            : "Applies the dashboard image only. The appliance agent is upgraded by flashing a new Pi image."}
        </div>
      </div>

      <div className="gv-grid gv-grid-2">
        <form className="panel" onSubmit={submitTLS}>
          <div className="panel__head">
            <div className="gv-h3 flex-1">TLS &amp; public hostname</div>
            {tlsAppliedAt ? (
              <span className="badge badge--in">
                <span className="dot" />
                Applied {timeAgo(tlsAppliedAt)}
              </span>
            ) : (
              <span className="badge">Not applied</span>
            )}
          </div>
          <div style={{ padding: 16, display: "grid", gap: 14 }}>
            <div>
              <div className="label">Public domain</div>
              <input
                className="input mono"
                value={tlsForm.domain}
                onChange={(e) =>
                  setTLSForm((p) => ({ ...p, domain: e.target.value }))
                }
                placeholder="my-glycoview.duckdns.org"
              />
              <div className="help">
                The hostname your pump apps and shared viewers will connect to.
              </div>
            </div>
            <div>
              <div className="label">Let's Encrypt email</div>
              <input
                className="input"
                value={tlsForm.email}
                onChange={(e) =>
                  setTLSForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="you@example.com"
              />
              <div className="help">Used for expiry notifications only.</div>
            </div>
            {challenges.length > 0 ? (
              <div>
                <div className="label">Challenge</div>
                <div className="seg" style={{ gridAutoColumns: "1fr 1fr" }}>
                  {challenges.map((ch) => (
                    <button
                      type="button"
                      key={ch.id}
                      className={tlsForm.challengeType === ch.id ? "is-active" : ""}
                      onClick={() =>
                        setTLSForm((p) => ({
                          ...p,
                          challengeType: ch.id === "dns-01" ? "dns-01" : "http-01",
                          provider:
                            ch.id === "dns-01"
                              ? p.provider || providers[0]?.id || ""
                              : "",
                        }))
                      }
                    >
                      {ch.label}
                      {ch.recommended ? " · recommended" : ""}
                    </button>
                  ))}
                </div>
                {tlsForm.challengeType === "dns-01" ? (
                  <div className="help">DNS-01 works behind any router without port forwarding.</div>
                ) : (
                  <div className="help">HTTP-01 requires port 80 forwarded to the appliance.</div>
                )}
              </div>
            ) : null}
            {tlsForm.challengeType === "dns-01" ? (
              <div>
                <div className="label">DNS provider</div>
                <select
                  className="input"
                  value={tlsForm.provider}
                  onChange={(e) =>
                    setTLSForm((p) => ({ ...p, provider: e.target.value, env: {} }))
                  }
                >
                  <option value="">Select provider…</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {selectedTLSProvider ? (
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {selectedTLSProvider.fields.map((field) => (
                      <div key={field.key}>
                        <div className="label">{field.label}</div>
                        <input
                          className="input mono"
                          type={field.secret ? "password" : "text"}
                          value={tlsForm.env[field.key] || ""}
                          placeholder={field.placeholder}
                          onChange={(e) =>
                            setTLSForm((p) => ({
                              ...p,
                              env: { ...p.env, [field.key]: e.target.value },
                            }))
                          }
                        />
                        {field.help ? <div className="help">{field.help}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="row" style={{ marginTop: 4 }}>
              <div style={{ flex: 1 }} />
              <button type="submit" className="pill-btn is-primary" disabled={busy !== ""}>
                {busy === "tls" ? "Saving…" : "Save TLS settings"}
              </button>
            </div>
          </div>
        </form>

        <form className="panel" onSubmit={submitDynDNS}>
          <div className="panel__head">
            <div className="gv-h3 flex-1">Dynamic DNS</div>
            {dynLastError ? (
              <span className="badge badge--low">
                <span className="dot" />
                Error
              </span>
            ) : status?.dynamicDns?.enabled ? (
              <span className="badge badge--in">
                <span className="dot" />
                {dynLastSyncedAt ? `Synced ${timeAgo(dynLastSyncedAt)}` : "Active"}
              </span>
            ) : (
              <span className="badge">Disabled</span>
            )}
          </div>
          <div style={{ padding: 16, display: "grid", gap: 14 }}>
            <label className="row" style={{ gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={dynForm.enabled}
                onChange={(e) => setDynForm((p) => ({ ...p, enabled: e.target.checked }))}
              />
              Keep public IP updated every 5 minutes
            </label>
            <div>
              <div className="label">Provider</div>
              <select
                className="input"
                value={dynForm.provider}
                onChange={(e) => setDynForm((p) => ({ ...p, provider: e.target.value, env: {} }))}
                disabled={!dynForm.enabled}
              >
                <option value="">Select provider…</option>
                {dynamicDNSProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div className="label">Zone</div>
                <input
                  className="input mono"
                  value={dynForm.zone}
                  onChange={(e) => setDynForm((p) => ({ ...p, zone: e.target.value }))}
                  placeholder="duckdns.org"
                  disabled={!dynForm.enabled}
                />
              </div>
              <div>
                <div className="label">Record</div>
                <input
                  className="input mono"
                  value={dynForm.recordName}
                  onChange={(e) => setDynForm((p) => ({ ...p, recordName: e.target.value }))}
                  placeholder="my-glycoview"
                  disabled={!dynForm.enabled}
                />
              </div>
            </div>
            {selectedDynProvider && dynForm.enabled ? (
              <div style={{ display: "grid", gap: 10 }}>
                {selectedDynProvider.fields.map((field) => (
                  <div key={field.key}>
                    <div className="label">{field.label}</div>
                    <input
                      className="input mono"
                      type={field.secret ? "password" : "text"}
                      value={dynForm.env[field.key] || ""}
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        setDynForm((p) => ({
                          ...p,
                          env: { ...p.env, [field.key]: e.target.value },
                        }))
                      }
                    />
                    {field.help ? <div className="help">{field.help}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                padding: 12,
                background: "var(--bg-2)",
                borderRadius: 10,
                border: "1px solid var(--line)",
              }}
            >
              <KV
                k="Last IP"
                v={status?.currentPublicIp || status?.dynamicDns?.lastKnownIp || "—"}
                mono
              />
              <KV
                k="Checked"
                v={status?.dynamicDns?.lastCheckedAt ? timeAgo(status.dynamicDns.lastCheckedAt) : "Never"}
              />
              <KV
                k="Synced"
                v={dynLastSyncedAt ? timeAgo(dynLastSyncedAt) : "Never"}
              />
            </div>
            {dynLastError ? (
              <div className="help" style={{ color: "var(--st-low)" }}>
                Last error: {dynLastError}
              </div>
            ) : null}
            <div className="row">
              <button
                type="button"
                className="pill-btn"
                onClick={syncDynDNS}
                disabled={busy !== "" || !status?.dynamicDns?.enabled}
              >
                <Icons.Refresh size={13} />
                {busy === "dyndns-sync" ? "Syncing…" : "Sync now"}
              </button>
              <div style={{ flex: 1 }} />
              <button type="submit" className="pill-btn is-primary" disabled={busy !== ""}>
                {busy === "dyndns" ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}

function timeAgo(input: string | Date): string {
  const then = input instanceof Date ? input.getTime() : new Date(input).getTime()
  if (!Number.isFinite(then)) return "—"
  const diff = Date.now() - then
  const mins = Math.max(0, Math.round(diff / 60000))
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
