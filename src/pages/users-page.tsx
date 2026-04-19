import { useEffect, useState } from "react"

import { createUser, fetchInstallSecret, fetchUsers, updateUser } from "@/lib/api"
import type { ApiError } from "@/lib/api"
import { Icons } from "@/lib/design-icons"
import type { AppUser } from "@/types"

type CreateForm = {
  displayName: string
  username: string
  password: string
  role: "doctor" | "admin"
}

const EMPTY_FORM: CreateForm = {
  displayName: "",
  username: "",
  password: "",
  role: "doctor",
}

export function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [apiSecret, setApiSecret] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [secretVisible, setSecretVisible] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [usersResponse, secretResponse] = await Promise.all([
        fetchUsers(),
        fetchInstallSecret(),
      ])
      setUsers(usersResponse.users)
      setApiSecret(secretResponse.apiSecret)
      setError("")
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
  }, [])

  const toggleActive = async (user: AppUser) => {
    setMessage("")
    try {
      await updateUser(user.id, { active: !user.active })
      await load()
      setMessage(`${user.displayName || user.username} ${user.active ? "disabled" : "enabled"}`)
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || "Failed to update user")
    }
  }

  const copySecret = async () => {
    if (!apiSecret) return
    try {
      await navigator.clipboard?.writeText(apiSecret)
      setSecretCopied(true)
      setTimeout(() => setSecretCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

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
            <div className="gv-h3">Install API secret</div>
            <div className="hint mt-4">
              Use this secret for Nightscout clients or{" "}
              <span className="mono">glycoview-agent</span>.
            </div>
          </div>
        </div>
        <div
          style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}
        >
          <input
            className="input mono"
            readOnly
            type={secretVisible ? "text" : "password"}
            value={apiSecret || "…"}
          />
          <button
            className="pill-btn"
            onClick={() => setSecretVisible((v) => !v)}
            disabled={!apiSecret}
          >
            {secretVisible ? "Hide" : "Show"}
          </button>
          <button className="pill-btn" onClick={copySecret} disabled={!apiSecret}>
            {secretCopied ? (
              <>
                <Icons.Check size={13} />
                Copied
              </>
            ) : (
              <>
                <Icons.Copy size={13} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <div className="flex-1">
            <div className="gv-h3">Users with access</div>
            <div className="hint mt-4">
              {loading
                ? "Loading…"
                : `${users.filter((u) => u.active).length} active · ${users.length - users.filter((u) => u.active).length} disabled`}
            </div>
          </div>
          <button className="pill-btn is-primary" onClick={() => setShowCreate(true)}>
            <Icons.Plus size={13} />
            Add user
          </button>
        </div>
        {users.length === 0 && !loading ? (
          <div className="hint" style={{ padding: 16 }}>
            No users yet. Create one above.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Created</th>
                <th>Status</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <div
                        className="av"
                        style={{ background: `oklch(0.74 0.08 ${u.id.charCodeAt(0) * 13})` }}
                      >
                        {initials(u.displayName || u.username)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {u.displayName || u.username}
                        </div>
                        <div className="hint mono">{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td className="hint mono">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td>
                    {u.active ? (
                      <span className="badge badge--in">
                        <span className="dot" />
                        Active
                      </span>
                    ) : (
                      <span className="badge">Disabled</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="pill-btn"
                      style={{ height: 26, fontSize: 11.5 }}
                      onClick={() => toggleActive(u)}
                    >
                      {u.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate ? (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={async (msg) => {
            setShowCreate(false)
            setMessage(msg)
            await load()
          }}
          onError={(msg) => setError(msg)}
        />
      ) : null}
    </>
  )
}

function CreateUserModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void
  onCreated: (message: string) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const valid =
    form.username.trim().length >= 2 && form.password.trim().length >= 6

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    setSubmitting(true)
    try {
      await createUser({
        displayName: form.displayName || form.username,
        username: form.username,
        password: form.password,
        role: form.role,
      })
      onCreated(`Added ${form.username}`)
    } catch (err) {
      const apiError = err as ApiError
      onError(apiError.message || "Failed to create user")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal__head">
          <div>
            <div className="gv-h3">Add user</div>
            <div className="hint mt-4">
              Users share the same appliance. Give a clinician or family member access.
            </div>
          </div>
          <button
            type="button"
            className="pill-btn"
            onClick={onClose}
            style={{ height: 26, fontSize: 11.5 }}
          >
            Close
          </button>
        </div>
        <div className="modal__body">
          <div>
            <div className="label">Display name</div>
            <input
              className="input"
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              placeholder="Dr. Alex Reyes"
              autoFocus
            />
          </div>
          <div>
            <div className="label">Username</div>
            <input
              className="input mono"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="areyes"
              autoComplete="off"
            />
            <div className="help">At least 2 characters. Used for sign-in.</div>
          </div>
          <div>
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              autoComplete="new-password"
            />
            <div className="help">At least 6 characters. Share securely.</div>
          </div>
          <div>
            <div className="label">Role</div>
            <div className="seg" style={{ gridAutoColumns: "1fr 1fr" }}>
              {(["doctor", "admin"] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  className={form.role === r ? "is-active" : ""}
                  onClick={() => setForm((p) => ({ ...p, role: r }))}
                >
                  {r === "doctor" ? "Doctor" : "Admin"}
                </button>
              ))}
            </div>
            <div className="help">
              {form.role === "doctor"
                ? "Full access to charts, profile, devices."
                : "Full clinical access plus user and appliance management."}
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <div className="hint mono">Appliance users · no email invite required</div>
          <button type="button" className="pill-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="pill-btn is-primary"
            disabled={!valid || submitting}
          >
            {submitting ? "Adding…" : "Add user"}
          </button>
        </div>
      </form>
    </div>
  )
}

function initials(value: string): string {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}
