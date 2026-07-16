// Scriptable widget for Claude Code local/remote usage.
// Replace DEFAULT_SERVER with your own combined /usage or dedicated /claude-usage URL.
// Widget parameter:
//   https://usage.example.com/usage

const DEFAULT_SERVER = "https://example.com/usage"
const REFRESH_MINUTES = 10
const CACHE_FILE = "claude_usage_widget_cache.json"
const CLAUDE_ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAq0lEQVR4nO2VwQ3EIAwEt5LrIPWkFJfqCqiDe92JR1BiAbJNdqT9RNGy8wFgEuVz1F+efF/dY4YC3gIjh5Xmf2sosKXACCXj6BYKRKJkHB1aYNaj5ka4Qa8TICQTKmeNFFBAKFApYGFbAQD/TBxX7zopoBQ4KWBiWwF1CiggQQU0wDgdEfMeoBQQ/xFKAckbZLmdsO070CO9QEuvaOSAFZ1dKHABBSxQAOs6v93vUfvjY1dDAAAAAElFTkSuQmCC"

let CLAUDE_ICON = null

const COLORS = {
  text: new Color("#f7f8fb"),
  muted: new Color("#7f8794"),
  faint: new Color("#59606b"),
  track: new Color("#6d6258", 0.72),
  fill: new Color("#ffb457"),
  offline: new Color("#ff9f0a")
}

main().catch(error => {
  console.error(error)
  Script.complete()
})

async function main() {
  if (config.runsInWidget) {
    const widget = await createWidget()
    Script.setWidget(widget)
  } else {
    const widget = await createWidget()
    await widget.presentMedium()
  }
  Script.complete()
}

async function createWidget() {
  const data = await loadUsage()
  const layout = widgetLayout(config.widgetFamily || "medium")
  const w = new ListWidget()
  w.backgroundImage = widgetBackground()
  w.setPadding(layout.padTop, layout.padX, layout.padBottom, layout.padX)
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000)

  addHeader(w, data, layout)
  w.addSpacer(layout.headerGap)

  addLimitRow(w, "5h", data.five_hour, layout)
  w.addSpacer(layout.rowGap)
  addLimitRow(w, "Week", data.weekly, layout)

  w.addSpacer()

  return w
}

function addHeader(parent, data, layout) {
  const header = parent.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  const icon = header.addImage(claudeMark(layout.logoSize))
  icon.imageSize = new Size(layout.logoSize, layout.logoSize)

  header.addSpacer(layout.logoGap)

  const title = header.addText("Claude")
  title.font = Font.heavySystemFont(layout.titleFont)
  title.textColor = COLORS.text
  title.lineLimit = 1
  title.minimumScaleFactor = 0.82

  header.addSpacer()

  const stamp = header.addText(headerStamp(data))
  stamp.font = Font.boldSystemFont(layout.stampFont)
  stamp.textColor = data.stale || !data.ok ? COLORS.offline : COLORS.muted
  stamp.lineLimit = 1
  stamp.minimumScaleFactor = 0.75
}

function addLimitRow(parent, label, limit, layout) {
  const pct = percentValue(limit)
  const fillWidth = Math.round(layout.barWidth * Math.min(100, pct) / 100)

  const block = parent.addStack()
  block.layoutVertically()

  const line = block.addStack()
  line.layoutHorizontally()
  line.centerAlignContent()

  const name = line.addText(label)
  name.font = Font.heavySystemFont(layout.labelFont)
  name.textColor = COLORS.text
  name.lineLimit = 1

  line.addSpacer()

  const value = line.addText(percentText(limit))
  value.font = Font.heavySystemFont(layout.percentFont)
  value.textColor = COLORS.text
  value.lineLimit = 1
  value.minimumScaleFactor = 0.7

  block.addSpacer(layout.lineGap)

  const track = block.addStack()
  track.backgroundColor = COLORS.track
  track.cornerRadius = layout.barHeight / 2
  track.size = new Size(layout.barWidth, layout.barHeight)

  if (fillWidth > 0) {
    const fill = track.addStack()
    fill.backgroundColor = COLORS.fill
    fill.cornerRadius = layout.barHeight / 2
    fill.size = new Size(Math.max(3, fillWidth), layout.barHeight)
  }
  track.addSpacer()

  block.addSpacer(layout.metaGap)

  const reset = block.addText(resetDateText(limit))
  reset.font = Font.systemFont(layout.metaFont)
  reset.textColor = COLORS.muted
  reset.lineLimit = 1
  reset.minimumScaleFactor = 0.65
}

async function loadUsage() {
  const fm = FileManager.local()
  const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FILE)

  try {
    const apiUrl = resolveApiUrl()
    if (!apiUrl) throw new Error("Missing self-hosted Claude usage server URL")
    const req = new Request(refreshUrl(apiUrl))
    req.headers = { "Cache-Control": "no-cache" }
    req.timeoutInterval = 12
    const json = normalizeClaudeUsage(await req.loadJSON())
    fm.writeString(cachePath, JSON.stringify(json))
    return json
  } catch (e) {
    if (fm.fileExists(cachePath)) {
      const cached = normalizeClaudeUsage(JSON.parse(fm.readString(cachePath)))
      cached.stale = true
      return cached
    }

    return {
      ok: false,
      stale: true,
      plan_type: "offline",
      five_hour: null,
      weekly: null
    }
  }
}

function resolveApiUrl() {
  let value = args.widgetParameter || ""
  if (!value && Keychain.contains("xjj_debug_server")) {
    value = Keychain.get("xjj_debug_server")
  }
  if (!value) value = DEFAULT_SERVER

  value = String(value).trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) {
    const clean = value.replace(/\/$/, "")
    return /\/(claude-usage|usage)(\?|$|\/)/i.test(clean) ? clean : clean + "/claude-usage"
  }
  return `http://${value.replace(/\/$/, "")}:5566/claude-usage`
}

function refreshUrl(value) {
  const step = Math.floor(Date.now() / (REFRESH_MINUTES * 60 * 1000))
  const sep = String(value).indexOf("?") >= 0 ? "&" : "?"
  return `${value}${sep}_=${step}`
}

function widgetLayout(family) {
  if (family === "small") {
    return {
      padTop: 12,
      padBottom: 10,
      padX: 13,
      logoSize: 33,
      logoGap: 8,
      titleFont: 20,
      stampFont: 9,
      headerGap: 8,
      rowGap: 8,
      labelFont: 16,
      percentFont: 30,
      lineGap: 4,
      barWidth: 124,
      barHeight: 8,
      metaGap: 3,
      metaFont: 8
    }
  }

  return {
    padTop: 15,
    padBottom: 12,
    padX: 18,
    logoSize: 38,
    logoGap: 10,
    titleFont: 23,
    stampFont: 10,
    headerGap: 10,
    rowGap: 9,
    labelFont: 17,
    percentFont: 33,
    lineGap: 4,
    barWidth: 272,
    barHeight: 8,
    metaGap: 3,
    metaFont: 9
  }
}

function percentValue(limit) {
  if (!limit || limit.used_percent === null || limit.used_percent === undefined) return 0
  const value = Number(limit.used_percent)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

function percentText(limit) {
  if (!limit || limit.used_percent === null || limit.used_percent === undefined) return "--%"
  return `${Math.round(percentValue(limit))}%`
}

function headerStamp(data) {
  return shortTime(new Date())
}

function normalizeClaudeUsage(data) {
  if (!data || typeof data !== "object") return data
  if (data.services && data.services.claude) return data.services.claude
  const sourceMode = String(data.source_mode || "")
  if (sourceMode.indexOf("statusline") >= 0 || sourceMode.indexOf("sub2api") >= 0 || data.model !== undefined) return data
  return {
    ok: false,
    stale: true,
    model: "unavailable",
    five_hour: null,
    weekly: null
  }
}

function resetDateText(limit) {
  if (!limit) return "no data"

  const date = resetDate(limit)
  if (date) {
    const df = new DateFormatter()
    df.dateFormat = "MM/dd HH:mm"
    return df.string(date)
  }

  return resetText(limit.remaining_seconds)
}

function resetDate(limit) {
  if (limit.resets_at_iso) {
    const date = new Date(limit.resets_at_iso)
    if (!isNaN(date.getTime())) return date
  }

  if (limit.resets_at) {
    const date = new Date(Number(limit.resets_at) * 1000)
    if (!isNaN(date.getTime())) return date
  }

  return null
}

function resetText(seconds) {
  if (seconds === null || seconds === undefined) return "--"
  const s = Math.max(0, Number(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h <= 0) return `${m}m reset`
  return `${h}h ${m}m`
}

function shortTime(date) {
  const df = new DateFormatter()
  df.dateFormat = "HH:mm"
  return df.string(date)
}

function claudeMark(size) {
  try {
    if (!CLAUDE_ICON) {
      CLAUDE_ICON = Image.fromData(Data.fromBase64String(CLAUDE_ICON_B64))
    }
    return CLAUDE_ICON
  } catch (_) {
    return claudeFallbackMark(size)
  }
}

function claudeFallbackMark(size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true

  ctx.setFillColor(new Color("#f3d6ba"))
  ctx.fillEllipse(new Rect(size * 0.06, size * 0.06, size * 0.88, size * 0.88))

  ctx.setFillColor(new Color("#d08342", 0.28))
  ctx.fillEllipse(new Rect(size * 0.18, size * 0.18, size * 0.64, size * 0.64))

  ctx.setFont(Font.heavySystemFont(size * 0.48))
  ctx.setTextColor(new Color("#27170d"))
  ctx.drawTextInRect("C", new Rect(size * 0.31, size * 0.20, size * 0.46, size * 0.54))

  return ctx.getImage()
}

function widgetBackground() {
  const width = 600
  const height = 360
  const ctx = new DrawContext()
  ctx.size = new Size(width, height)
  ctx.opaque = true
  ctx.respectScreenScale = true

  for (let y = 0; y < height; y += 2) {
    const t = y / height
    const r = Math.round(28 - 16 * t)
    const g = Math.round(24 - 14 * t)
    const b = Math.round(22 - 13 * t)
    ctx.setFillColor(new Color(rgbHex(r, g, b)))
    ctx.fillRect(new Rect(0, y, width, 2))
  }

  ctx.setFillColor(new Color("#4a3426", 0.16))
  ctx.fillRect(new Rect(0, 0, width, 86))

  ctx.setFillColor(new Color("#ffffff", 0.025))
  for (let y = 70; y < height; y += 18) {
    ctx.fillRect(new Rect(0, y, width, 1))
  }

  ctx.setFillColor(new Color("#000000", 0.16))
  ctx.fillRect(new Rect(0, height - 80, width, 80))

  return ctx.getImage()
}

function rgbHex(r, g, b) {
  return "#" + hexByte(r) + hexByte(g) + hexByte(b)
}

function hexByte(n) {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")
}
