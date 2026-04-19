import { createElement } from "react"
import type { SVGProps } from "react"

type IconProps = {
  size?: number
  sw?: number
} & Omit<SVGProps<SVGSVGElement>, "size">

type Node = string | { tag: string; [key: string]: unknown }

const build = (paths: Node[]) =>
  function GvIcon({ size = 16, stroke = "currentColor", fill = "none", sw = 1.6, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill as string}
        stroke={stroke as string}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {paths.map((node, i) => {
          if (typeof node === "string") return <path key={i} d={node} />
          const { tag, ...attrs } = node
          return createElement(tag, { key: i, ...(attrs as Record<string, unknown>) })
        })}
      </svg>
    )
  }

export const Icons = {
  Activity: build([{ tag: "polyline", points: "22 12 18 12 15 21 9 3 6 12 2 12" }]),
  Calendar: build([
    { tag: "rect", x: 3, y: 4, width: 18, height: 18, rx: 2 },
    { tag: "line", x1: 16, y1: 2, x2: 16, y2: 6 },
    { tag: "line", x1: 8, y1: 2, x2: 8, y2: 6 },
    { tag: "line", x1: 3, y1: 10, x2: 21, y2: 10 },
  ]),
  Trend: build([
    { tag: "polyline", points: "3 17 9 11 13 15 21 7" },
    { tag: "polyline", points: "14 7 21 7 21 14" },
  ]),
  User: build([
    { tag: "circle", cx: 12, cy: 7, r: 4 },
    "M4 21v-1a7 7 0 0 1 14 0v1",
  ]),
  Device: build([
    { tag: "rect", x: 3, y: 4, width: 18, height: 12, rx: 2 },
    "M8 20h8M12 16v4",
  ]),
  Shield: build(["M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"]),
  Settings: build([
    { tag: "circle", cx: 12, cy: 12, r: 3 },
    { tag: "circle", cx: 12, cy: 12, r: 9, fill: "none" },
  ]),
  Logout: build([
    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
    { tag: "polyline", points: "16 17 21 12 16 7" },
    { tag: "line", x1: 21, y1: 12, x2: 9, y2: 12 },
  ]),
  Chevron: build([{ tag: "polyline", points: "6 9 12 15 18 9" }]),
  ChevronR: build([{ tag: "polyline", points: "9 6 15 12 9 18" }]),
  ChevronL: build([{ tag: "polyline", points: "15 6 9 12 15 18" }]),
  Search: build([
    { tag: "circle", cx: 11, cy: 11, r: 7 },
    { tag: "line", x1: 21, y1: 21, x2: 16.5, y2: 16.5 },
  ]),
  Plus: build([
    { tag: "line", x1: 12, y1: 5, x2: 12, y2: 19 },
    { tag: "line", x1: 5, y1: 12, x2: 19, y2: 12 },
  ]),
  Dot: build([{ tag: "circle", cx: 12, cy: 12, r: 3, fill: "currentColor" }]),
  Moon: build(["M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"]),
  Sun: build([
    { tag: "circle", cx: 12, cy: 12, r: 4 },
    { tag: "line", x1: 12, y1: 2, x2: 12, y2: 5 },
    { tag: "line", x1: 12, y1: 19, x2: 12, y2: 22 },
    { tag: "line", x1: 2, y1: 12, x2: 5, y2: 12 },
    { tag: "line", x1: 19, y1: 12, x2: 22, y2: 12 },
  ]),
  Sliders: build([
    { tag: "line", x1: 4, y1: 6, x2: 20, y2: 6 },
    { tag: "line", x1: 4, y1: 12, x2: 20, y2: 12 },
    { tag: "line", x1: 4, y1: 18, x2: 20, y2: 18 },
    { tag: "circle", cx: 8, cy: 6, r: 2, fill: "var(--surface)" },
    { tag: "circle", cx: 14, cy: 12, r: 2, fill: "var(--surface)" },
    { tag: "circle", cx: 10, cy: 18, r: 2, fill: "var(--surface)" },
  ]),
  Check: build([{ tag: "polyline", points: "20 6 9 17 4 12" }]),
  Copy: build([
    { tag: "rect", x: 9, y: 9, width: 13, height: 13, rx: 2 },
    "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  ]),
  Alert: build([
    "M10.3 3.86 1.82 18a2 2 0 0 0 1.7 3h16.94a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z",
    { tag: "line", x1: 12, y1: 9, x2: 12, y2: 13 },
    { tag: "line", x1: 12, y1: 17, x2: 12.01, y2: 17 },
  ]),
  Bolt: build([{ tag: "polygon", points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }]),
  Wifi: build([
    "M2 9a15 15 0 0 1 20 0",
    "M5 12.5a10 10 0 0 1 14 0",
    "M8.5 16a5 5 0 0 1 7 0",
    { tag: "line", x1: 12, y1: 20, x2: 12.01, y2: 20 },
  ]),
  Play: build([{ tag: "polygon", points: "6 4 20 12 6 20 6 4" }]),
  Pi: build([
    { tag: "rect", x: 3, y: 5, width: 18, height: 14, rx: 2 },
    { tag: "circle", cx: 8, cy: 12, r: 1.5 },
    { tag: "circle", cx: 16, cy: 12, r: 1.5 },
    "M7 9h10M7 16h3",
  ]),
  Drop: build(["M12 2.7C8.1 7.1 5 11.3 5 14.7A7 7 0 1 0 19 14.7c0-3.4-3.1-7.6-7-12z"]),
  Refresh: build([
    { tag: "polyline", points: "23 4 23 10 17 10" },
    { tag: "polyline", points: "1 20 1 14 7 14" },
    "M3.5 9a9 9 0 0 1 14.85-3.36L23 10",
    "M1 14l4.65 4.36A9 9 0 0 0 20.5 15",
  ]),
  Lock: build([
    { tag: "rect", x: 3, y: 11, width: 18, height: 11, rx: 2 },
    "M7 11V7a5 5 0 0 1 10 0v4",
  ]),
  Globe: build([
    { tag: "circle", cx: 12, cy: 12, r: 10 },
    { tag: "line", x1: 2, y1: 12, x2: 22, y2: 12 },
    "M12 2a15 15 0 0 1 0 20",
    "M12 2a15 15 0 0 0 0 20",
  ]),
  Compass: build([
    { tag: "circle", cx: 12, cy: 12, r: 10 },
    { tag: "polygon", points: "16.2 7.8 13.4 14.6 6.6 17.4 9.4 10.6 16.2 7.8" },
  ]),
  Mail: build([
    { tag: "rect", x: 2, y: 5, width: 20, height: 14, rx: 2 },
    "M2 7l10 7 10-7",
  ]),
}

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M 5 22 C 9 22, 10 14, 14 13 C 18 12, 19 19, 23 14 L 25 11"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="25" cy="11" r="3" fill="currentColor" />
      <circle cx="25" cy="11" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
    </svg>
  )
}
