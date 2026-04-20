import DOMPurify from "dompurify"
import { useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

type Props = { text: string }

/**
 * Markdown renderer with one extension: fenced code blocks marked ```svg get
 * sanitized and rendered as inline SVG so the model can draw small charts.
 * Everything else is plain Markdown (GFM).
 */
export function MarkdownView({ text }: Props) {
  const components: Components = useMemo(
    () => ({
      code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || "")
        const lang = match?.[1]?.toLowerCase()
        const content = String(children ?? "").trim()
        if (!inline && lang === "svg") {
          return <InlineSvg source={content} />
        }
        if (inline) {
          return (
            <code className="mono" style={inlineCodeStyle} {...props}>
              {children}
            </code>
          )
        }
        return (
          <pre style={blockCodeStyle}>
            <code className="mono" {...props}>
              {children}
            </code>
          </pre>
        )
      },
      a({ children, href, ...props }) {
        return (
          <a href={href} target="_blank" rel="noreferrer noopener" style={{ color: "var(--accent-2)", textDecoration: "underline" }} {...props}>
            {children}
          </a>
        )
      },
      table({ children }) {
        return (
          <div style={{ overflowX: "auto", margin: "10px 0" }}>
            <table className="tbl" style={{ fontSize: 12.5 }}>
              {children}
            </table>
          </div>
        )
      },
      blockquote({ children }) {
        return (
          <blockquote
            style={{
              margin: "10px 0",
              padding: "4px 12px",
              borderLeft: "3px solid var(--line)",
              color: "var(--ink-3)",
            }}
          >
            {children}
          </blockquote>
        )
      },
      h1: ({ children }) => <div className="gv-h2" style={{ marginTop: 12 }}>{children}</div>,
      h2: ({ children }) => <div className="gv-h3" style={{ marginTop: 10, fontSize: 15 }}>{children}</div>,
      h3: ({ children }) => <div className="gv-h4" style={{ marginTop: 8 }}>{children}</div>,
      ul: ({ children }) => <ul style={{ margin: "6px 0", paddingLeft: 18 }}>{children}</ul>,
      ol: ({ children }) => <ol style={{ margin: "6px 0", paddingLeft: 18 }}>{children}</ol>,
      li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
      p: ({ children }) => <p style={{ margin: "6px 0", lineHeight: 1.55 }}>{children}</p>,
      hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--line-2)", margin: "12px 0" }} />,
    }),
    [],
  )

  return (
    <div className="gv-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

function InlineSvg({ source }: { source: string }) {
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(source, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ["script", "foreignObject"],
        FORBID_ATTR: ["onload", "onclick", "onerror"],
      }),
    [source],
  )
  return (
    <div
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 12,
        margin: "10px 0",
        color: "var(--ink)",
        overflow: "auto",
      }}
      // InlineSvg is the explicit reason we render HTML here. Input is
      // model-authored and sanitised with DOMPurify on the line above.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

const inlineCodeStyle: React.CSSProperties = {
  background: "var(--bg-2)",
  border: "1px solid var(--line-2)",
  borderRadius: 4,
  padding: "1px 5px",
  fontSize: 12,
}

const blockCodeStyle: React.CSSProperties = {
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "10px 12px",
  margin: "10px 0",
  overflowX: "auto",
  fontSize: 12,
  lineHeight: 1.6,
}
