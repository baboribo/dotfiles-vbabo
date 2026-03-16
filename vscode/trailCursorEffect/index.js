// https://www.reddit.com/r/vscode/comments/11e66xh/i_made_neovide_alike_cursor_effect_on_vscode/
// 2026.03.16 Claude로 수정 및 기능 추가함

// ─── Configuration ────────────────────────────────────────────────────────────

const Color = "#d0aeff"
const CursorStyle = "line"
const TrailLength = 8
const CursorUpdatePollingRate = 500
const UseShadow = true
const ShadowColor = Color
const ShadowBlur = 34

// ─── Selection Stretch Trail Configuration ────────────────────────────────────

const SelectionColor = "#d0aeff"
const SelectionGlowBlur = 28
const SelectionOpacity = 0.47
const SelectionEdgeFade = 0.34
const SelectionAnimSpeed = 0.14

// ─── Shimmer Configuration ────────────────────────────────────────────────────

const ShimmerWidth = 150
const ShimmerOpacity = 0.20
const ShimmerColor = "#ffffff"
const ShimmerEasing = [0.62, 0, 0, 0.98]
const ShimmerCycleDuration = 174

// ─── Dismiss (선택 해제) 애니메이션 Configuration ─────────────────────────────

const DismissEnabled = true          // 페이드 아웃 애니메이션 on/off

const DismissBlur = 0               // 사라질 때 최대 블러 강도 (px)
const DismissDuration = 180          // 페이드 아웃 전체 길이 (ms)
const DismissDirection = "bottom"       // 사라지는 순서: "top" | "bottom" | "simultaneous"
const DismissStagger = 1            // 줄 간 딜레이 (ms) — simultaneous면 무시됨

// cubic-bezier (x1, y1, x2, y2)
// [0, 0, 0.58, 1.0] → ease-out (기본, 부드럽게 사라짐)
// [0.42, 0, 1.0, 1.0] → ease-in (처음엔 느리다가 빠르게 사라짐)
// [0.72, 0, 0.16, 0.97] → 느리게→빠르게→느리게
const DismissEasing = [0.66, 0, 0.16, 0.97]

// ─── Cursor Trail (원본 유지) ──────────────────────────────────────────────────

function createTrail(options) {
  const totalParticles = options?.length || 30
  let particlesColor = options?.color || "#9957f5"
  const style = options?.style || "block"
  const canvas = options?.canvas
  const context = canvas.getContext("2d")
  let cursor = { x: 0, y: 0 }
  let particles = []
  let width, height
  let sizeX = options?.size || 1
  let sizeY = options?.sizeY || sizeX * 2.2
  let cursorsInitted = false

  function updateSize(x, y) {
    width = x; height = y
    canvas.width = x; canvas.height = y
  }

  function move(x, y) {
    x = x + sizeX / 2
    cursor.x = x; cursor.y = y
    if (!cursorsInitted) {
      cursorsInitted = true
      for (let i = 0; i < totalParticles; i++) addParticle(x, y)
    }
  }

  class Particle {
    constructor(x, y) { this.position = { x, y } }
  }

  function addParticle(x, y) { particles.push(new Particle(x, y)) }

  function calculatePosition() {
    let x = cursor.x, y = cursor.y
    for (const i in particles) {
      const next = (particles[+i + 1] || particles[0]).position
      const cur = particles[+i].position
      cur.x = x; cur.y = y
      x += (next.x - cur.x) * 0.42
      y += (next.y - cur.y) * 0.38
    }
  }

  function drawLines() {
    context.beginPath()
    context.lineJoin = "round"
    context.strokeStyle = particlesColor
    const lw = Math.min(sizeX, sizeY)
    context.lineWidth = lw
    if (UseShadow) { context.shadowColor = ShadowColor; context.shadowBlur = ShadowBlur }
    const ymut = (sizeY - lw) / 3
    for (let yo = 0; yo <= 3; yo++) {
      const off = yo * ymut
      for (const i in particles) {
        const p = particles[i].position
        if (i == 0) context.moveTo(p.x, p.y + off + lw / 2)
        else context.lineTo(p.x, p.y + off + lw / 2)
      }
    }
    context.stroke()
  }

  function drawPath() {
    context.beginPath()
    context.fillStyle = particlesColor
    if (UseShadow) { context.shadowColor = ShadowColor; context.shadowBlur = ShadowBlur }
    for (let i = 0; i < totalParticles; i++) {
      const p = particles[i].position
      if (i == 0) context.moveTo(p.x, p.y)
      else context.lineTo(p.x, p.y)
    }
    for (let i = totalParticles - 1; i >= 0; i--) {
      const p = particles[i].position
      context.lineTo(p.x, p.y + sizeY)
    }
    context.closePath(); context.fill()
    context.beginPath()
    context.lineJoin = "round"
    context.strokeStyle = particlesColor
    context.lineWidth = Math.min(sizeX, sizeY)
    const off = -sizeX / 2 + sizeY / 2
    for (const i in particles) {
      const p = particles[i].position
      if (i == 0) context.moveTo(p.x, p.y + off)
      else context.lineTo(p.x, p.y + off)
    }
    context.stroke()
  }

  function updateParticles() {
    if (!cursorsInitted) return
    context.clearRect(0, 0, width, height)
    calculatePosition()
    if (style == "line") drawPath()
    else if (style == "block") drawLines()
  }

  function updateCursorSize(newSize, newSizeY) {
    sizeX = newSize
    if (newSizeY) sizeY = newSizeY
  }

  return { updateParticles, move, updateSize, updateCursorSize }
}

// ─── cubic-bezier 이징 함수 ───────────────────────────────────────────────────

function makeCubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  function sampleCurveX(t) { return ((ax * t + bx) * t + cx) * t }
  function sampleCurveY(t) { return ((ay * t + by) * t + cy) * t }
  function solveCurveX(x) {
    let t = x
    for (let i = 0; i < 8; i++) {
      const currentX = sampleCurveX(t) - x
      const derivative = (3 * ax * t + 2 * bx) * t + cx
      if (Math.abs(derivative) < 1e-6) break
      t -= currentX / derivative
    }
    return t
  }

  return function ease(t) {
    if (t <= 0) return 0
    if (t >= 1) return 1
    return sampleCurveY(solveCurveX(t))
  }
}

// ─── Selection Stretch Trail ──────────────────────────────────────────────────

function createSelectionStretch(canvas) {
  const ctx = canvas.getContext("2d")
  let rectStates = new Map()

  let shimmerBoundsX = 0
  let shimmerBoundsW = 0
  let hasActiveSelection = false

  const shimmerEase = makeCubicBezier(...ShimmerEasing)
  const dismissEase = makeCubicBezier(...DismissEasing)

  let shimmerT = 0
  let wasSelected = false

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
  }

  function getSelectionRects(editorEl) {
    const rects = []
    const er = editorEl.getBoundingClientRect()
    const selectors = [".selected-text", ".cdr.selected-text"]
    for (const sel of selectors) {
      const els = editorEl.querySelectorAll(sel)
      if (els.length === 0) continue
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          rects.push({
            x: r.left - er.left,
            y: r.top - er.top,
            w: r.width,
            h: r.height
          })
        }
      }
      if (rects.length > 0) break
    }
    return rects
  }

  function normalizeRects(rects) {
    if (rects.length === 0) return []
    const rows = []
    for (const r of rects) {
      const existing = rows.find(row => Math.abs(row.y - r.y) < 2)
      if (existing) {
        const x0 = Math.min(existing.x, r.x)
        const x1 = Math.max(existing.x + existing.w, r.x + r.w)
        existing.x = x0; existing.w = x1 - x0
        existing.h = Math.max(existing.h, r.h)
      } else {
        rows.push({ ...r })
      }
    }
    return rows.sort((a, b) => a.y - b.y)
  }

  function spring(current, target, speed) {
    return current + (target - current) * speed
  }

  function drawStretchBar(x, y, w, h, alpha, blur) {
    if (w <= 0 || h <= 0) return
    ctx.save()
    // 블러 적용 (dismiss 애니메이션 중에 blur가 들어옴)
    if (blur > 0) ctx.filter = `blur(${blur.toFixed(1)}px)`
    if (UseShadow) {
      ctx.shadowColor = SelectionColor
      ctx.shadowBlur = SelectionGlowBlur * alpha
    }
    const grad = ctx.createLinearGradient(x, 0, x + w, 0)
    const fadeW = Math.min(w * SelectionEdgeFade, 30)
    const midAlpha = alpha * SelectionOpacity
    grad.addColorStop(0, hexToRgba(SelectionColor, 0))
    grad.addColorStop(Math.min(fadeW / w, 0.4), hexToRgba(SelectionColor, midAlpha))
    grad.addColorStop(Math.max(1 - fadeW / w, 0.6), hexToRgba(SelectionColor, midAlpha))
    grad.addColorStop(1, hexToRgba(SelectionColor, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    const r = Math.min(h * 0.35, 4)
    ctx.roundRect(x, y + h * 0.1, w, h * 0.8, r)
    ctx.fill()
    ctx.restore()
  }

  function drawShimmerOnBar(x, y, w, h, alpha, shimmerX, blur) {
    if (w <= 0 || h <= 0 || alpha < 0.01) return
    ctx.save()
    if (blur > 0) ctx.filter = `blur(${blur.toFixed(1)}px)`
    ctx.beginPath()
    const r = Math.min(h * 0.35, 4)
    ctx.roundRect(x, y + h * 0.1, w, h * 0.8, r)
    ctx.clip()
    const sx = shimmerX - ShimmerWidth / 2
    const shimGrad = ctx.createLinearGradient(sx, 0, sx + ShimmerWidth, 0)
    shimGrad.addColorStop(0,    hexToRgba(ShimmerColor, 0))
    shimGrad.addColorStop(0.35, hexToRgba(ShimmerColor, ShimmerOpacity * alpha))
    shimGrad.addColorStop(0.5,  hexToRgba(ShimmerColor, ShimmerOpacity * alpha * 1.3))
    shimGrad.addColorStop(0.65, hexToRgba(ShimmerColor, ShimmerOpacity * alpha))
    shimGrad.addColorStop(1,    hexToRgba(ShimmerColor, 0))
    ctx.fillStyle = shimGrad
    ctx.fillRect(sx, y, ShimmerWidth, h)
    ctx.restore()
  }

  // ── dismiss 애니메이션 시작 ────────────────────────────────────────────────
  // 선택 해제 시 각 rect에 dismiss 상태를 부여함
  // DismissDirection에 따라 줄마다 딜레이(startDelay)를 다르게 줌
  function startDismiss() {
    if (!DismissEnabled) {
      // 페이드 아웃 비활성화 시 즉시 삭제
      rectStates.clear()
      return
    }

    // 현재 rectStates를 y 순으로 정렬해서 딜레이 계산
    const keys = [...rectStates.keys()].sort((a, b) => a - b)  // key가 y 기반이므로 정렬 가능
    const total = keys.length

    keys.forEach((key, index) => {
      const s = rectStates.get(key)
      if (!s) return

      // 순서 인덱스: top이면 위부터(0,1,2...), bottom이면 아래부터(역순)
      const orderIndex = DismissDirection === "bottom"
        ? (total - 1 - index)
        : DismissDirection === "top"
          ? index
          : 0  // simultaneous

      s.dismissing = true           // dismiss 모드 진입 플래그
      s.dismissT = 0                // dismiss 진행률 (0→1)
      s.dismissStartDelay =         // 이 줄이 시작하기까지 기다리는 시간 (ms)
        DismissDirection === "simultaneous" ? 0 : orderIndex * DismissStagger
      s.dismissElapsed = 0          // 경과 시간 (ms)
      s.dismissBlur = 0             // 현재 블러값 (애니메이션 중 변화)
    })
  }

  function update(editorEl) {
    const rawRects = getSelectionRects(editorEl)
    const targetRects = normalizeRects(rawRects)
    const hasSelection = targetRects.length > 0
    const activeKeys = new Set()

    if (hasSelection) {
      let minX = Infinity, maxX = -Infinity
      for (const tr of targetRects) {
        minX = Math.min(minX, tr.x)
        maxX = Math.max(maxX, tr.x + tr.w)
      }
      shimmerBoundsX = minX
      shimmerBoundsW = maxX - minX

      for (const tr of targetRects) {
        const key = Math.round(tr.y / 2) * 2
        activeKeys.add(key)
        if (!rectStates.has(key)) {
          rectStates.set(key, {
            x: tr.x + tr.w, y: tr.y, w: 0, h: tr.h,
            targetX: tr.x, targetW: tr.w, targetH: tr.h,
            alpha: 0,
            // dismiss 관련 초기값
            dismissing: false,
            dismissT: 0,
            dismissStartDelay: 0,
            dismissElapsed: 0,
            dismissBlur: 0
          })
        } else {
          const s = rectStates.get(key)
          // dismiss 중이던 rect가 다시 선택되면 dismiss 취소
          s.dismissing = false
          s.dismissT = 0
          s.dismissBlur = 0
          s.targetX = tr.x; s.targetW = tr.w; s.targetH = tr.h; s.y = tr.y
        }
      }
    }

    hasActiveSelection = hasSelection

    // ── 선택 해제 감지 → dismiss 시작 ────────────────────────────────────────
    if (!hasSelection && wasSelected) {
      shimmerT = 0
      startDismiss()  // rectStates.clear() 대신 dismiss 애니메이션 진입
    }
    wasSelected = hasSelection

    // ── shimmer 위치 계산 ─────────────────────────────────────────────────────
    let shimmerX = shimmerBoundsX - ShimmerWidth
    if (hasActiveSelection) {
      shimmerT += 1 / ShimmerCycleDuration
      if (shimmerT > 1) shimmerT = 0
      const easedT = shimmerEase(shimmerT)
      const start = shimmerBoundsX - ShimmerWidth
      const end   = shimmerBoundsX + shimmerBoundsW + ShimmerWidth
      shimmerX = start + (end - start) * easedT
    }

    // 프레임 시간 계산 (requestAnimationFrame은 ~16.67ms/frame @60fps)
    const frameDelta = 1000 / 60

    // ── 스프링 업데이트 & 그리기 ──────────────────────────────────────────────
    const toDelete = []
    for (const [key, s] of rectStates) {

      // ── dismiss 중인 rect 처리 ──────────────────────────────────────────────
      if (s.dismissing) {
        s.dismissElapsed += frameDelta

        // startDelay가 지나지 않았으면 아직 full alpha로 그리고 대기
        if (s.dismissElapsed < s.dismissStartDelay) {
          drawStretchBar(s.x, s.y, s.w, s.h, s.alpha, 0)
          drawShimmerOnBar(s.x, s.y, s.w, s.h, s.alpha, shimmerX, 0)
          continue
        }

        // dismiss 실제 진행 시간 (delay 이후부터 카운트)
        const elapsed = s.dismissElapsed - s.dismissStartDelay
        s.dismissT = Math.min(elapsed / DismissDuration, 1)

        // 베지어 이징 적용한 진행률
        const easedDismiss = dismissEase(s.dismissT)

        // alpha: 1 → 0
        s.alpha = 1 - easedDismiss
        // blur: 0 → DismissBlur
        s.dismissBlur = easedDismiss * DismissBlur

        if (s.dismissT >= 1) {
          // 애니메이션 완료 → 삭제 대기
          toDelete.push(key)
          continue
        }

        drawStretchBar(s.x, s.y, s.w, s.h, s.alpha, s.dismissBlur)
        drawShimmerOnBar(s.x, s.y, s.w, s.h, s.alpha, shimmerX, s.dismissBlur)
        continue
      }

      // ── 일반 활성 rect 처리 ───────────────────────────────────────────────
      if (!activeKeys.has(key)) {
        // dismiss가 꺼져있을 때의 fallback (즉시 삭제)
        toDelete.push(key)
        continue
      }

      s.alpha = spring(s.alpha, 1, SelectionAnimSpeed)
      s.x = spring(s.x, s.targetX, SelectionAnimSpeed)
      s.w = spring(s.w, s.targetW, SelectionAnimSpeed)
      s.h = spring(s.h, s.targetH, SelectionAnimSpeed)

      drawStretchBar(s.x, s.y, s.w, s.h, s.alpha, 0)
      drawShimmerOnBar(s.x, s.y, s.w, s.h, s.alpha, shimmerX, 0)
    }

    for (const key of toDelete) rectStates.delete(key)
  }

  return { update, getSelectionRects }
}

// ─── Cursor Handler ───────────────────────────────────────────────────────────

async function createCursorHandler(handlerFunctions) {
  let editor
  while (!editor) {
    await new Promise(resolve => setTimeout(resolve, 100))
    editor = document.querySelector(".part.editor")
  }
  handlerFunctions?.onStarted(editor)

  let updateHandlers = []
  let cursorId = 0
  let lastObjects = {}
  let lastCursor = 0

  function createCursorUpdateHandler(target, cursorId, cursorHolder, minimap) {
    let lastX, lastY
    let update = (editorX, editorY) => {
      if (!lastObjects[cursorId]) {
        updateHandlers.splice(updateHandlers.indexOf(update), 1)
        return
      }
      let { left: newX, top: newY } = target.getBoundingClientRect()
      let revX = newX - editorX, revY = newY - editorY
      if (revX == lastX && revY == lastY && lastCursor == cursorId) return
      lastX = revX; lastY = revY
      if (revX <= 0 || revY <= 0) return
      if (target.style.visibility == "hidden") return
      if (minimap && minimap.offsetWidth != 0 && minimap.getBoundingClientRect().left <= newX) return
      if (cursorHolder.getBoundingClientRect().left > newX) return
      lastCursor = cursorId
      handlerFunctions?.onCursorPositionUpdated(revX, revY)
      handlerFunctions?.onCursorSizeUpdated(target.clientWidth, target.clientHeight)
    }
    updateHandlers.push(update)
  }

  let lastVisibility = "hidden"
  setInterval(async () => {
    let now = [], count = 0
    for (const target of editor.getElementsByClassName("cursor")) {
      if (target.style.visibility != "hidden") count++
      if (target.hasAttribute("cursorId")) {
        now.push(+target.getAttribute("cursorId"))
        continue
      }
      let thisCursorId = cursorId++
      now.push(thisCursorId)
      lastObjects[thisCursorId] = target
      target.setAttribute("cursorId", thisCursorId)
      let cursorHolder = target.parentElement.parentElement.parentElement
      let minimap = cursorHolder.parentElement.querySelector(".minimap")
      createCursorUpdateHandler(target, thisCursorId, cursorHolder, minimap)
    }
    let visibility = count <= 1 ? "visible" : "hidden"
    if (visibility != lastVisibility) {
      handlerFunctions?.onCursorVisibilityChanged(visibility)
      lastVisibility = visibility
    }
    for (const id in lastObjects) {
      if (now.includes(+id)) continue
      delete lastObjects[+id]
    }
  }, handlerFunctions?.cursorUpdatePollingRate || 500)

  function updateLoop() {
    let { left: editorX, top: editorY } = editor.getBoundingClientRect()
    for (const handler of updateHandlers) handler(editorX, editorY)
    handlerFunctions?.onLoop(editor)
    requestAnimationFrame(updateLoop)
  }

  function updateEditorSize() {
    handlerFunctions?.onEditorSizeUpdated(editor.clientWidth, editor.clientHeight)
  }
  new ResizeObserver(updateEditorSize).observe(editor)
  updateEditorSize()

  updateLoop()
  handlerFunctions?.onReady()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let cursorCanvas, rainbowCursorHandle, selectionStretch

createCursorHandler({
  cursorUpdatePollingRate: CursorUpdatePollingRate,

  onStarted: (editor) => {
    cursorCanvas = document.createElement("canvas")
    cursorCanvas.style.pointerEvents = "none"
    cursorCanvas.style.position = "absolute"
    cursorCanvas.style.top = "0px"
    cursorCanvas.style.left = "0px"
    cursorCanvas.style.zIndex = "1000"
    editor.appendChild(cursorCanvas)

    let color = Color
    if (color == "default") {
      color = getComputedStyle(document.querySelector("body>.monaco-workbench"))
        .getPropertyValue("--vscode-editorCursor-background").trim()
    }

    rainbowCursorHandle = createTrail({
      length: TrailLength,
      color,
      size: 7,
      style: CursorStyle,
      canvas: cursorCanvas
    })

    selectionStretch = createSelectionStretch(cursorCanvas)
  },

  onReady: () => {},

  onCursorPositionUpdated: (x, y) => {
    rainbowCursorHandle.move(x, y)
  },

  onEditorSizeUpdated: (x, y) => {
    rainbowCursorHandle.updateSize(x, y)
  },

  onCursorSizeUpdated: (x, y) => {
    rainbowCursorHandle.updateCursorSize(x, y)
  },

  onCursorVisibilityChanged: (visibility) => {
    cursorCanvas.style.visibility = visibility
  },

  onLoop: (editor) => {
    rainbowCursorHandle.updateParticles()
    selectionStretch.update(editor)
  },
})
