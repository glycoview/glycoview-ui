import { type ReactNode, useEffect, useMemo, useState } from "react"

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
import type { ApplianceDynamicDNSConfig, ApplianceStatus, ApplianceTLSConfig, ChallengeOption, DynamicDNSProvider, TLSProvider, UpdateCheckResponse } from "@/types"
import { DashboardSection } from "@/components/dashboard/section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TLSForm = {
  domain: string
  email: string
  challengeType: "http-01" | "dns-01"
  provider: string
  env: Record<string, string>
}

type DynamicDNSForm = {
  enabled: boolean
  provider: string
  zone: string
  recordName: string
  env: Record<string, string>
}

export function SettingsPage() {
  const [status, setStatus] = useState<ApplianceStatus | null>(null)
  const [update, setUpdate] = useState<UpdateCheckResponse | null>(null)
  const [providers, setProviders] = useState<TLSProvider[]>([])
  const [challenges, setChallenges] = useState<ChallengeOption[]>([])
  const [dynamicDNSProviders, setDynamicDNSProviders] = useState<DynamicDNSProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [updateTag, setUpdateTag] = useState("")
  const [includeAgent, setIncludeAgent] = useState(true)
  const [tlsForm, setTLSForm] = useState<TLSForm>({
    domain: "",
    email: "",
    challengeType: "http-01",
    provider: "",
    env: {},
  })
  const [dynamicDNSForm, setDynamicDNSForm] = useState<DynamicDNSForm>({
    enabled: false,
    provider: "",
    zone: "",
    recordName: "",
    env: {},
  })

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === tlsForm.provider) ?? null,
    [providers, tlsForm.provider],
  )
  const selectedDynamicDNSProvider = useMemo(
    () => dynamicDNSProviders.find((provider) => provider.id === dynamicDNSForm.provider) ?? null,
    [dynamicDNSProviders, dynamicDNSForm.provider],
  )

  const load = async () => {
    setLoading(true)
    try {
      const [statusResponse, updateResponse, providersResponse, tlsResponse, dynamicDNSProvidersResponse, dynamicDNSResponse] = await Promise.all([
        fetchSettingsStatus(),
        fetchUpdateCheck(),
        fetchTLSProviders(),
        fetchTLSConfig(),
        fetchDynamicDNSProviders(),
        fetchDynamicDNSConfig(),
      ])
      setStatus(statusResponse)
      setUpdate(updateResponse)
      setProviders(providersResponse.providers)
      setChallenges(providersResponse.challenges ?? [])
      setDynamicDNSProviders(dynamicDNSProvidersResponse.providers)
      setUpdateTag(updateResponse.latestTag || statusResponse.currentTag)
      setTLSForm({
        domain: tlsResponse.domain || "",
        email: tlsResponse.email || "",
        challengeType: tlsResponse.challengeType === "dns-01" ? "dns-01" : "http-01",
        provider: tlsResponse.provider || providersResponse.providers[0]?.id || "",
        env: tlsResponse.env || {},
      })
      setDynamicDNSForm({
        enabled: dynamicDNSResponse.enabled,
        provider: dynamicDNSResponse.provider || dynamicDNSProvidersResponse.providers[0]?.id || "",
        zone: dynamicDNSResponse.zone || "",
        recordName: dynamicDNSResponse.recordName || "",
        env: dynamicDNSResponse.env || {},
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

  const submitTLS = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy("tls")
    setMessage("")
    setError("")
    try {
      const payload: ApplianceTLSConfig = {
        domain: tlsForm.domain,
        email: tlsForm.email,
        challengeType: tlsForm.challengeType,
        provider: tlsForm.challengeType === "dns-01" ? tlsForm.provider : "",
        env: tlsForm.challengeType === "dns-01" ? tlsForm.env : {},
      }
      const result = await configureTLS(payload)
      setMessage(result.message)
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to save TLS settings")
    } finally {
      setBusy("")
    }
  }

  const submitUpdate = async () => {
    setBusy("update")
    setMessage("")
    setError("")
    try {
      const result = await applyUpdate({ tag: updateTag, includeAgent })
      setMessage(result.message)
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to apply update")
    } finally {
      setBusy("")
    }
  }

  const submitDynamicDNS = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy("dyndns")
    setMessage("")
    setError("")
    try {
      const payload: ApplianceDynamicDNSConfig = {
        enabled: dynamicDNSForm.enabled,
        provider: dynamicDNSForm.enabled ? dynamicDNSForm.provider : "",
        zone: dynamicDNSForm.enabled ? dynamicDNSForm.zone : "",
        recordName: dynamicDNSForm.enabled ? dynamicDNSForm.recordName : "",
        env: dynamicDNSForm.enabled ? dynamicDNSForm.env : {},
      }
      const result = await configureDynamicDNS(payload)
      setMessage(result.message)
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to save dynamic DNS settings")
    } finally {
      setBusy("")
    }
  }

  const triggerDynamicDNSSync = async () => {
    setBusy("dyndns-sync")
    setMessage("")
    setError("")
    try {
      const result = await syncDynamicDNS()
      setMessage(result.message)
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to sync dynamic DNS")
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
      setMessage(result.message)
      await load()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to roll back update")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {message ? <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">{message}</div> : null}

      <DashboardSection title="System">
        {loading || !status ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Current app tag" value={status.currentTag} />
            <Metric label="Current agent tag" value={status.currentAgentTag || "n/a"} />
            <Metric label="Docker control" value={status.dockerManaged ? "Available" : "Unavailable"} />
            <Metric label="Last action" value={status.lastAction || "No actions yet"} detail={status.lastMessage} />
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Updates">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Target tag</label>
              <Input value={updateTag} onChange={(event) => setUpdateTag(event.target.value)} placeholder="latest" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Latest release</label>
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {update?.latestTag || "Unavailable"}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
              <input
                type="checkbox"
                checked={includeAgent}
                onChange={(event) => setIncludeAgent(event.target.checked)}
                className="h-4 w-4 rounded border-border text-primary"
              />
              Update the appliance agent to the same tag
            </label>
            {update?.releaseUrl ? (
              <a className="text-sm font-medium text-primary hover:underline md:col-span-2" href={update.releaseUrl} target="_blank" rel="noreferrer">
                Open release notes
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => load().catch(() => undefined)} disabled={busy !== ""}>
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={submitRollback} disabled={busy !== ""}>
              {busy === "rollback" ? "Rolling back…" : "Rollback"}
            </Button>
            <Button type="button" onClick={submitUpdate} disabled={busy !== "" || !updateTag.trim()}>
              {busy === "update" ? "Applying…" : "Apply update"}
            </Button>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="TLS and domain">
        <form onSubmit={submitTLS} className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Trio requires a trusted HTTPS certificate to connect. Pick a challenge method below — DNS-01 is recommended for home users because it works behind any router without port forwarding.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Public domain">
              <Input value={tlsForm.domain} onChange={(event) => setTLSForm((prev) => ({ ...prev, domain: event.target.value }))} placeholder="my-glycoview.duckdns.org" />
              <p className="text-xs text-muted-foreground">The full hostname Trio will connect to. For DuckDNS use your <code>*.duckdns.org</code> name.</p>
            </Field>
            <Field label="Let's Encrypt email">
              <Input value={tlsForm.email} onChange={(event) => setTLSForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="you@example.com" />
              <p className="text-xs text-muted-foreground">Used by Let's Encrypt for expiry notifications only. Never shared.</p>
            </Field>
          </div>

          {challenges.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {challenges.map((challenge) => {
                const active = tlsForm.challengeType === challenge.id
                return (
                  <button
                    type="button"
                    key={challenge.id}
                    onClick={() =>
                      setTLSForm((prev) => ({
                        ...prev,
                        challengeType: challenge.id === "dns-01" ? "dns-01" : "http-01",
                        provider: challenge.id === "dns-01" ? prev.provider || providers[0]?.id || "" : "",
                      }))
                    }
                    className={`text-left rounded-lg border px-4 py-3 transition ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">{challenge.label}</div>
                      {challenge.recommended ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Recommended</span>
                      ) : null}
                    </div>
                    {challenge.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{challenge.description}</p>
                    ) : null}
                    {challenge.instructions && challenge.instructions.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
                        {challenge.instructions.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          {tlsForm.challengeType === "dns-01" ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
              <Field label="DNS provider">
                <select
                  value={tlsForm.provider}
                  onChange={(event) => setTLSForm((prev) => ({ ...prev, provider: event.target.value, env: {} }))}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select provider…</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </Field>

              {selectedProvider ? (
                <div className="space-y-3 rounded-md bg-background/60 p-4">
                  {selectedProvider.description ? (
                    <p className="text-sm text-foreground">{selectedProvider.description}</p>
                  ) : null}
                  {selectedProvider.instructions && selectedProvider.instructions.length > 0 ? (
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                      {selectedProvider.instructions.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                  {selectedProvider.docsUrl ? (
                    <a href={selectedProvider.docsUrl} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-primary hover:underline">
                      Open provider dashboard →
                    </a>
                  ) : null}

                  <div className="grid gap-3 pt-2 md:grid-cols-2">
                    {selectedProvider.fields.map((field) => (
                      <Field key={field.key} label={field.label}>
                        <Input
                          type={field.secret ? "password" : "text"}
                          value={tlsForm.env[field.key] || ""}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            setTLSForm((prev) => ({
                              ...prev,
                              env: {
                                ...prev.env,
                                [field.key]: event.target.value,
                              },
                            }))
                          }
                        />
                        {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="text-sm text-muted-foreground">
              {status?.tls.appliedAt ? `Last applied ${new Date(status.tls.appliedAt).toLocaleString()}` : "No TLS configuration has been applied yet."}
            </div>
            <Button type="submit" disabled={busy !== ""}>
              {busy === "tls" ? "Saving…" : "Save TLS settings"}
            </Button>
          </div>
        </form>
      </DashboardSection>

      <DashboardSection title="Dynamic DNS">
        <form onSubmit={submitDynamicDNS} className="space-y-5">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={dynamicDNSForm.enabled}
              onChange={(event) => setDynamicDNSForm((prev) => ({ ...prev, enabled: event.target.checked }))}
              className="h-4 w-4 rounded border-border text-primary"
            />
            Keep the public IP updated every 5 minutes
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Provider">
              <select
                value={dynamicDNSForm.provider}
                onChange={(event) => setDynamicDNSForm((prev) => ({ ...prev, provider: event.target.value }))}
                disabled={!dynamicDNSForm.enabled}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                <option value="">Select provider</option>
                {dynamicDNSProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Zone">
              <Input
                value={dynamicDNSForm.zone}
                onChange={(event) => setDynamicDNSForm((prev) => ({ ...prev, zone: event.target.value }))}
                placeholder="example.com"
                disabled={!dynamicDNSForm.enabled}
              />
            </Field>
            <Field label="Record name">
              <Input
                value={dynamicDNSForm.recordName}
                onChange={(event) => setDynamicDNSForm((prev) => ({ ...prev, recordName: event.target.value }))}
                placeholder="home.example.com"
                disabled={!dynamicDNSForm.enabled}
              />
            </Field>
          </div>

          {dynamicDNSForm.enabled && selectedDynamicDNSProvider ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
              {selectedDynamicDNSProvider.description ? (
                <p className="text-sm text-foreground">{selectedDynamicDNSProvider.description}</p>
              ) : null}
              {selectedDynamicDNSProvider.instructions && selectedDynamicDNSProvider.instructions.length > 0 ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {selectedDynamicDNSProvider.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : null}
              {selectedDynamicDNSProvider.docsUrl ? (
                <a href={selectedDynamicDNSProvider.docsUrl} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-primary hover:underline">
                  Open provider dashboard →
                </a>
              ) : null}

              <div className="grid gap-3 pt-2 md:grid-cols-2 xl:grid-cols-3">
                {selectedDynamicDNSProvider.fields.map((field) => (
                  <Field key={field.key} label={field.label}>
                    <Input
                      type={field.secret ? "password" : "text"}
                      value={dynamicDNSForm.env[field.key] || ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setDynamicDNSForm((prev) => ({
                          ...prev,
                          env: {
                            ...prev.env,
                            [field.key]: event.target.value,
                          },
                        }))
                      }
                    />
                    {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
                  </Field>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Current public IP" value={status?.currentPublicIp || status?.dynamicDns.lastKnownIp || "Unknown"} />
            <Metric label="Last checked" value={status?.dynamicDns.lastCheckedAt ? new Date(status.dynamicDns.lastCheckedAt).toLocaleString() : "Never"} />
            <Metric label="Last synced" value={status?.dynamicDns.lastSyncedAt ? new Date(status.dynamicDns.lastSyncedAt).toLocaleString() : "Never"} />
            <Metric label="Status" value={status?.dynamicDns.lastError || (status?.dynamicDns.enabled ? "Enabled" : "Disabled")} />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="text-sm text-muted-foreground">
              DuckDNS and Cloudflare are supported. The agent checks the public IPv4 every 5 minutes and updates the record when it changes.
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={triggerDynamicDNSSync} disabled={busy !== ""}>
                {busy === "dyndns-sync" ? "Syncing…" : "Sync now"}
              </Button>
              <Button type="submit" disabled={busy !== ""}>
                {busy === "dyndns" ? "Saving…" : "Save dynamic DNS"}
              </Button>
            </div>
          </div>
        </form>
      </DashboardSection>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
      {detail ? <div className="text-sm text-muted-foreground">{detail}</div> : null}
    </div>
  )
}
