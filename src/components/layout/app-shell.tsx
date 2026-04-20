import { useMemo } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"

import { BrandMark, Icons } from "@/lib/design-icons"
import type { AppUser } from "@/types"

type AppShellProps = {
  user: AppUser
  appVersion?: string
  onLogout: () => void
}

type NavItemSpec = {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  kbd: string
}

const dashboardItems: NavItemSpec[] = [
  { to: "/", label: "Overview", icon: Icons.Activity, kbd: "1" },
  { to: "/daily", label: "Daily", icon: Icons.Calendar, kbd: "2" },
  { to: "/trends", label: "Trends", icon: Icons.Trend, kbd: "3" },
  { to: "/profile", label: "Profile", icon: Icons.User, kbd: "4" },
  { to: "/devices", label: "Devices", icon: Icons.Device, kbd: "5" },
  { to: "/ai", label: "AI chat", icon: Icons.Sparkles, kbd: "8" },
]

const adminItems: NavItemSpec[] = [
  { to: "/users", label: "Access", icon: Icons.Shield, kbd: "6" },
  { to: "/settings", label: "Settings", icon: Icons.Settings, kbd: "7" },
]

const titleMap: Record<string, string> = {
  "/": "Overview",
  "/daily": "Daily",
  "/trends": "Trends",
  "/profile": "Profile",
  "/devices": "Devices",
  "/ai": "AI chat",
  "/users": "Access",
  "/settings": "Settings",
}

export function AppShell({ user, appVersion, onLogout }: AppShellProps) {
  const location = useLocation()
  const title = useMemo(() => titleMap[location.pathname] ?? "Glycoview", [location.pathname])
  const showAdmin = user.role === "admin"
  const userInitials = initials(user.displayName || user.username)
  const hostname = typeof window !== "undefined" ? window.location.hostname : ""
  const versionLabel = appVersion ? `Appliance · ${appVersion}` : "Appliance"

  return (
    <div className="gv-app">
      <aside className="side">
        <div className="side__brand">
          <div className="brand__mark" aria-hidden="true">
            <BrandMark size={24} />
          </div>
          <div className="brand__wm">
            <b>Glycoview</b>
            <span>{versionLabel}</span>
          </div>
        </div>

        <div className="side__group">
          <div className="side__group-label">Dashboard</div>
          <nav className="nav">
            {dashboardItems.map((it) => (
              <NavRow key={it.to} to={it.to} label={it.label} kbd={it.kbd} Icon={it.icon} />
            ))}
          </nav>
        </div>

        {showAdmin && (
          <div className="side__group">
            <div className="side__group-label">Install</div>
            <nav className="nav">
              {adminItems.map((it) => (
                <NavRow key={it.to} to={it.to} label={it.label} kbd={it.kbd} Icon={it.icon} />
              ))}
            </nav>
          </div>
        )}

        <div className="side__foot">
          <div className="side__user">
            <div className="av">{userInitials}</div>
            <div className="side__user-meta">
              <b>{user.displayName || user.username}</b>
              <span>{user.role}</span>
            </div>
            <button
              className="side__logout"
              title="Sign out"
              onClick={onLogout}
              aria-label="Sign out"
            >
              <Icons.Logout size={13} />
            </button>
          </div>
          <div className="side__env">
            <span className="dot" /> Appliance online
            {hostname ? (
              <span className="mono" style={{ marginLeft: "auto", color: "var(--ink-4)" }}>
                {hostname}
              </span>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="top">
          <div className="crumbs">
            <span>Glycoview</span>
            <span className="crumbs__sep">/</span>
            <b>{title}</b>
          </div>
          <div className="top__spacer" />
        </header>
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavRow({
  to,
  label,
  kbd,
  Icon,
}: {
  to: string
  label: string
  kbd: string
  Icon: React.ComponentType<{ size?: number }>
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) => "nav__item" + (isActive ? " is-active" : "")}
    >
      <span className="nav__icon">
        <Icon size={15} />
      </span>
      <span className="nav__label">{label}</span>
      <span className="nav__kbd">{kbd}</span>
    </NavLink>
  )
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
