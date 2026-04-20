/**
 * Minimal SSE client over fetch + ReadableStream, matched to the event shape
 * emitted by /app/api/ai/chat. The backend uses the standard SSE framing:
 *
 *   event: <type>
 *   data: <json>
 *   <blank line>
 */

export type AiStreamEvent =
  | { type: "content"; delta: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_end"; id: string; name: string; result?: unknown; error?: string; durationMs?: number }
  | { type: "done"; finish?: string }
  | { type: "error"; message: string }

export type AiChatMessage = {
  role: "user" | "assistant" | "tool" | "system"
  content?: string
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    name: string
    arguments: unknown
  }>
}

export type StreamHandlers = {
  onEvent: (event: AiStreamEvent) => void
  signal?: AbortSignal
}

export async function streamAiChat(
  messages: AiChatMessage[],
  userTimeZone: string | undefined,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await fetch("/app/api/ai/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ messages, userTimeZone }),
    signal: handlers.signal,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (body?.message) message = body.message
    } catch {
      /* ignore */
    }
    handlers.onEvent({ type: "error", message: `chat failed: ${message}` })
    return
  }
  if (!res.body) {
    handlers.onEvent({ type: "error", message: "no response stream" })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    let chunk
    try {
      chunk = await reader.read()
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      handlers.onEvent({ type: "error", message: (err as Error).message })
      return
    }
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })

    // Parse complete SSE frames (delimited by blank line).
    let boundary: number
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const ev = parseFrame(frame)
      if (ev) handlers.onEvent(ev)
    }
  }
}

function parseFrame(frame: string): AiStreamEvent | null {
  let eventType = ""
  let dataText = ""
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) {
      eventType = line.slice(7).trim()
    } else if (line.startsWith("data: ")) {
      dataText += line.slice(6)
    }
  }
  if (!eventType || !dataText) return null
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(dataText)
  } catch {
    return null
  }
  switch (eventType) {
    case "content":
      return { type: "content", delta: String(payload.delta ?? "") }
    case "tool_start":
      return {
        type: "tool_start",
        id: String(payload.id ?? ""),
        name: String(payload.name ?? ""),
        args: payload.args,
      }
    case "tool_end":
      return {
        type: "tool_end",
        id: String(payload.id ?? ""),
        name: String(payload.name ?? ""),
        result: payload.result,
        error: typeof payload.error === "string" ? payload.error : undefined,
        durationMs: typeof payload.durationMs === "number" ? payload.durationMs : undefined,
      }
    case "done":
      return { type: "done", finish: typeof payload.finish === "string" ? payload.finish : undefined }
    case "error":
      return { type: "error", message: String(payload.message ?? "unknown error") }
    default:
      return null
  }
}
