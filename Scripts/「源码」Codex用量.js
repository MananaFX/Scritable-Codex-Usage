// Scriptable widget for Codex/Claude usage.
// Replace DEFAULT_SERVER with your own API base URL before using.
// Small widget parameter:  codex | claude
// Medium widget parameter: both  | week   (week = codex + chart)
// Optional server override: append e.g. "both https://usage.example.com/usage"

const DEFAULT_SERVER = "https://example.com/usage"
const REFRESH_MINUTES = 10
const CACHE_FILE = "codex_usage_widget_cache.json"
const CLAUDE_ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAq0lEQVR4nO2VwQ3EIAwEt5LrIPWkFJfqCqiDe92JR1BiAbJNdqT9RNGy8wFgEuVz1F+efF/dY4YC3gIjh5Xmf2sosKXACCXj6BYKRKJkHB1aYNaj5ka4Qa8TICQTKmeNFFBAKFApYGFbAQD/TBxX7zopoBQ4KWBiWwF1CiggQQU0wDgdEfMeoBQQ/xFKAckbZLmdsO070CO9QEuvaOSAFZ1dKHABBSxQAOs6v93vUfvjY1dDAAAAAElFTkSuQmCC"

let CLAUDE_ICON = null

const COLORS = {
  text: new Color("#f7f8fb"),
  muted: new Color("#7f8794"),
  track: new Color("#657061", 0.72),
  codex: new Color("#39f174"),
  claude: new Color("#ff9f43"),
  offline: new Color("#ff9f0a")
}

main().catch(error => {
  console.error(error)
  Script.complete()
})

async function main() {
  const widget = await createWidget()
  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    await widget.presentMedium()
  }
  Script.complete()
}

async function createWidget() {
  const settings = widgetSettings()
  const data = await loadUsage(settings.apiUrl)
  const family = config.widgetFamily || "medium"
  const layout = widgetLayout(family)

  const w = new ListWidget()
  if (family === "small" && isStandBy()) {
    // StandBy small widget: pure black to blend into the dimmed StandBy screen.
    w.backgroundColor = new Color("#000000")
  } else {
    w.backgroundImage = widgetBackground()
  }
  w.setPadding(
    layout.padTop,
    layout.padLeft || layout.padX,
    layout.padBottom,
    layout.padRight || layout.padX
  )
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000)

  if (family === "small") {
    const serviceId = settings.service === "claude" ? "claude" : "codex"
    addServicePanel(w, serviceUsage(serviceId, data), layout, true)
  } else if (settings.mode === "chart") {
    addCodexChartPanel(w, data, layout)
  } else {
    addDualPanel(w, data, layout)
  }

  return w
}

function addCodexChartPanel(parent, data, layout) {
  const row = parent.addStack()
  row.layoutHorizontally()
  row.topAlignContent()

  // Left column: Codex. Top spacer matches the stamp height above the chart
  // so the Codex header aligns with the chart header.
  const left = row.addStack()
  left.layoutVertically()
  left.size = new Size(layout.panelWidth, layout.panelHeight + layout.stampReserve)
  left.addSpacer(layout.stampReserve)
  addServicePanel(left, serviceUsage("codex", data), layout, false)

  row.addSpacer()

  // Right column: time stamp + daily-token chart grouped together.
  const right = row.addStack()
  right.layoutVertically()
  right.size = new Size(layout.chartPanelWidth, layout.panelHeight + layout.stampReserve)
  addStampRow(right, data, layout, layout.chartPanelWidth)
  right.addSpacer(layout.globalStampGap)
  addHistoryPanel(right, codexHistory(data), layout)

  row.addSpacer()
}

function addDualPanel(parent, data, layout) {
  const row = parent.addStack()
  row.layoutHorizontally()
  row.topAlignContent()

  // Left column: Codex. A top spacer reserves the same height as the time
  // stamp above Claude so both service headers stay vertically aligned.
  const left = row.addStack()
  left.layoutVertically()
  left.size = new Size(layout.panelWidth, layout.panelHeight + layout.stampReserve)
  left.addSpacer(layout.stampReserve)
  addServicePanel(left, serviceUsage("codex", data), layout, false)

  row.addSpacer()

  // Right column: time stamp + Claude grouped together so they move as one.
  const right = row.addStack()
  right.layoutVertically()
  right.size = new Size(layout.rightPanelWidth, layout.panelHeight + layout.stampReserve)
  addStampRow(right, data, layout, layout.rightPanelWidth)
  right.addSpacer(layout.globalStampGap)
  addServicePanel(right, serviceUsage("claude", data), layout, false)

  row.addSpacer()
}

function addStampRow(parent, data, layout, width) {
  const row = parent.addStack()
  row.layoutHorizontally()
  row.size = new Size(width, layout.stampReserve)
  row.addSpacer()

  const stamp = row.addText(globalStamp(data))
  stamp.font = Font.boldSystemFont(layout.globalStampFont)
  stamp.textColor = data && data.ok !== false && !data.stale ? COLORS.muted : COLORS.offline
  stamp.lineLimit = 1
  stamp.minimumScaleFactor = 0.55
}

function addServicePanel(parent, service, layout, showStamp) {
  addServiceHeader(parent, service, layout, showStamp)
  parent.addSpacer(layout.headerGap)

  addLimitRow(parent, service.primaryLabel, service.primary, layout, service)
  parent.addSpacer(layout.rowGap)
  addLimitRow(parent, service.secondaryLabel, service.secondary, layout, service)

  parent.addSpacer()
}

function addHistoryPanel(parent, history, layout) {
  const header = parent.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  const title = header.addText("Daily Tokens")
  title.font = Font.heavySystemFont(layout.chartTitleFont)
  title.textColor = COLORS.text
  title.lineLimit = 1
  title.minimumScaleFactor = 0.75

  header.addSpacer()

  const unit = header.addText("M")
  unit.font = Font.boldSystemFont(layout.chartUnitFont)
  unit.textColor = COLORS.muted
  unit.lineLimit = 1

  parent.addSpacer(layout.chartHeaderGap)

  const image = parent.addImage(historyChart(history, layout.chartWidth, layout.chartHeight))
  image.imageSize = new Size(layout.chartWidth, layout.chartHeight)

  parent.addSpacer()
}

function addServiceHeader(parent, service, layout, showStamp) {
  const header = parent.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  const iconBox = header.addStack()
  iconBox.layoutHorizontally()
  iconBox.centerAlignContent()
  iconBox.size = new Size(layout.logoBoxSize, layout.logoBoxSize)

  const icon = iconBox.addImage(serviceMark(service.id, layout.logoSize))
  icon.imageSize = new Size(layout.logoSize, layout.logoSize)

  header.addSpacer(layout.logoGap)

  const title = header.addText(service.name)
  title.font = Font.heavySystemFont(layout.titleFont)
  title.textColor = COLORS.text
  title.lineLimit = 1
  title.minimumScaleFactor = 0.72

  if (showStamp) {
    header.addSpacer()

    const stamp = header.addText(serviceStamp(service))
    stamp.font = Font.boldSystemFont(layout.stampFont)
    stamp.textColor = service.ok && !service.stale ? COLORS.muted : COLORS.offline
    stamp.lineLimit = 1
    stamp.minimumScaleFactor = 0.65
  }
}

function addLimitRow(parent, label, limit, layout, service) {
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
  name.minimumScaleFactor = 0.8

  line.addSpacer()

  const value = line.addText(percentText(limit))
  value.font = Font.heavySystemFont(layout.percentFont)
  value.textColor = COLORS.text
  value.lineLimit = 1
  value.minimumScaleFactor = 0.62

  block.addSpacer(layout.lineGap)

  const track = block.addStack()
  track.backgroundColor = COLORS.track
  track.cornerRadius = layout.barHeight / 2
  track.size = new Size(layout.barWidth, layout.barHeight)

  if (fillWidth > 0) {
    const fill = track.addStack()
    fill.backgroundColor = service.color
    fill.cornerRadius = layout.barHeight / 2
    fill.size = new Size(Math.max(3, fillWidth), layout.barHeight)
  }
  track.addSpacer()

  block.addSpacer(layout.metaGap)

  const reset = block.addText(resetDateText(limit))
  reset.font = Font.systemFont(layout.metaFont)
  reset.textColor = COLORS.muted
  reset.lineLimit = 1
  reset.minimumScaleFactor = 0.62
}

async function loadUsage(apiUrl) {
  const fm = FileManager.local()
  const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FILE)

  try {
    if (!apiUrl) throw new Error("Missing self-hosted usage server URL")
    const req = new Request(refreshUrl(apiUrl))
    req.headers = { "Cache-Control": "no-cache" }
    req.timeoutInterval = 25
    const json = await req.loadJSON()
    fm.writeString(cachePath, JSON.stringify(json))
    return json
  } catch (e) {
    if (fm.fileExists(cachePath)) {
      const cached = JSON.parse(fm.readString(cachePath))
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

function widgetSettings() {
  const raw = String(args.widgetParameter || "").trim()
  const tokens = raw ? raw.split(/[,\s|]+/).filter(Boolean) : []
  let service = null
  let mode = null
  const source = []

  for (const token of tokens) {
    const key = token.toLowerCase()
    if (key === "codex") {
      service = "codex"
    } else if (key === "claude" || key === "anthropic") {
      service = "claude"
    } else if (key === "both" || key === "dual" || key === "all") {
      service = "both"
    } else if (key === "chart" || key === "daily" || key === "stats" || key === "history" || key === "week" || key === "weekly") {
      mode = "chart"
    } else {
      source.push(token)
    }
  }

  let server = source.join(" ").trim()
  // 遗留调试覆盖:只在是 https 时才采用。历史调试期可能把内网 http IP 存进
  // Keychain(xjj_debug_server),导致 iOS ATS 拦截 http → fetch 抛错 → 一直读旧缓存。
  // 发现非 https 的旧值就主动清除并回落到 DEFAULT_SERVER,实现自愈。
  if (!server && Keychain.contains("xjj_debug_server")) {
    const dbg = String(Keychain.get("xjj_debug_server") || "").trim()
    if (/^https:\/\//i.test(dbg)) {
      server = dbg
    } else {
      try { Keychain.remove("xjj_debug_server") } catch (_) {}
    }
  }
  // 参数里若给了非 https 的内网地址,同样忽略。公开部署建议只使用 HTTPS。
  if (server && !/^https:\/\//i.test(server)) server = ""
  if (!server) server = DEFAULT_SERVER

  return {
    service: service || "codex",
    mode,
    apiUrl: server ? usageUrl(server) : null
  }
}

function usageUrl(value) {
  const server = String(value || "").trim()
  if (/^https?:\/\//i.test(server)) {
    const clean = server.replace(/\/$/, "")
    if (/\/(codex-usage|claude-usage|usage)(\?|$|\/)/i.test(clean)) return clean
    return clean + "/usage"
  }
  return `http://${server.replace(/\/$/, "")}:5566/usage`
}

function refreshUrl(value) {
  const step = Date.now()
  const sep = String(value).indexOf("?") >= 0 ? "&" : "?"
  return `${value}${sep}_=${step}`
}

function serviceUsage(id, data) {
  const services = data && data.services ? data.services : {}
  const source = services[id] || singleServiceSource(id, data)

  if (id === "codex") {
    const limits = classifyCodexDisplayLimits(source, data)
    return {
      id,
      name: "Codex",
      color: COLORS.codex,
      ok: Boolean(source && source.ok),
      stale: Boolean(source && source.stale),
      latestAt: source ? source.latest_at || source.generated_at : null,
      primaryLabel: "5h",
      secondaryLabel: "Week",
      primary: limits.fiveHour,
      secondary: limits.weekly
    }
  }

  const primary = serviceLimit(source, ["five_hour", "primary", "total"])
  const secondary = serviceLimit(source, ["weekly", "secondary", "auto"])
  return {
    id,
    name: "Claude",
    color: COLORS.claude,
    ok: Boolean(source && source.ok),
    stale: Boolean(source && source.stale),
    latestAt: source ? source.latest_at || source.generated_at : (data ? data.latest_at || data.generated_at : null),
    primaryLabel: serviceLabel(source, "primary", "5h"),
    secondaryLabel: serviceLabel(source, "secondary", "Week"),
    primary,
    secondary
  }
}

function codexHistory(data) {
  const codex = data && data.services ? data.services.codex : singleServiceSource("codex", data)
  return codex && codex.history_7d ? codex.history_7d : []
}

function singleServiceSource(id, data) {
  if (!data || data.services) return null

  if (id === "claude") {
    const sourceMode = String(data.source_mode || "")
    if (sourceMode.indexOf("statusline") >= 0 || data.model) return data
    return null
  }

  if (id === "codex") {
    const source = String(data.source || "")
    if (source.toLowerCase().indexOf("codex") >= 0 || data.limit_id || data.plan_type) return data
  }

  return null
}

function serviceLimit(source, names) {
  if (!source) return null
  for (const name of names) {
    if (source[name] && typeof source[name] === "object") return source[name]
  }
  return null
}

function limitWindowMinutes(limit) {
  if (!limit) return 0
  return Number(limit.window_minutes || limit.windowDurationMins || limit.windowMinutes || 0)
}

function isWindowAround(actual, expected) {
  if (!Number.isFinite(actual) || actual <= 0) return false
  return Math.abs(actual - expected) <= Math.max(5, expected * 0.05)
}

function limitWindowKind(limit) {
  const minutes = limitWindowMinutes(limit)
  if (isWindowAround(minutes, 300)) return "fiveHour"
  if (isWindowAround(minutes, 10080)) return "weekly"

  const label = String(limit && (limit.label || limit.name || limit.limitName) || "").toLowerCase()
  if (/week|weekly|seven|7d|周/.test(label)) return "weekly"
  if (/5\s*h|five|5-hour/.test(label)) return "fiveHour"
  return null
}

function classifyCodexDisplayLimits(source, data) {
  const fiveHourNamed = [source && source.five_hour, data && data.five_hour]
  const weeklyNamed = [source && source.weekly, data && data.weekly]
  const candidates = [
    ...fiveHourNamed,
    ...weeklyNamed,
    source && source.primary,
    source && source.secondary
  ]
  const seen = new Set()
  let fiveHour = null
  let weekly = null

  for (const limit of candidates) {
    if (!limit || typeof limit !== "object" || seen.has(limit)) continue
    seen.add(limit)
    const kind = limitWindowKind(limit)
    if (!fiveHour && kind === "fiveHour") fiveHour = limit
    if (!weekly && kind === "weekly") weekly = limit
  }

  for (const limit of fiveHourNamed) {
    if (fiveHour || !limit || typeof limit !== "object") continue
    const kind = limitWindowKind(limit)
    if (!kind || kind === "fiveHour") fiveHour = limit
  }

  for (const limit of weeklyNamed) {
    if (weekly || !limit || typeof limit !== "object") continue
    const kind = limitWindowKind(limit)
    if (!kind || kind === "weekly") weekly = limit
  }

  return { fiveHour, weekly }
}

function serviceLabel(source, key, fallback) {
  if (!source) return fallback
  const direct = source[`${key}_label`]
  if (direct) return String(direct)
  const labels = source.labels || {}
  return labels[key] ? String(labels[key]) : fallback
}

function widgetLayout(family) {
  if (family === "small") {
    return {
      padTop: 11,
      padBottom: 8,
      padX: 13,
      logoSize: 32,
      logoBoxSize: 32,
      logoGap: 8,
      titleFont: 20,
      stampFont: 8,
      headerGap: 7,
      rowGap: 5,
      labelFont: 15,
      percentFont: 27,
      lineGap: 2,
      barWidth: 124,
      barHeight: 7,
      metaGap: 2,
      metaFont: 7
    }
  }

  return {
    padTop: 8,
    padBottom: 9,
    padX: 16,
    padRight: 6,
    panelWidth: 132,
    rightPanelWidth: 141,
    stampReserve: 11,
    panelHeight: 126,
    panelGap: 26,
    chartGap: 31,
    chartPanelWidth: 143,
    chartWidth: 143,
    chartHeight: 95,
    chartTitleFont: 13,
    chartUnitFont: 10,
    chartHeaderGap: 7,
    globalStampFont: 7,
    globalStampWidth: 24,
    globalStampHeight: 7,
    globalStampGap: 0,
    logoSize: 30,
    logoBoxSize: 30,
    logoGap: 7,
    titleFont: 21,
    stampFont: 8,
    headerGap: 7,
    rowGap: 5,
    labelFont: 14,
    percentFont: 26,
    lineGap: 2,
    barWidth: 128,
    barHeight: 7,
    metaGap: 2,
    metaFont: 7
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

function serviceStamp(service) {
  return shortTime(new Date())
}

function globalStamp(data) {
  return shortTime(new Date())
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

function serviceMark(id, size) {
  return id === "claude" ? claudeMark(size) : codexMark(size)
}

function codexMark(size) {
  const ctx = markContext(size)
  ctx.setFillColor(Color.white())
  ctx.fillEllipse(new Rect(size * 0.08, size * 0.29, size * 0.43, size * 0.45))
  ctx.fillEllipse(new Rect(size * 0.25, size * 0.10, size * 0.44, size * 0.48))
  ctx.fillEllipse(new Rect(size * 0.48, size * 0.27, size * 0.42, size * 0.45))
  ctx.fillEllipse(new Rect(size * 0.26, size * 0.48, size * 0.47, size * 0.38))
  ctx.fillRect(new Rect(size * 0.22, size * 0.34, size * 0.58, size * 0.35))

  ctx.setFont(Font.heavySystemFont(size * 0.36))
  ctx.setTextColor(new Color("#111217"))
  ctx.drawTextInRect(">_", new Rect(size * 0.29, size * 0.31, size * 0.52, size * 0.36))
  return ctx.getImage()
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
  const ctx = markContext(size)
  ctx.setFillColor(new Color("#fff3e4"))
  ctx.fillEllipse(new Rect(size * 0.03, size * 0.03, size * 0.94, size * 0.94))
  ctx.setFillColor(new Color("#d9772a", 0.32))
  ctx.fillEllipse(new Rect(size * 0.16, size * 0.16, size * 0.68, size * 0.68))
  ctx.setFillColor(new Color("#14161d"))
  ctx.setFont(Font.heavySystemFont(size * 0.62))
  ctx.setTextColor(new Color("#14161d"))
  ctx.drawTextInRect("C", new Rect(size * 0.23, size * 0.15, size * 0.58, size * 0.70))
  return ctx.getImage()
}

function historyChart(history, width, height) {
  const items = normalizeHistory(history)
  const values = items.map(item => Number(item.val || item.tokens || 0))
  const maxTokens = Math.max(0, ...values)
  const maxM = niceChartMax(maxTokens / 1000000)

  const ctx = new DrawContext()
  ctx.size = new Size(width, height)
  ctx.opaque = false
  ctx.respectScreenScale = true

  const left = 24
  const right = 3
  const top = 6
  const bottom = 16
  const plotW = width - left - right
  const plotH = height - top - bottom

  ctx.setFont(Font.systemFont(7))
  ctx.setTextColor(new Color("#6f7885"))
  drawAxisLabel(ctx, formatAxis(maxM), 0, top - 2, left - 4)
  drawAxisLabel(ctx, formatAxis(maxM / 2), 0, top + plotH / 2 - 4, left - 4)
  drawAxisLabel(ctx, "0", 0, top + plotH - 6, left - 4)

  ctx.setFillColor(new Color("#2e3845", 0.62))
  for (let i = 0; i <= 2; i++) {
    const y = top + plotH * i / 2
    ctx.fillRect(new Rect(left, y, plotW, 1))
  }

  const count = Math.max(1, items.length)
  const step = plotW / count
  const barW = Math.max(6, Math.min(14, step * 0.48))

  for (let i = 0; i < items.length; i++) {
    const tokens = Number(items[i].val || items[i].tokens || 0)
    const m = tokens / 1000000
    const ratio = maxM <= 0 ? 0 : Math.min(1, m / maxM)
    const barH = Math.max(tokens > 0 ? 3 : 0, plotH * ratio)
    const x = left + step * i + (step - barW) / 2
    const y = top + plotH - barH

    ctx.setFillColor(new Color("#1d4f91", 0.42))
    ctx.fillRect(new Rect(x, y - 1, barW, barH + 1))
    ctx.setFillColor(new Color("#2f7fe9"))
    ctx.fillRect(new Rect(x, y, barW, barH))

    ctx.setFont(Font.systemFont(7))
    ctx.setTextColor(new Color("#788291"))
    ctx.drawTextInRect(dayLabel(items[i].date), new Rect(x - 3, top + plotH + 4, barW + 6, 10))
  }

  return ctx.getImage()
}

function normalizeHistory(history) {
  const items = Array.isArray(history) ? history.slice(-7) : []
  while (items.length < 7) {
    items.unshift({ date: "", val: 0 })
  }
  return items
}

function niceChartMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(value)))
  const scaled = value / pow
  let nice = 10
  if (scaled <= 1) nice = 1
  else if (scaled <= 2) nice = 2
  else if (scaled <= 5) nice = 5
  return nice * pow
}

function formatAxis(value) {
  if (value >= 10) return String(Math.round(value))
  if (value >= 1) return value.toFixed(1).replace(/\.0$/, "")
  return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "")
}

function drawAxisLabel(ctx, text, x, y, width) {
  ctx.drawTextInRect(String(text), new Rect(x, y, width, 10))
}

function dayLabel(date) {
  if (!date) return ""
  const raw = String(date)
  const part = raw.includes("-") ? raw.split("-").pop() : raw.slice(-2)
  return part.replace(/^0/, "")
}

function markContext(size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true
  return ctx
}

function isStandBy() {
  // No dedicated StandBy API in Scriptable; charging is the reliable proxy
  // since StandBy only activates while the device is docked and charging.
  try {
    return Device.isCharging()
  } catch (_) {
    return false
  }
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
    const r = Math.round(21 - 13 * t)
    const g = Math.round(24 - 16 * t)
    const b = Math.round(34 - 25 * t)
    ctx.setFillColor(new Color(rgbHex(r, g, b)))
    ctx.fillRect(new Rect(0, y, width, 2))
  }

  ctx.setFillColor(new Color("#253047", 0.16))
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
